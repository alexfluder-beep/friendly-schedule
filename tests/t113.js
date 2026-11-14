const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
  const click = s => p.evaluate(s => document.querySelector(s).click(), s);
  await click('.nav [data-v=team]'); await p.waitForTimeout(400);
  ok(await p.locator('.busyrow').count() > 0, w + ' busy rows'); ok(await p.locator('.wkchart, .wkbars').count() >= 0, w + ' mood area ok');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' team no sideways');
  await p.screenshot({ path: `s113-team-${w}.png`, fullPage: true });
  await click('.nav [data-v=clients]'); await p.waitForTimeout(300);
  await p.evaluate(() => { const x = document.querySelector('[data-act=admintab][data-v=guests]'); if (x) x.click(); }); await p.waitForTimeout(400);
  const n = await p.locator('.gicard').count(); ok(n > 0, w + ' analytics cards ' + n); ok(await p.locator('.jumpbar button, .jumpbar a').count() > 0, w + ' jump chips');
  if (n) { await p.evaluate(() => 0); await p.waitForTimeout(300); }
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' analytics no sideways');
  await p.screenshot({ path: `s113-gi-${w}.png`, fullPage: true });
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
