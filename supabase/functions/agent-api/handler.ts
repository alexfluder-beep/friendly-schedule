// Friendly Schedule agent API: request handling (18 Nov 2026, brief "Friendly Schedule: agent API brief").
// Read-only access to the existing agent_* SQL functions for Claude's scheduled checks; the only writes are agent_notify and agent_run_done.
// No SQL, table or column name from a request ever reaches the database. No guest phone or e-mail leaves this function.

export interface Db {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  lastRunAt(): Promise<string | null>; // newest agent_runs.at
  ping(): Promise<boolean>; // "select 1"
}
export interface Opts { key: string; db: Db; now?: () => number; log?: (line: string) => void; perMinute?: number }

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

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export function makeHandler(o: Opts) {
  const per = o.perMinute ?? 60; let win = 0, used = 0;
  return async (req: Request): Promise<Response> => {
    const t0 = (o.now ?? Date.now)(); const url = new URL(req.url);
    const route = url.pathname.replace(/^.*\/agent-api(?=\/|$)/, "") || "/";
    let status = 500, body: unknown = { ok: false, error: "server_error" };
    try {
      if (!o.key || o.key.length < 32) { status = 500; body = { ok: false, error: "not_configured" }; }
      else if (!(await sameKey(req.headers.get("x-agent-key") ?? "", o.key))) { status = 401; body = { ok: false, error: "unauthorized" }; }
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
