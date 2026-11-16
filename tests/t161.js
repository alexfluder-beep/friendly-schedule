// Pre-trip reminders as e-mail: subject + body with guide, car, meeting point and pick-up time; one draft per booking and one for the tour.
// The share sheet shows To / Subject and a mailto link; the app sends nothing. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; window.__noNativeShare = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(700);
  const r = await p.evaluate(async () => { const db = window.Store.db, S = window.Store, today = new Date().toISOString().slice(0, 10);
    const g = db.profiles.find(x => x.role === 'guide'), d = db.profiles.find(x => x.role === 'driver');
    await S.save('profiles', { ...g, phone: '+995 500 000 001' }); await S.save('profiles', { ...d, phone: '+995 500 000 002', cars: [{ model: 'Sample Van', color: 'white', plate: 'ZZ-000-ZZ', seats: 7 }] });
    await S.save('tours', { id: 'zt1', title: 'Kazbegi test tour', kind: 'private', date: today, date_to: null, start_time: '09:00', end_time: '19:00', pickup: 'Freedom Square', guide_id: g.id, driver_id: d.id, status: 'confirmed', capacity: 0, pax: 3, adults: 3, children: 0, language: 'EN' });
    await S.save('clients', { id: 'zc1', name: 'Zed Tester', phone: '', email: 'zed.tester@example.com' }); await S.save('clients', { id: 'zc2', name: 'Yan Tester', phone: '', email: '' });
    await S.save('bookings', { id: 'zb1', tour_id: 'zt1', client_id: 'zc1', guest: 'Zed Tester', adults: 2, children: 0, pax: 2, phone: '', ref: 'ZZ1', notes: '', marks: ['pickup'], pickup_addr: 'Sample Hotel, Test Street 1', payment: 'cash', amount_due: 150, currency: 'GEL' });
    await S.save('bookings', { id: 'zb2', tour_id: 'zt1', client_id: 'zc2', guest: 'Yan Tester', adults: 1, children: 0, pax: 1, phone: '', ref: 'ZZ2', notes: '', marks: [], payment: 'paid' });
    return { one: window.__test.preTripMail('zt1', 'zb1'), all: window.__test.preTripMail('zt1') }; });
  const o = r.one, a = r.all;
  ok(/^Friendly\.ge: Kazbegi test tour, .* 09:00$/.test(o.subject), 'subject has tour, date and time: ' + o.subject);
  ok(o.to === 'zed.tester@example.com', 'to = guest e-mail');
  ok(o.body.startsWith('Hello Zed Tester,'), 'greets the guest by name');
  ok(/Pick-up time: 09:00/.test(o.body) && /Pick-up address: Sample Hotel, Test Street 1/.test(o.body) && /Map: https:\/\/www\.google\.com\/maps/.test(o.body), 'pick-up time, address and map link');
  ok(/Your guide: .*\+995 500 000 001\./.test(o.body) && /Your driver: .*\+995 500 000 002\./.test(o.body), 'guide and driver with phones');
  ok(/Car: Sample Van, [^,]+, ZZ-000-ZZ\./.test(o.body), 'car model, colour, plate: ' + (o.body.match(/Car: .*/) || [''])[0]);
  ok(/Please have 150 GEL in cash/.test(o.body), 'cash due of this booking only');
  ok(/Friendly tips: please bring warm layers/.test(o.body), 'Kazbegi tip');
  ok(/^Hello,/.test(a.body) && /Meeting point: Freedom Square/.test(a.body) && /Start time: 09:00/.test(a.body) && !/Sample Hotel/.test(a.body), 'tour-level draft: meeting point, start time, no private address');
  ok(a.to === '', 'tour-level draft has no single recipient');
  // the sheet: open the tour, open Guest reminders, press E-mail on the first booking
  await p.evaluate(() => window.__test.openTour('zt1')); await p.waitForTimeout(400);
  const sum = p.locator('.sheet details summary', { hasText: 'Guest reminders' }); ok(await sum.count() === 1, 'tour sheet has a Guest reminders section');
  await sum.click(); await p.waitForTimeout(200);
  const rows = await p.locator('.sheet button[data-act="pretrip"]').count(); ok(rows === 3, 'one E-mail button per booking plus one for all guests: ' + rows);
  await p.locator('.sheet button[data-act="pretrip"][data-b="zb1"]').click(); await p.waitForTimeout(400);
  const sheet = await p.evaluate(() => { const s = document.querySelector('.sheet'); if (!s) return null; const a = s.querySelector('a[href^="mailto:"]'); return { text: s.innerText, href: a ? a.getAttribute('href') : '', pre: (s.querySelector('#sh-text') || {}).textContent || '' }; });
  ok(sheet && /E-mail draft/.test(sheet.text) && /zed\.tester@example\.com/.test(sheet.text), 'share sheet shows To and title');
  ok(sheet && sheet.href.startsWith('mailto:zed.tester%40example.com?subject=Friendly.ge') && /body=Hello%20Zed/.test(sheet.href), 'mailto has to, subject and body: ' + (sheet || {}).href.slice(0, 90));
  ok(sheet && /Open in mail program/.test(sheet.text) && /Copy subject and text/.test(sheet.text), 'buttons: open in mail, copy all');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
