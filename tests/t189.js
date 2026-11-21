// A booking e-mail is not offered for another tour just because the start time matches (owner, 21 Nov). Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 400, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  const r = await p.evaluate(async () => { const S = window.Store, td = window.__test.today(); const d = new Date(td + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 20); const day = d.toISOString().slice(0, 10);
    for (const t of S.db.tours.filter(x => x.date === day)) await S.remove('tours', t.id);
    await S.save('tours', { id: 'zm1', date: day, start_time: '08:30', title: 'Brutal Tbilisi private', kind: 'private', status: 'confirmed', adults: 2, children: 0, pax: 2, capacity: 0 });
    const pb = { platform: 'Airbnb', ref: 'TESTREF1', title: '4x4 Rainbow Mountains & Gareji Caves Tour Max 6', date: day, time: '08:30', kind: 'private', adults: 4 };
    const before = window.__test.pbMatch(pb);
    await S.save('tours', { id: 'zm2', date: day, start_time: '08:30', title: 'Gareji 4x4 ENG', kind: 'private', status: 'confirmed', adults: 0, children: 0, pax: 0, capacity: 0 });
    const after = window.__test.pbMatch(pb);
    const walk = window.__test.pbMatch({ ...pb, title: 'Brutal Tbilisi private tour', ref: 'TESTREF2' });
    return { before: before.tour || null, after: after.tour, walk: walk.tour }; });
  ok(r.before === null, 'only another 08:30 tour that day: no tour offered (got ' + r.before + ')');
  ok(r.after === 'zm2', 'the Gareji tour is found once it exists (got ' + r.after + ')');
  ok(r.walk === 'zm1', 'a booking with the right name still finds its tour (got ' + r.walk + ')');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
