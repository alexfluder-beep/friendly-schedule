// Place search for the address fields (pickup point, guest hotel).
// Asks Google Places (New) Autocomplete, leaning towards Tbilisi and Georgia.
// The Google key lives only in the Supabase secret GOOGLE_PLACES_KEY.
// Only signed-in team members can call it (verify_jwt stays on).
// Sends Google only the typed words: no guest names, phones or e-mails.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export type Place = { name: string; addr: string; url: string };

// Turns Google's answer into short rows the app can show.
export function toPlaces(data: any): Place[] {
  const out: Place[] = [];
  for (const s of (data && data.suggestions) || []) {
    const p = s && s.placePrediction;
    if (!p || !p.placeId) continue;
    const main = String(p.structuredFormat?.mainText?.text || p.text?.text || "").trim();
    const rest = String(p.structuredFormat?.secondaryText?.text || "").trim();
    if (!main) continue;
    const full = rest ? `${main}, ${rest}` : main;
    out.push({
      name: main,
      addr: full,
      url: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(full) + "&query_place_id=" + encodeURIComponent(p.placeId),
    });
  }
  return out.slice(0, 6);
}

export function makeHandler(opts: { key: string; fetch?: typeof fetch }) {
  const f = opts.fetch || fetch;
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ error: "post_only" }, 405);
    if (!opts.key) return json({ error: "no_key", places: [] }, 503);
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const q = String(body.q || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (q.length < 3) return json({ places: [] });
    const lang = ["en", "ru", "ka"].includes(body.lang) ? body.lang : "en";
    const session = /^[A-Za-z0-9-]{8,64}$/.test(String(body.session || "")) ? String(body.session) : undefined;
    const r = await f("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": opts.key },
      body: JSON.stringify({
        input: q,
        languageCode: lang,
        includedRegionCodes: ["ge", "am"],
        locationBias: { circle: { center: { latitude: 41.6938, longitude: 44.8015 }, radius: 50000 } },
        ...(session ? { sessionToken: session } : {}),
      }),
    });
    if (!r.ok) { console.error("places", r.status, (await r.text()).slice(0, 300)); return json({ error: "google_" + r.status, places: [] }, 502); }
    return json({ places: toPlaces(await r.json()) });
  };
}

if (import.meta.main) Deno.serve(makeHandler({ key: Deno.env.get("GOOGLE_PLACES_KEY") ?? "" }));
