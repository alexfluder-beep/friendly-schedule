// Hot fix 17 Nov: a pasted Viator small-group booking at 10:30 must not be offered for the 08:00 private tour of the same name on that day;
// a 10:30 group tour is matched. Calendar cards show up to 3 guest names (+N), office everywhere, staff only on their own tours. Invented data only.
const { chromium } = require('playwright');
const MAIL = `Booking Details\nBooking Reference: BR-2000000077\nTour Name: Brutal Tbilisi: Urban exploration and untold stories\nTravel Date: Fri, Dec 04, 2026\nLead Traveler Name: Zed Tester\nTravelers: 1 Adult\nTour Grade: Small Group Car (Max 6 ppl) 10:30\nTour Grade Code: TG7~10:30\nTour Language: English - Guide\nNet Rate: USD $49.50\nMeeting Point: Sample Hotel, 1 Test Square, T'bilisi 0105, Georgia\nPhone: (Alternate Phone)CL+56 900000000`;
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  const r = await p.evaluate(async t => { const S = window.Store, T = window.__test, base = { date: '2026-12-04', end_time: '15:00', status: 'confirmed', capacity: 6, pax: 2, adults: 2, children: 0, guide_id: null, driver_id: null };
    await S.save('tours', { ...base, id: 'zb1', title: 'Brutal Tbilisi private', kind: 'private', start_time: '08:00' });
    const pb = T.parseBooking(t), only = T.pbMatch(pb).tour;
    await S.save('tours', { ...base, id: 'zb2', title: 'Brutal Tbilisi group', kind: 'group', start_time: '10:30' });
    const both = T.pbMatch(pb).tour; return { kind: pb.kind, time: pb.time, only, both }; }, MAIL);
  ok(r.kind === 'group' && r.time === '10:30', 'the e-mail is read as group, 10:30');
  ok(r.only === null, 'not offered for the 08:00 private tour: ' + r.only);
  ok(r.both === 'zb2', 'matched to the 10:30 group tour: ' + r.both);
  // names on the card
  const g = await p.evaluate(async () => { const S = window.Store, d = new Date(Date.now() + 864e5).toISOString().slice(0, 10), gd = S.db.profiles.find(x => /^Mariam/.test(x.name));
    await S.save('tours', { id: 'zn1', title: 'Zz Names Card Test', kind: 'group', date: d, start_time: '11:00', end_time: '13:00', status: 'confirmed', capacity: 15, pax: 5, adults: 5, children: 0, guide_id: gd.id, driver_id: null });
    for (const [i, n] of ['Zed Tester', 'Yan Tester', 'Guest', 'Xi Tester', 'Wu Tester PACK'].entries()) await S.save('bookings', { id: 'znb' + i, tour_id: 'zn1', guest: n, adults: 1, children: 0, pax: 1, marks: [] });
    S.state && 0; return { gid: gd.id, d }; });
  await p.evaluate(d => { window.__test.openTour && 0; }, g.d);
  const cardText = async () => p.evaluate(() => { const c = [...document.querySelectorAll('.acard')].find(x => /Zz Names Card Test/.test(x.textContent)); return c ? ((c.querySelector('.gnames') || {}).textContent || '') : null; });
  await p.evaluate(() => { const e = document.querySelector('[data-act=nav][data-v="1"], [data-act=nav]'); }); await p.evaluate(() => document.querySelector('.tabs [data-v=calendar]').click()); await p.waitForTimeout(500);
  let t = await cardText(); if (t === null) { await p.evaluate(d => { const e = document.querySelector(`.strip [data-date="${d}"]`); if (e) e.click(); }, g.d); await p.waitForTimeout(500); t = await cardText(); }
  ok(t === 'personZed T., Yan T., Xi T. +1' || /Zed T\., Yan T\., Xi T\. \+1/.test(t || ''), 'office sees 3 names and +1, "Guest" left out, tags cleaned: ' + t);
  ok(await p.evaluate(() => { const c = [...document.querySelectorAll('.acard')].find(x => /Zz Names Card Test/.test(x.textContent)), n = c && c.querySelector('.gnames'); return !!n && n.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1; }), 'the names line stays inside the card');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
