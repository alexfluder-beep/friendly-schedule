// Supabase Edge Function "agent-api" (deploy with verify_jwt = false: the x-agent-key header replaces the login check).
// Secret AGENT_API_KEY (32+ random characters) is set in the Supabase dashboard; it is never in the repo or the app.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { makeHandler } from "./handler.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const handler = makeHandler({
  key: [Deno.env.get("AGENT_API_KEY") ?? "", Deno.env.get("AGENT_API_KEY_BOT") ?? ""],   // agents' key; a separate bot key once the bot uses the API
  db: {
    rpc: (fn, args) => sb.rpc(fn, args) as unknown as Promise<{ data: unknown; error: unknown }>,
    lastRunAt: async () => { const { data, error } = await sb.from("agent_runs").select("at").order("at", { ascending: false }).limit(1); if (error) throw new Error("db_error"); return data && data[0] ? String(data[0].at) : null; },
    ping: async () => { const { error } = await sb.from("agent_runs").select("id", { head: true }).limit(1); return !error; },
  },
});
Deno.serve(handler);
