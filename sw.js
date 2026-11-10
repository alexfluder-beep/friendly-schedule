// Service worker: keeps the app shell available offline and shows push notifications.
const CACHE = 'fs-shell-v31';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'catalog.js', 'icons.js', 'i18n.js', 'store.js', 'app.js', 'vendor/qrcode.js', 'vendor/supabase.js', 'vendor/591.supabase.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'badge-96.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Network first, so updates arrive straight away; cached copy only when offline.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
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
