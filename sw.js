// Service worker: keeps the app shell available offline and shows push notifications.
const CACHE = 'fs-shell-v26';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'catalog.js', 'icons.js', 'i18n.js', 'store.js', 'app.js', 'vendor/qrcode.js', 'vendor/supabase.js', 'vendor/591.supabase.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
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
  e.waitUntil(self.registration.showNotification(d.title || 'Friendly Schedule', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'fs' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
