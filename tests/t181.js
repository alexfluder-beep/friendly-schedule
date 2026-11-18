// t181: the service worker downloads only changed files on an update, copies the rest from the old copy,
// and refuses a file that does not match its fingerprint (18 Nov). Plain node, no browser, invented file contents.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const fp = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
class Resp { constructor(t, s = 200) { this.t = t; this.ok = s < 400; this.status = s; } clone() { return new Resp(this.t, this.status); } async arrayBuffer() { return new TextEncoder().encode(this.t).buffer; } }
function phone(oldCaches) {
  const store = new Map(Object.entries(oldCaches).map(([n, m]) => [n, new Map(Object.entries(m))]));
  const cacheObj = n => ({ match: async k => (store.get(n).get(typeof k === 'string' ? k : k.url) || null), put: async (k, r) => { store.get(n).set(k, r); } });
  return { store, caches: { keys: async () => [...store.keys()], open: async n => { if (!store.has(n)) store.set(n, new Map()); return cacheObj(n); }, delete: async n => store.delete(n) } };
}
async function update(site, oldCaches, lie) {
  const files = { ...site, './': site['index.html'] };
  const shell = Object.keys(files).map(f => `'${f}': '${fp(files[f])}'`).join(', ');
  const code = src.replace(/const SHELL = \{.*?\};/, `const SHELL = {${shell}};`).replace(/const CACHE = '[^']+'/, "const CACHE = 'new'");
  const ph = phone(oldCaches), fetched = []; let waiting;
  const served = { ...files, ...(lie || {}) };
  const self = { addEventListener: (t, f) => { if (t === 'install') self.inst = f; }, skipWaiting: async () => {}, registration: {}, clients: {} };
  const ctx = { self, caches: ph.caches, crypto: crypto.webcrypto, URL, TextEncoder, Uint8Array, Array, Promise, Object, Error,
    Request: class { constructor(u) { this.url = u; } },
    fetch: async r => { const f = r.url.split('?')[0]; fetched.push(f); return f in served ? new Resp(served[f]) : new Resp('', 404); } };
  vm.runInNewContext(code, ctx);
  let err = null; self.inst({ waitUntil: p => { waiting = p; } }); try { await waiting; } catch (e) { err = e; }
  return { fetched, err, cache: ph.store.get('new'), fp };
}
(async () => {
  const v1 = { 'index.html': '<html>one</html>', 'app.js': 'app one', 'styles.css': 'css one' };
  const r1 = await update(v1, {});
  ok(!r1.err && r1.fetched.length === 4, 'first install downloads every file (' + r1.fetched.length + ')');
  const old = { 'v1': Object.fromEntries([...r1.cache]) };
  const v2 = { ...v1, 'styles.css': 'css two' };
  const r2 = await update(v2, old);
  ok(!r2.err && r2.fetched.join() === 'styles.css', 'update downloads only the changed file: ' + r2.fetched.join());
  ok(r2.cache.size === 4 && r2.cache.get('styles.css?h=' + fp('css two')).t === 'css two', 'new copy is complete and holds the new file');
  const r3 = await update({ ...v1, 'app.js': 'app three' }, old, { 'app.js': 'stale app' });
  ok(!!r3.err && /changed app\.js/.test(r3.err.message), 'a file that does not match its fingerprint stops the update');
  ok(!src.includes("SHELL = ['"), 'sw.js uses the fingerprint list');
  console.log(fail ? fail + ' failed' : 'all passed'); process.exit(fail ? 1 : 0);
})();
