// Plus button (owner, 19 Nov, Setmore-like): the add sheet slides up; "Tour" first shows the tour catalogue as a searchable list,
// and a chosen tour opens already filled in. Invented data only (the catalogue is the shipped starting list).
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  await p.click('.fab'); await p.waitForSelector('#modal .sheet.actsheet');
  ok(await p.$('#modal .fabmenu [data-act=tourpick]') !== null, 'add sheet has Tour, opening the tour list');
  await p.click('#modal [data-act=tourpick]'); await p.waitForSelector('#modal .tplist');
  const n = await p.$$eval('#modal .tprow', r => r.length);
  ok(n > 10, 'tour list shows the catalogue (' + n + ' rows)');
  ok(await p.$eval('#modal .tprow:nth-child(2)', e => /\d+:\d+|seats|day|hour/i.test(e.innerText) && !!e.querySelector('.tpdot')), 'rows have colour dot and kind/time/seats');
  await p.fill('#modal [data-tpq]', 'kazbegi');
  const vis = await p.$$eval('#modal .tprow', r => r.filter(x => !x.hidden).map(x => x.querySelector('b').textContent));
  ok(vis.length > 0 && vis.every(t => /kazbegi/i.test(t)), 'search filters: ' + vis.length + ' Kazbegi tours');
  const pick = await p.evaluate(() => { const r = [...document.querySelectorAll('#modal .tprow')].find(x => !x.hidden); r.click(); return r.querySelector('b').textContent; });
  await p.waitForSelector('#t-title');
  const f = await p.evaluate(() => ({ title: document.querySelector('#t-title').value, cap: window.__test.modal().draft.capacity, type: window.__test.modal().type }));
  ok(f.type === 'tour' && f.title === pick, 'chosen tour opens filled: ' + JSON.stringify([f.title, pick]));
  ok(f.cap > 0, 'seats come from the catalogue: ' + f.cap);
  await p.evaluate(() => { window.__test.modal().touched = false; document.querySelector('#modal [data-act=close]').click(); }); await p.waitForTimeout(400);
  await p.click('.fab'); await p.waitForSelector('#modal [data-act=tourpick]'); await p.click('#modal [data-act=tourpick]'); await p.waitForSelector('#modal .tplist');
  await p.click('#modal .tprow[data-i="-1"]'); await p.waitForSelector('#t-title');
  ok(await p.$eval('#t-title', e => e.value === ''), 'Empty tour opens a blank form');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#modal .sheet')).animationName !== 'asup'), 'tour form keeps its own look (not the slide sheet)');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
