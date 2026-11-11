// Nightly copy of the whole schedule database to the owner's Google Drive.
// pg_cron calls this function once a day. It reads every table with the service key (inside Supabase),
// packs it as one gzip JSON file and posts it to the owner's Google Apps Script web app, which saves it in Drive.
// Nothing is returned to the caller except counts, and it runs at most once in 20 hours, so calling the URL
// from outside can neither read data nor flood the Drive. The Drive address lives in public.backup_config (no API access).
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const TABLES = ["profiles", "tours", "bookings", "clients", "client_ratings", "tour_ratings", "time_off", "holidays", "tasks",
  "notifications", "settings", "invites", "payout_details", "pay_adjustments", "pay_disputes", "tour_costs", "expenses",
  "personal_dates", "change_requests", "offers", "log", "usage", "app_errors"];
const PAGE = 1000;

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await sb.from("backup_config").select("*").eq("id", 1).maybeSingle();
  const say = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (!cfg?.drive_url) return say({ ok: false, why: "no Drive address yet" });
  if (cfg.last_at && Date.now() - new Date(cfg.last_at).getTime() < 20 * 3600e3) return say({ ok: true, skipped: "already copied today" });

  const tables: Record<string, unknown[]> = {}, counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from(t).select("*").order("id").range(from, from + PAGE - 1);
      if (error) { counts[t] = -1; break; }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    tables[t] = rows; counts[t] = counts[t] === -1 ? -1 : rows.length;
  }
  const at = new Date().toISOString();
  const json = JSON.stringify({ app: "friendly-schedule", at, counts, tables });
  const gz = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  const name = `friendly-schedule-${at.slice(0, 10)}.json.gz`;
  let result = "";
  try {
    const r = await fetch(cfg.drive_url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app: "friendly-schedule", name, counts, data: encodeBase64(gz) }) });
    const txt = await r.text();
    result = r.ok && /"ok":\s*true/.test(txt) ? `saved ${name}, ${Math.round(gz.length / 1024)} KB` : `Drive answered ${r.status}: ${txt.slice(0, 200)}`;
  } catch (e) { result = "Drive did not answer: " + String(e).slice(0, 200); }
  const ok = result.startsWith("saved");
  await sb.from("backup_config").update({ last_try: at, last_result: result, ...(ok ? { last_at: at } : {}) }).eq("id", 1);
  return say({ ok, result, counts }, ok ? 200 : 502);
});
