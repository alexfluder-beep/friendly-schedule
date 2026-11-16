// Tasks 9 and 10 (owner, 16 Nov): in "Open tours" a guide without a car sees a notice on private car tours (not 4x4, not walks, no driver)
// but can still ask; a guide cannot ask for a tour in a language not in their profile (no button, a reason instead, and the action refuses);
// a guide with no languages saved is not blocked and is asked to add them. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  await p.selectOption('#demo-as', await p.evaluate(() => window.Store.db.profiles.find(x => /^Mariam/.test(x.name)).id)); await p.waitForTimeout(600);
  await p.evaluate(async () => { const S = window.Store, db = S.db, g = db.profiles.find(x => /^Mariam/.test(x.name)), free = [...Array(12)].map((_, i) => new Date(Date.now() + (i + 2) * 864e5).toISOString().slice(0, 10)).filter(x => !db.tours.some(t => t.date === x && (t.guide_id === g.id || t.driver_id === g.id)) && !db.time_off.some(o => o.user_id === g.id && o.date_from <= x && o.date_to >= x)), d = free[0], e = free[1];
    for (const t of db.tours.filter(x => !x.guide_id)) await S.save('tours', { ...t, guide_id: db.profiles.find(x => x.role === 'guide' && x.id !== g.id).id });   // only our three test tours are open
    await S.save('profiles', { ...g, vehicle: null, cars: [], languages: 'EN' });
    const base = { kind: 'private', start_time: '10:00', end_time: '16:00', status: 'confirmed', capacity: 0, pax: 2, adults: 2, children: 0, guide_id: null, driver_id: null };
    await S.save('tours', { ...base, id: 'zx1', title: 'Zz Mtskheta Private Test', date: d, language: 'EN' });
    await S.save('tours', { ...base, id: 'zx2', title: 'Zz Kazbegi 4x4 Private Test', date: d, start_time: '07:00', language: 'EN' });
    await S.save('tours', { ...base, id: 'zx3', title: 'Zz Sighnaghi Private Test', date: e, language: 'RU' });
  });
  const look = async () => { await p.evaluate(() => { const e = document.querySelector('.tabs [data-v=tasks]'); if (e) e.click(); }); await p.waitForTimeout(400); await p.evaluate(() => { const e = document.querySelector('[data-act=tasksec][data-v=tours]'); if (e) e.click(); }); await p.waitForTimeout(400);
    return p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.xcard .xrow')].filter(r => /Zz /.test(r.textContent)).map(r => [r.textContent.match(/Zz [A-Za-z0-9 ]+Test/)[0], { btn: !!r.querySelector('[data-act=xctake]'), txt: r.textContent.replace(/\s+/g, ' ') }]))); };
  let r = await look();
  const m = r['Zz Mtskheta Private Test'], k = r['Zz Kazbegi 4x4 Private Test'], s = r['Zz Sighnaghi Private Test'];
  ok(m && m.btn && /goes in your own car/.test(m.txt), 'private car tour, no car: notice shown and the button stays');
  ok(k && k.btn && !/own car/.test(k.txt), '4x4 tour: no car notice');
  ok(s && !s.btn && /Not your language/.test(s.txt) && /This tour is in Russian\. Your profile lists English/.test(s.txt), 'Russian tour for an English-only guide: no button, reason shown: ' + (s || {}).txt);
  // the action itself refuses too (e.g. an old screen)
  const sent = await p.evaluate(async () => { const el = document.createElement('button'); el.dataset.id = 'zx3'; el.dataset.role = 'guide'; document.body.appendChild(el); el.dataset.act = 'xctake'; el.click(); await new Promise(r => setTimeout(r, 400)); return window.Store.db.change_requests.some(q => q.tour_id === 'zx3' && q.status === 'pending'); });
  ok(!sent, 'pressing take on the blocked tour sends no request');
  // with a car saved, the car notice goes away
  await p.evaluate(async () => { const S = window.Store, g = S.db.profiles.find(x => /^Mariam/.test(x.name)); await S.save('profiles', { ...g, vehicle: 'sedan' }); });
  r = await look(); ok(!/own car/.test(r['Zz Mtskheta Private Test'].txt), 'with a car saved: no car notice');
  // no languages saved: nothing blocked, a hint to add them
  await p.evaluate(async () => { const S = window.Store, g = S.db.profiles.find(x => /^Mariam/.test(x.name)); await S.save('profiles', { ...g, languages: '' }); });
  r = await look(); ok(r['Zz Sighnaghi Private Test'].btn, 'no languages saved: not blocked');
  ok(await p.evaluate(() => /Add the languages you speak/.test(document.querySelector('.xcard').textContent)), 'and asked to add languages');
  ok(await p.evaluate(() => JSON.stringify(window.__test.myLangs({ languages: 'En, ru, qa' }))) === '["EN","RU","KA"]', 'QA in a profile is read as Georgian (KA)');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
