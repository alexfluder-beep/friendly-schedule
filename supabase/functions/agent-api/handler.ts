// Friendly Schedule agent API: request handling (18 Nov 2026, brief "Friendly Schedule: agent API brief").
// Read-only access to the existing agent_* SQL functions for Claude's scheduled checks; the only writes are agent_notify and agent_run_done.
// No SQL, table or column name from a request ever reaches the database. No guest phone or e-mail leaves this function.

export interface Db {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  lastRunAt(): Promise<string | null>; // newest agent_runs.at
  ping(): Promise<boolean>; // "select 1"
}
export interface Opts { key: string | string[];  /* one key, or several (each caller its own, so one can be switched off alone) */ db: Db; now?: () => number; log?: (line: string) => void; perMinute?: number }

const enc = new TextEncoder();
async function sameKey(given: string, real: string): Promise<boolean> {
  // constant time: compare SHA-256 digests of both, so length and content leak nothing
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(real))]);
  const x = new Uint8Array(a), y = new Uint8Array(b); let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

class Bad extends Error {}
const bad = (): never => { throw new Bad("bad_input"); };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const only = (b: Record<string, unknown>, keys: string[]) => { for (const k of Object.keys(b)) if (!keys.includes(k)) bad(); };
const int = (v: unknown, lo: number, hi: number, dflt?: number): number => {
  if (v === undefined && dflt !== undefined) return dflt;
  if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) bad();
  return v as number;
};
const text = (v: unknown, lo: number, hi: number, re?: RegExp): string => {
  if (typeof v !== "string" || v.length < lo || v.length > hi || (re && !re.test(v))) bad();
  return v as string;
};
const CODE = /^[A-Za-z0-9][A-Za-z0-9\-_/.#]*$/; // booking codes: letters, digits and - _ / . #
const TITLE = /^[\p{L}\p{N} ×'&.,()\-]+$/u; // tour title words; no %, _, quotes or semicolons
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RUNS = ["early", "10:15", "14:00", "evening"];

// Nothing that looks like a phone number or an e-mail address leaves the API, even inside free text (log lines).
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /\+\d[\d\s().-]{6,}\d/g;
const CONTACT_KEY = /phone|e_?mail|^tel$|whatsapp/i;
export function scrub(v: unknown): unknown {
  if (typeof v === "string") return v.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
  if (Array.isArray(v)) return v.map(scrub);
  if (isObj(v)) { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) if (!CONTACT_KEY.test(k)) o[k] = scrub(x); return o; }
  return v;
}

type Route = { method: "GET" | "POST"; run: (b: Record<string, unknown>, o: Opts) => Promise<unknown> };
const call = async (o: Opts, fn: string, args: Record<string, unknown>) => { const { data, error } = await o.db.rpc(fn, args); if (error) throw new Error("db_error"); return data; };
const ROUTES: Record<string, Route> = {
  "/health": { method: "GET", run: async (_b, o) => { if (!(await o.db.ping())) throw new Error("db_error"); return null; } },
  "/board": { method: "POST", run: (b, o) => { only(b, ["from", "to"]); const f = int(b.from, 0, 14, 0), t = int(b.to, 0, 14, 1); if (f > t) bad(); return call(o, "agent_board", { d_from: f, d_to: t }); } },
  "/refs": { method: "POST", run: (b, o) => { only(b, ["codes"]); if (!Array.isArray(b.codes) || b.codes.length < 1 || b.codes.length > 50) bad(); const codes = (b.codes as unknown[]).map(c => text(c, 4, 40, CODE)); return call(o, "agent_find_refs", { codes }); } },
  "/changes": { method: "POST", run: async (b, o) => {
    only(b, ["since"]); let since: string;
    if (b.since === undefined) { const last = await o.db.lastRunAt(); const now = (o.now ?? Date.now)(); since = new Date(last ? Date.parse(last) - 10 * 60e3 : now - 6 * 3600e3).toISOString(); }
    else { const s = text(b.since, 10, 40); const t = Date.parse(s); if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(s) || Number.isNaN(t)) bad(); since = new Date(t).toISOString(); }
    return call(o, "agent_changes", { since });
  } },
  "/conflicts": { method: "POST", run: (b, o) => { only(b, ["days"]); return call(o, "agent_conflicts", { days: int(b.days, 1, 30, 7) }); } },
  "/guests": { method: "POST", run: (b, o) => {
    only(b, ["date", "title"]); const d = text(b.date, 10, 10, DATE); if (Number.isNaN(Date.parse(d + "T00:00:00Z")) || new Date(d + "T00:00:00Z").toISOString().slice(0, 10) !== d) bad();
    return call(o, "agent_guests", { p_date: d, p_title: text(b.title, 1, 60, TITLE).trim() });
  } },
  "/notify": { method: "POST", run: (b, o) => { only(b, ["text"]); return call(o, "agent_notify", { msg: text(b.text, 1, 500) }); } },
  "/run-done": { method: "POST", run: (b, o) => { only(b, ["run", "summary"]); const run = text(b.run, 1, 20); if (!RUNS.includes(run)) bad(); return call(o, "agent_run_done", { run, summary: b.summary === undefined ? "" : text(b.summary, 0, 1000) }); } },
};

// ---------- /snapshot: one call for a whole daily check (19 Nov 2026) ----------
// Changes, tours, conflicts and booking codes in one answer, kept short: empty fields dropped, repeated log lines merged,
// screen activity and money lines left out (not schedule changes). Morning and evening get every tour in full;
// 10:15 and 14:00 get a one-line list of all tours plus full rows only for tours with a flag or a mark.
const TZ_MS = 4 * 3600e3; // Tbilisi is UTC+4 all year
const RANGE: Record<string, [number, number, boolean]> = { early: [0, 1, true], "10:15": [0, 1, false], "14:00": [0, 0, false], evening: [1, 1, true] };
const NOISE = /^(Email read:|Email booking opened to save:|Money:)/;
type Row = Record<string, unknown>;
const empty = (v: unknown) => v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);
const lean = (r: Row): Row => Object.fromEntries(Object.entries(r).filter(([, v]) => !empty(v)));
const tb = (iso: unknown) => { const t = Date.parse(String(iso)); return Number.isNaN(t) ? "" : new Date(t + TZ_MS).toISOString().slice(5, 16).replace("T", " "); };
const arr = (v: unknown): Row[] => (Array.isArray(v) ? v as Row[] : []);
function tourLine(r: Row): string {
  const f = arr(r.flags).length ? " | flags: " + (r.flags as string[]).join(",") : "", m = arr(r.marks).length ? " | marks: " + (r.marks as string[]).join(",") : "";
  return `${r.date} ${r.start_time ?? ""} | ${r.title} | ${[r.kind, r.language].filter(Boolean).join(" ")} | ${r.pax ?? 0}${Number(r.capacity) > 0 ? "/" + r.capacity : ""} pax | guide ${r.guide ?? "-"} | driver ${r.driver ?? "-"}${f}${m}${r.status && r.status !== "confirmed" ? " | " + r.status : ""}`;
}
export function changeLines(rows: Row[]): string[] {
  const seen = new Map<string, { at: string; n: number; line: string }>();
  for (const r of rows) {
    const what = String(r.what ?? ""); if (NOISE.test(what)) continue;
    const k = `${r.src}|${r.who ?? ""}|${what}`, o = seen.get(k);
    if (o) { o.n++; if (String(r.at) > o.at) o.at = String(r.at); } else seen.set(k, { at: String(r.at), n: 1, line: `${r.src}${r.who ? " " + r.who : ""}: ${what}` });
  }
  const all = [...seen.values()].sort((a, b) => (a.at < b.at ? 1 : -1)), out = all.slice(0, 60).map(x => `${tb(x.at)} ${x.line}${x.n > 1 ? ` (x${x.n})` : ""}`);
  if (all.length > 60) out.push(`... and ${all.length - 60} older lines not shown: ask /changes with the same since for all of them`);
  return out;
}
async function snapshot(b: Row, o: Opts) {
  only(b, ["run", "codes", "since"]); const run = text(b.run, 1, 20); if (!RANGE[run]) bad();
  let codes: string[] = []; if (b.codes !== undefined) { if (!Array.isArray(b.codes) || b.codes.length > 50) bad(); codes = (b.codes as unknown[]).map(c => text(c, 4, 40, CODE)); }
  const now = (o.now ?? Date.now)(); let since: string;
  if (b.since !== undefined) { const s = text(b.since, 10, 40), t = Date.parse(s); if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(s) || Number.isNaN(t)) bad(); since = new Date(t).toISOString(); }
  else if (run === "evening") since = new Date(Math.floor((now + TZ_MS) / 864e5) * 864e5 - TZ_MS).toISOString(); // the whole day since 00:00 Tbilisi
  else { const last = await o.db.lastRunAt(); since = new Date(last ? Date.parse(last) - 10 * 60e3 : now - 6 * 3600e3).toISOString(); }
  const [f, t, full] = RANGE[run];
  const [board, changes, conflicts, refs] = await Promise.all([call(o, "agent_board", { d_from: f, d_to: t }), call(o, "agent_changes", { since }), call(o, "agent_conflicts", { days: 7 }), codes.length ? call(o, "agent_find_refs", { codes }) : Promise.resolve([])]);
  const tours = arr(board), flagged = tours.filter(r => arr(r.flags).length), marked = tours.filter(r => arr(r.flags).length || arr(r.marks).length); // marked: flags or marks (pickup address, front seat...) need the full row
  return {
    run, since: tb(since) + " Tbilisi", days: [f, t],
    tours: { count: tours.length, pax: tours.reduce((a, r) => a + (Number(r.pax) || 0), 0), flagged: flagged.length, lines: tours.map(tourLine), detail: (full ? tours : marked).map(lean) },
    changes: changeLines(arr(changes)), conflicts: arr(conflicts).map(lean),
    refs: arr(refs).map(r => (r.found ? lean(r) : { code: r.code, found: false })),
  };
}
ROUTES["/snapshot"] = { method: "POST", run: snapshot };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export function makeHandler(o: Opts) {
  const per = o.perMinute ?? 60; let win = 0, used = 0;
  return async (req: Request): Promise<Response> => {
    const t0 = (o.now ?? Date.now)(); const url = new URL(req.url);
    const route = url.pathname.replace(/^.*\/agent-api(?=\/|$)/, "") || "/";
    let status = 500, body: unknown = { ok: false, error: "server_error" };
    try {
      const keys = (Array.isArray(o.key) ? o.key : [o.key]).filter(k => k && k.length >= 32), given = req.headers.get("x-agent-key") ?? "";
      if (!keys.length) { status = 500; body = { ok: false, error: "not_configured" }; }
      else if (!(await Promise.all(keys.map(k => sameKey(given, k)))).some(Boolean)) { status = 401; body = { ok: false, error: "unauthorized" }; }
      else {
        const m = Math.floor(t0 / 60000); if (m !== win) { win = m; used = 0; }
        if (++used > per) { status = 429; body = { ok: false, error: "rate_limited" }; }
        else {
          const r = ROUTES[route];
          if (!r || r.method !== req.method) { status = 404; body = { ok: false, error: "not_found" }; }
          else {
            let b: Record<string, unknown> = {};
            if (req.method === "POST") {
              const raw = await req.text(); if (raw.length > 10000) bad();
              if (raw.trim()) { let p: unknown; try { p = JSON.parse(raw); } catch { bad(); } if (!isObj(p)) bad(); b = p as Record<string, unknown>; }
            }
            const data = await r.run(b, o);
            status = 200; body = route === "/health" ? { ok: true } : { ok: true, data: scrub(data ?? []) };
          }
        }
      }
    } catch (e) {
      if (e instanceof Bad) { status = 400; body = { ok: false, error: "bad_input" }; }
      else { status = 500; body = { ok: false, error: "db_error" }; }
    }
    (o.log ?? console.log)(JSON.stringify({ route, status, ms: (o.now ?? Date.now)() - t0 })); // route, status and time only: never bodies or results (guest names)
    return json(status, body);
  };
}
