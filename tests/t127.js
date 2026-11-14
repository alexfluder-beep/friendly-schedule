// Setmore import: payments for guests the app already has. A missing USD price and payment status are filled, a different price is only
// listed until it is tapped, nothing else changes. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 375, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
  const ids = await p.evaluate(async () => { const S = window.Store, g = S.db.profiles.find(x => x.role === 'guide').id, t = { id: S.uid(), date: '2026-10-05', start_time: '10:00', title: 'Pay Test Tour', kind: 'private', capacity: 0, pax: 4, status: 'confirmed', guide_id: g };
    await S.save('tours', t); const mk = async (guest, price, payment) => { const x = { id: S.uid(), tour_id: t.id, guest, adults: 1, children: 0, pax: 1, price, currency: price ? 'USD' : null, payment }; await S.save('bookings', x); return x.id; };
    return { a: await mk('Pay Alpha', null, null), b: await mk('Pay Bravo', 30, null), c: await mk('Pay Charlie', 109, 'prepaid'), d: await mk('Pay Delta', null, null) }; });
  const head = ['Appointment date', 'Appointment time', 'Customer name', 'Customer ID', 'Service/class/event', 'Meeting Type', 'Cost', 'Team member', 'Country code ', 'Phone', 'Email', 'Label', 'Status', 'Comments ', 'Booking ID', 'Booked on ', 'Address', 'No of participa', 'Comments'];
  const row = (name, cost, label, cid) => ['5 Oct 2026', '10:00 AM - 04:00 PM', name, cid, 'Pay Test Tour', 'Service', cost, 'Aleksi', '', '', '', label, 'Confirmed', '', 'ID' + cid, '1 Oct 2026 10:00 AM', '', '1', ''];
  await p.evaluate(({ head, rows }) => { const T = window.__test; T.setImp(T.parseSetmore([head, ...rows])); }, { head, rows: [row('Pay Alpha', 150, 'online', 'c1'), row('Pay Bravo', 114, 'online', 'c2'), row('Pay Charlie', 80, 'online', 'c3'), row('Pay Delta', 0, 'online', 'c4'), row('Nobody Here', 99, 'online', 'c5')] });
  // go through the screen: Back office > import > Check payments
  await p.evaluate(() => document.querySelector('.nav [data-v=admin]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('[data-act=admintab][data-v=import]'); b && b.click(); }); await p.waitForTimeout(400);
  ok(await p.locator('[data-act=imppaycheck]').count() === 1, 'import screen shows "Check payments"');
  await p.evaluate(() => document.querySelector('[data-act=imppaycheck]').click()); await p.waitForTimeout(600);
  const txt = await p.evaluate(() => document.body.innerText);
  ok(/1 prices and 2 payment statuses can be filled\. 2 prices differ/.test(txt), 'found line: ' + (txt.match(/\d+ prices and \d+ payment statuses[^\n]*/) || ['none'])[0]);
  ok(/Pay Charlie: 109 → 80 USD/.test(txt), 'the different price is listed (109 → 80)');
  await p.evaluate(() => document.querySelector('[data-act=imppay]').click()); await p.waitForTimeout(600);
  const st = await p.evaluate(ids => Object.fromEntries(Object.entries(ids).map(([k, id]) => { const x = window.Store.db.bookings.find(y => y.id === id); return [k, [x.price, x.currency, x.payment]]; })), ids);
  ok(String(st.a[0]) === '150' && st.a[1] === 'USD' && st.a[2] === 'prepaid', 'Alpha: price 150 USD, prepaid ' + JSON.stringify(st.a));
  ok(String(st.b[0]) === '30' && st.b[2] === 'prepaid', 'Bravo: own price 30 kept, payment filled ' + JSON.stringify(st.b));
  ok(String(st.c[0]) === '109', 'Charlie: price not changed without a tap ' + JSON.stringify(st.c));
  ok(st.d[0] === null && st.d[2] === null, 'Delta: file cost 0 writes nothing ' + JSON.stringify(st.d));
  await p.evaluate(() => { const r = [...document.querySelectorAll('[data-act=impuse]')].find(x => /Pay Charlie/.test(x.parentElement.innerText)); r.click(); }); await p.waitForTimeout(600);
  ok(await p.evaluate(id => String(window.Store.db.bookings.find(y => y.id === id).price), ids.c) === '80', 'tap "Use 80 USD" changes Charlie to 80');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
