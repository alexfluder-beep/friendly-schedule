// Offline start in the real (database) mode: the phone has a saved copy, there is no internet, and the guide still sees today's and tomorrow's
// tours with pick-up address and guest phone. The database address is fake and blocked. Invented data only.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const site = path.join(process.cwd(), 'site'), site2 = path.join(process.cwd(), 'site2'); fs.cpSync(site, site2, { recursive: true });
  fs.writeFileSync(path.join(site2, 'config.js'), 'window.APP_CONFIG = { supabaseUrl: "https://fake-offline.supabase.test", supabaseKey: "sb_publishable_fake", vapidPublicKey: "", testBanner: false };');
  const srv = spawn('python3', ['-m', 'http.server', '8766'], { cwd: site2, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1200));
  // 1. build a saved copy from the demo data: one guide, a tour today and one tomorrow, each with a guest who has a phone and a pick-up address
  const demo = await (await b.newContext()).newPage(); await demo.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await demo.goto('http://localhost:8765/index.html'); await demo.waitForFunction(() => window.__test); await demo.waitForTimeout(600);
  const copy = await demo.evaluate(() => { const S = window.Store, db = JSON.parse(JSON.stringify(S.db)), g = db.profiles.find(x => x.role === 'guide'), iso = d => d.toISOString().slice(0, 10), t0 = new Date(), t1 = new Date(Date.now() + 864e5);
    db.tours = []; db.bookings = []; db.clients = [];
    [['Offline Test Walk', iso(t0), '10:00', 'Hotel Offline One, Tbilisi', '+995555000111', 'Anna Test'], ['Offline Test Drive', iso(t1), '09:30', 'Hotel Offline Two, Tbilisi', '+995555000222', 'Ben Test']].forEach(([title, date, time, addr, phone, guest], i) => {
      const t = { id: 'ofl-t' + i, date, date_to: null, start_time: time, end_time: '14:00', title, kind: 'private', capacity: 0, pax: 2, adults: 2, children: 0, language: 'EN', pickup: addr, status: 'confirmed', guide_id: g.id, driver_id: null };
      db.tours.push(t); db.bookings.push({ id: 'ofl-b' + i, tour_id: t.id, guest, adults: 2, children: 0, pax: 2, phone, marks: ['pickup'], pickup_addr: addr, history: [] }); });
    return { me: g, db, at: new Date(Date.now() - 25 * 60000).toISOString(), delCursor: null, loadedFrom: null }; });
  // 2. open the app on the fake-database copy once (online but unreachable), save the copy into the phone storage
  const ctx = await b.newContext({ viewport: { width: 375, height: 800 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.route('https://fake-offline.supabase.test/**', r => r.abort('internetdisconnected'));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8766/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(c => new Promise((res, rej) => { const r = indexedDB.open('friendly-schedule', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(c, 'cache'); tx.oncomplete = res; tx.onerror = rej; }; r.onerror = rej; }), copy);
  await p.close();
  // 3. start again with the phone offline (the app asks the browser, so say it is offline) and no way to reach the database
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.route('https://fake-offline.supabase.test/**', r => r.abort('internetdisconnected'));
  await q.addInitScript(() => { Object.defineProperty(navigator, 'onLine', { get: () => false }); window.__noCelebrate = true; });
  await q.goto('http://localhost:8766/index.html'); await q.waitForTimeout(2500);
  ok(await q.locator('form[data-form=login], #login, [data-form=signin]').count() === 0, 'no login screen while offline');
  await q.evaluate(() => { const n = document.querySelector('.nav [data-v=calendar]'); n && n.click(); }); await q.waitForTimeout(600);
  const body = await q.evaluate(() => document.body.innerText);
  ok(/Offline Test Walk/.test(body), 'today tour is listed offline');
  ok(/Offline Test Drive/.test(body) || await q.evaluate(() => { const n = document.querySelector('.nxt'); return !!n && /Offline Test/.test(n.innerText); }), 'tomorrow tour is listed (or next tour card)');
  ok(/no internet|offline|last update/i.test(await q.locator('.syncrow').first().innerText().catch(() => '')), 'a line says there is no internet and when it was last updated: ' + (await q.locator('.syncrow').first().innerText().catch(() => 'none')).replace(/\s+/g, ' '));
  await q.evaluate(() => { const c = [...document.querySelectorAll('[data-act=tour]')].find(x => /Offline Test Walk/.test(x.innerText)); c && c.click(); }); await q.waitForTimeout(600);
  const sheet = await q.evaluate(() => (document.querySelector('.sheet') || {}).innerText || '');
  ok(/Hotel Offline One/.test(sheet), 'pick-up address shows in the tour (offline)');
  ok(await q.evaluate(() => !![...document.querySelectorAll('.sheet a[href^="tel:"]')].find(a => /555000111/.test(a.getAttribute('href').replace(/\D/g, '')))), 'guest phone is a tap-to-call link (offline)');
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');
  ok(!errs.filter(e => !/fake-offline|Failed to fetch|NetworkError/i.test(e)).length, 'errors ' + errs.join('|'));
  await q.screenshot({ path: 'offline-sheet.png' }); await b.close(); srv.kill(); process.exit(bad); })();
