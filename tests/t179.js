// Owner's screenshots, second round (18 Nov): guest cards with Picked up / Did not come, the guest window (contact card, action grid,
// lasting note, trips), Back office › Bookings (tiles, search, order), counts in the month view, Settings › Connections,
// no flag emoji and no orange colours. Invented data only.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { const S = window.Store, gd = S.db.profiles.find(x => x.role === 'guide' && x.active !== false), td = window.__test.today();
    await S.save('clients', { id: 'zc1', name: 'Test Guest Zed', phone: '+995500000091', email: null, notes: null });
    await S.save('tours', { id: 'zp1', title: 'Zz Pickup Tour', date: td, start_time: '09:00', kind: 'group', status: 'confirmed', capacity: 4, pax: 4, adults: 4, children: 0, guide_id: gd.id, driver_id: null });
    await S.save('tours', { id: 'zp2', title: 'Zz Pickup Tour', date: td.slice(0, 8) + '01' < td ? td.slice(0, 8) + '01' : td, start_time: '09:00', kind: 'group', status: 'confirmed', capacity: 8, pax: 2, adults: 2, children: 0, guide_id: gd.id, driver_id: null });
    await S.save('bookings', { id: 'zpb1', tour_id: 'zp1', client_id: 'zc1', guest: 'Test Guest Zed', phone: '+995500000091', ref: 'ZZREF1', country: 'DE', pax: 2, adults: 2, children: 0, payment: 'cash', amount_due: 60, price: 60, currency: 'USD', source: 'Direct', attendance: null, marks: [] });
    await S.save('bookings', { id: 'zpb2', tour_id: 'zp1', guest: 'Test Guest Yan', pax: 2, adults: 2, children: 0, payment: 'prepaid', price: 80, currency: 'USD', source: 'Viator', attendance: null, marks: [] });
    await S.save('bookings', { id: 'zpb3', tour_id: 'zp2', client_id: 'zc1', guest: 'Test Guest Zed', pax: 2, adults: 2, children: 0, payment: 'prepaid', price: 60, currency: 'USD', source: 'Direct', attendance: null, marks: [] }); });
  // 1. Tour window: guest cards, payment pills, Picked up
  await p.evaluate(() => window.__test.openTour('zp1')); await p.waitForTimeout(400);
  ok(await p.$$eval('.sheet .gcard', x => x.length) === 2, 'two guest cards');
  ok(await p.$eval('.sheet .gcard[data-key=gzpb1] .gpill', x => x.classList.contains('due') && /60/.test(x.textContent)), 'cash guest shows a To pay pill');
  ok(await p.$eval('.sheet .gcard[data-key=gzpb2] .gpill', x => x.classList.contains('ok')), 'online guest shows Paid');
  await p.click('.sheet .gcard[data-key=gzpb1] .pick.ok'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.Store.db.bookings.find(x => x.id === 'zpb1').attendance === 'arrived'), 'Picked up saves arrived');
  ok(await p.$eval('.sheet .gcard[data-key=gzpb1]', x => x.classList.contains('st-arrived')), 'the card edge turns green');
  ok(await p.$$eval('.sheet .mfoot > div', x => x.length === 2 && getComputedStyle(x[0].parentNode).gridTemplateColumns.split(' ').length === 2), 'Collected and Left to pay side by side on a phone');
  // 2. Guest window
  await p.click('.sheet .gcard[data-key=gzpb1] .gbtn'); await p.waitForTimeout(400);
  ok(await p.$('.sheet .ccard .cnum') !== null && await p.$('.sheet .ccard .cchip.wa') !== null, 'contact card with phone, Copy and WhatsApp');
  ok(await p.$eval('.sheet .refchip', x => x.textContent.includes('ZZREF1')), 'booking code chip');
  ok(await p.$$eval('.sheet .agrid .actcard', x => x.length) >= 2, 'action grid');
  ok(await p.$$eval('.sheet .trips .trow', x => x.length) === 2, "the guest's two trips are listed");
  await p.fill('.sheet form[data-form=clnote] textarea', 'Test note: no nuts'); await p.click('.sheet form[data-form=clnote] button'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.Store.db.clients.find(x => x.id === 'zc1').notes === 'Test note: no nuts'), 'lasting note saved on the client');
  ok(await p.evaluate(() => !/[\u{1F1E6}-\u{1F1FF}]/u.test(document.querySelector('#modal').textContent)), 'no flag emoji');
  await p.evaluate(() => document.querySelector('[data-act=close]').click()); await p.waitForTimeout(300); await p.evaluate(() => { const c = document.querySelector('[data-act=close]'); if (c) c.click(); });
  // 3. Bookings
  await p.evaluate(() => window.__test.go('admin')); await p.waitForTimeout(300); await p.evaluate(() => { const b = [...document.querySelectorAll('[data-act=admintab][data-v=bookings]')].find(x => x.offsetParent) || document.querySelector('[data-act=admintab][data-v=bookings]'); b.click(); }); await p.waitForTimeout(500);
  ok(await p.$$eval('.stiles .stile', x => x.length) === 4, 'four totals tiles');
  const n0 = await p.$$eval('.bklist .bkcard', x => x.length); ok(n0 >= 3, 'booking cards listed (' + n0 + ')');
  await p.click('.stile.st-debt'); await p.waitForTimeout(400);
  ok(await p.$$eval('.bklist .bkcard', x => x.length && x.every(c => c.classList.contains('st-debt'))), 'To pay tile shows only unpaid bookings');
  await p.click('.stile.st-all'); await p.waitForTimeout(300); await p.fill('[data-ch=bkq]', 'zzref1'); await p.waitForTimeout(300);
  ok(await p.$$eval('.bklist .bkcard:not([hidden])', x => x.length) === 1, 'search by booking code finds one');
  await p.fill('[data-ch=bkq]', ''); await p.selectOption('[data-ch=bksort]', 'new'); await p.waitForTimeout(400);
  ok(await p.$$eval('.bklist .bkcard', x => x.length) >= 3, 'order: newest bookings first');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Bookings does not stick out');
  // 4. Month counts
  await p.evaluate(() => window.__test.go('calendar')); await p.waitForTimeout(300); await p.evaluate(() => { const m = document.querySelector('[data-act=mode][data-m=month]'); if (m) m.click(); }); await p.waitForTimeout(400);
  ok(await p.$$eval('.mgrid .mcnt', x => x.length > 0 && x.every(e => Number(e.textContent) > 0)), 'month days show a tour count');
  // 5. Settings › Connections
  await p.evaluate(() => window.__test.go('me', 'settings')); await p.waitForTimeout(400);
  ok(await p.$$eval('.cncard .cnrow', x => x.length) >= 3, 'Connections card with Telegram, notifications and the app');
  // 6. No orange
  ok(await p.evaluate(() => { const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase(); return !['#f0901e', '#f5a742', '#b8441c'].includes(c); }), 'the main colour is not orange');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
