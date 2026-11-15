// Admin button "Tour cancelled" on a guide's tour request: closes every pending request for that tour. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(400);
  const ids = await p.evaluate(async () => { const S = window.Store, t = S.db.tours.find(x => x.status !== 'cancelled'), us = S.db.profiles.filter(x => x.role === 'guide').slice(0, 2);
    for (const u of us) await S.save('change_requests', { id: S.uid(), tour_id: t.id, user_id: u.id, patch: { guide_id: u.id }, cant: false, swap_with: null, agreed: false, message: null, status: 'pending', created_at: new Date().toISOString(), decided_by: null });
    return { tour: t.id, n: us.length }; });
  ok(ids.n === 2, 'two guides ask for one tour');
  await p.evaluate(() => { document.querySelector('.nav [data-v=admin], .tabs [data-v=admin]').click(); }); await p.waitForTimeout(400); await p.evaluate(() => { document.querySelector('.admmain [data-act=admintab][data-v=requests]').click(); }); await p.waitForTimeout(400);
  ok(await p.locator('[data-act=creqtcx]').count() >= 1, 'button is there');
  await p.locator('[data-act=creqtcx]').first().click(); await p.waitForTimeout(400);
  await p.evaluate(() => { const e = document.querySelector('[data-act=confirmyes]'); if (e) e.click(); }); await p.waitForTimeout(800);
  const left = await p.evaluate(t => window.Store.db.change_requests.filter(x => x.tour_id === t && x.status === 'pending').length, ids.tour);
  const dec = await p.evaluate(t => window.Store.db.change_requests.filter(x => x.tour_id === t && x.status === 'declined').length, ids.tour);
  ok(left === 0 && dec === 2, 'both requests closed (' + left + ' open, ' + dec + ' declined)');
  const tour = await p.evaluate(t => window.Store.db.tours.find(x => x.id === t).status, ids.tour); ok(tour !== 'cancelled', 'the tour itself is not changed');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
