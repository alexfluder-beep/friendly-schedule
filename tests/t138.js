// Duplicates: every pair has a "Not duplicates" button; the pair moves to the "Not duplicates" tab and can be checked again. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(500);
  await p.evaluate(async () => { const S = window.Store, t = S.db.tours.find(x => x.status !== 'cancelled'); for (const i of [1, 2]) await S.save('tours', { ...t, id: S.uid(), title: 'Invented dup tour', date: '2027-01-15', start_time: '09:00', guide_id: null, driver_id: null, pax: 0, adults: 0, children: 0 }); });
  await p.evaluate(() => { document.querySelector('.nav [data-v=admin], .tabs [data-v=admin]').click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('.admmain [data-act=admintab][data-v=dups]').click(); }); await p.waitForTimeout(400);
  ok(await p.locator('[data-act=dupnot]').count() >= 1, 'Not duplicates button is on the pair');
  await p.locator('[data-act=dupnot]').first().click(); await p.waitForTimeout(700);
  ok(await p.evaluate(() => (((window.Store.db.settings.find(s => s.id === 'nodups') || {}).value || {}).keys || []).length) === 1, 'pair remembered');
  await p.evaluate(() => { document.querySelector('[data-act=dupview][data-b=sep]').click(); }); await p.waitForTimeout(400);
  ok(await p.locator('[data-act=dupagain]').count() >= 1, 'pair is in the Not duplicates tab with Check again');
  await p.locator('[data-act=dupagain]').first().click(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => (((window.Store.db.settings.find(s => s.id === 'nodups') || {}).value || {}).keys || []).length) === 0, 'check again forgets it');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
