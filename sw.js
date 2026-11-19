// Service worker: keeps the app shell available offline and shows push notifications.
const CACHE = 'fs-shell-v139';
const SHELL = {'./': 'ba64a6058d4f', 'index.html': 'ba64a6058d4f', 'styles.css': 'b3d8279f83e5', 'config.js': 'e2f8fc2a4d2e', 'catalog.js': 'd6e23538cd92', 'icons.js': 'fac2f27eb6f5', 'cute.js': '60607c1899ab', 'i18n-en.js': '642eed921890', 'i18n-ru.js': '2de852ba6b46', 'i18n-ka.js': '919d3e595df4', 'i18n.js': 'ca66c39e3637', 'store.js': '9897b4dc6e3d', 'app.js': 'c907230d232b', 'parse.js': 'add462882638', 'game.js': '18131fca0fd3', 'money.js': '95e93b5dbeb7', 'vendor/qrcode.js': '79ec86f82856', 'vendor/supabase.js': '8596965fe918', 'vendor/591.supabase.js': '9c305b77dab6', 'manifest.webmanifest': 'c5674186c83b', 'icon-192.png': '48d52afe257e', 'icon-512.png': '4931a4bfce77', 'apple-touch-icon.png': 'ea6f7b3fdf73', 'badge-96.png': 'cd8e2b352e6a'};   /* file -> start of its SHA-256; written by tools/shell-hash.py at each release, never by hand */
// Updating: each file is saved under its own fingerprint (file?h=…). A file whose fingerprint did not change is copied from the
// phone's previous copy; only changed files are downloaded (18 Nov: a fix in one file no longer costs the whole 550 KB).
// A downloaded file must match its fingerprint, otherwise the update stops and is tried again later, so the app never runs a mix of versions.
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
async function fileFor(f, h, olds) {
  const key = f + '?h=' + h;
  for (const o of olds) { const hit = await o.match(key); if (hit) return [key, hit]; }
  const r = await fetch(new Request(key, { cache: 'reload' }));   // the ?h= address also gets past the web host's own short cache
  if (!r.ok) throw new Error('fetch ' + f);
  if (h && hex(await crypto.subtle.digest('SHA-256', await r.clone().arrayBuffer())).slice(0, h.length) !== h) throw new Error('changed ' + f);
  return [key, r];
}
self.addEventListener('install', e => { e.waitUntil((async () => {
  const olds = await Promise.all((await caches.keys()).filter(k => k !== CACHE).map(k => caches.open(k)));
  const got = await Promise.all(Object.entries(SHELL).map(([f, h]) => fileFor(f, h, olds)));
  const c = await caches.open(CACHE); await Promise.all(got.map(([k, r]) => c.put(k, r)));
  await self.skipWaiting();
})()); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// The app's own files come from the saved copy of this version: it opens at once, also on a weak connection, and every file is from the same version.
// A new version arrives complete (see install above) and the app then offers to reload. Anything not in the saved copy goes to the network.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request.mode === 'navigate' ? 'index.html' : e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => c.match('index.html')))));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  // Title says what it is about, the body has the details; tapping opens the right screen of the app.
  e.waitUntil(self.registration.showNotification(d.title || 'Friendly Schedule', { body: d.body || '', icon: 'icon-192.png', badge: 'badge-96.png', tag: d.tag || 'fs', renotify: true, timestamp: Date.now(), vibrate: [80, 40, 80], lang: d.lang || 'en', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs[0]; if (!c) return self.clients.openWindow(url); return (c.navigate ? c.navigate(url).catch(() => c) : Promise.resolve(c)).then(w => (w || c).focus()); }));
});

// The internet is back and changes are still waiting on this device. The app itself sends them (it holds the sign-in), so if it is closed
// the person gets one quiet notice to open it. With the app open nothing is shown: it is already sending.
self.addEventListener('sync', e => {
  if (e.tag !== 'fs-outbox') return;
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); if (open.length) { open.forEach(c => c.postMessage({ type: 'fs-sync' })); return; }
    const n = await new Promise(res => { try { const r = indexedDB.open('friendly-schedule', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onerror = () => res(0); r.onsuccess = () => { try { const q = r.result.transaction('kv').objectStore('kv').get('outbox'); q.onsuccess = () => res((q.result || []).length); q.onerror = () => res(0); } catch (err) { res(0); } }; } catch (err) { res(0); } });
    if (!n || self.Notification.permission !== 'granted') return;
    const l = (await new Promise(res => { try { const r = indexedDB.open('friendly-schedule', 1); r.onsuccess = () => { try { const q = r.result.transaction('kv').objectStore('kv').get('lang'); q.onsuccess = () => res(q.result || 'en'); q.onerror = () => res('en'); } catch (err) { res('en'); } }; r.onerror = () => res('en'); } catch (err) { res('en'); } }));
    const tx = { en: ['Changes are waiting', 'The internet is back. Open the app and your ' + n + ' saved changes are sent.'], ru: ['Изменения ждут отправки', 'Интернет появился. Откройте приложение, и сохранённые изменения (' + n + ') отправятся.'], ka: ['ცვლილებები ელოდება გაგზავნას', 'ინტერნეტი დაბრუნდა. გახსენით აპი და შენახული ცვლილებები (' + n + ') გაიგზავნება.'] }[l] || null;
    await self.registration.showNotification((tx || ['Changes are waiting'])[0], { body: (tx || ['', 'Open the app to send them.'])[1], icon: 'icon-192.png', badge: 'badge-96.png', tag: 'fs-outbox', data: { url: './' } });
  })());
});
