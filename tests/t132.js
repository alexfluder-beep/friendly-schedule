// Month view on a computer: a tour of several days is one bar across its days, not a chip in every day. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
  await p.evaluate(async () => { const S = window.Store, n = new Date(), k = (n.getDay() + 6) % 7, m = new Date(n.getTime() - k * 864e5), f = d => new Date(d.getTime()).toISOString().slice(0, 10);
    const t = { id: S.uid(), date: f(new Date(m.getTime() + 864e5)), date_to: f(new Date(m.getTime() + 3 * 864e5)), start_time: '07:00', title: 'Multi Day Test Tour', kind: 'private', capacity: 0, pax: 2, adults: 2, children: 0, status: 'confirmed', guide_id: S.db.profiles.find(x => x.role === 'guide').id, driver_id: null, language: 'EN' };
    await S.save('tours', t); });
  await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const m = document.querySelector('[data-act=mode][data-m=month]'); if (m) m.click(); }); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const bars = [...document.querySelectorAll('.mbar')].filter(e => /Multi Day Test/.test(e.innerText)); const cell = document.querySelector('.mgrid button[data-act=pickday]').getBoundingClientRect().width; return { n: bars.length, w: bars[0] ? bars[0].getBoundingClientRect().width : 0, cell, chips: [...document.querySelectorAll('.mrows .mrow:not(.lane)')].filter(e => /Multi Day Test/.test(e.innerText)).length }; });
  ok(r.n === 1, 'one bar for the 3-day tour (' + r.n + ')');
  ok(r.w > r.cell * 2.5, 'the bar is about three days wide (' + Math.round(r.w) + ' vs cell ' + Math.round(r.cell) + ')');
  ok(r.chips === 0, 'no separate chip per day');
  await p.evaluate(() => [...document.querySelectorAll('.mbar')].find(e => /Multi Day Test/.test(e.innerText)).click()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => /Multi Day Test Tour/.test((document.querySelector('.sheet') || {}).innerText || '')), 'clicking the bar opens the tour');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
