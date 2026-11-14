// Service worker: keeps the app shell available offline and shows push notifications.
const CACHE = 'fs-shell-v108';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'catalog.js', 'icons.js', 'cute.js', 'i18n-en.js', 'i18n-ru.js', 'i18n-ka.js', 'i18n.js', 'store.js', 'app.js', 'parse.js', 'game.js', 'money.js', 'vendor/qrcode.js', 'vendor/supabase.js', 'vendor/591.supabase.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'badge-96.png'];
// A new version is fetched whole and fresh (past the browser's own cache) before it replaces the old one, so the app never runs a mix of old and new files.
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// The app's own files come from the saved copy of this version: it opens at once, also on a weak connection, and every file is from the same version.
// A new version arrives as a whole (see install above) and the app then offers to reload. Anything not in the saved copy goes to the network.
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
