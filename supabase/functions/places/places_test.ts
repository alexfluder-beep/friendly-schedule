// deno test supabase/functions/places/places_test.ts  (invented data only)
const assertEquals = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
import { makeHandler, toPlaces } from "./index.ts";

const post = (body: unknown) => new Request("http://x/places", { method: "POST", body: JSON.stringify(body) });
const sample = { suggestions: [
  { placePrediction: { placeId: "abc123", text: { text: "Test Hotel, Some Street 1, Tbilisi" }, structuredFormat: { mainText: { text: "Test Hotel" }, secondaryText: { text: "Some Street 1, Tbilisi, Georgia" } } } },
  { queryPrediction: { text: { text: "hotels" } } },
] };

Deno.test("turns Google rows into name, address and map link", () => {
  const p = toPlaces(sample);
  assertEquals(p.length, 1);
  assertEquals(p[0].name, "Test Hotel");
  assertEquals(p[0].addr, "Test Hotel, Some Street 1, Tbilisi, Georgia");
  assertEquals(p[0].url.includes("query_place_id=abc123"), true);
});

Deno.test("no key answers 503 and calls nobody", async () => {
  let called = false;
  const h = makeHandler({ key: "", fetch: (() => { called = true; return Promise.resolve(new Response("{}")); }) as typeof fetch });
  assertEquals((await h(post({ q: "hotel" }))).status, 503);
  assertEquals(called, false);
});

Deno.test("short text is not sent to Google", async () => {
  let called = false;
  const h = makeHandler({ key: "k", fetch: (() => { called = true; return Promise.resolve(new Response("{}")); }) as typeof fetch });
  assertEquals((await (await h(post({ q: "ab" }))).json()).places, []);
  assertEquals(called, false);
});

Deno.test("sends only the words, the key in a header, leaning to Georgia", async () => {
  let seen: any = null, hdr = "";
  const h = makeHandler({ key: "k", fetch: ((_u: string, init: RequestInit) => { seen = JSON.parse(String(init.body)); hdr = (init.headers as Record<string, string>)["X-Goog-Api-Key"]; return Promise.resolve(new Response(JSON.stringify(sample))); }) as typeof fetch });
  const r = await (await h(post({ q: "  test   hotel ", lang: "ru", session: "abcdef12-3456" }))).json();
  assertEquals(seen.input, "test hotel");
  assertEquals(seen.languageCode, "ru");
  assertEquals(seen.includedRegionCodes, ["ge", "am"]);
  assertEquals(seen.sessionToken, "abcdef12-3456");
  assertEquals(hdr, "k");
  assertEquals(r.places.length, 1);
});

Deno.test("Google error gives an empty list, not a crash", async () => {
  const h = makeHandler({ key: "k", fetch: (() => Promise.resolve(new Response("denied", { status: 403 }))) as typeof fetch });
  const r = await h(post({ q: "hotel" }));
  assertEquals(r.status, 502);
  assertEquals((await r.json()).places, []);
});
