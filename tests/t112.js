const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('.nav [data-v=me]').click()); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('[data-act=metab][data-v=stats]').click()); await p.waitForTimeout(300);
  await p.selectOption('#stat-user', { label: 'Nino (sample)' }); await p.waitForTimeout(400);
  const h = await p.evaluate(() => document.body.innerText);
  ok(/Days per month/.test(h), w + ' days chart'); ok(/Team highlights/.test(h), w + ' compare section');
  await p.evaluate(() => { const d = document.querySelector('details.cmp'); if (d) d.open = true; }); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
  await p.screenshot({ path: `s112-${w}.png`, fullPage: true });
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
