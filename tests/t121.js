const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(), errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    await p.click('.tabs [data-v=me], .nav [data-v=me]').catch(() => p.evaluate(() => document.querySelector('[data-act=view][data-v=me]').click())); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-act=metab][data-v=stats]').click()); await p.waitForTimeout(400);
    await p.selectOption('#stat-user', { label: 'Nino (sample)' }); await p.waitForTimeout(500);
    const hl = p.locator('.card.hl'); ok(await hl.count() >= 1, w + ' highlights card');
    const txt = await hl.first().innerText(); ok(/To do better next week and month/.test(txt), w + ' improvement heading');
    ok(await hl.first().locator('.hn').count() >= 1, w + ' at least one line (tip or "nothing to fix")');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways');
    await hl.first().scrollIntoViewIfNeeded(); await p.screenshot({ path: `s121-${w}.png` }); console.log(txt.split('\n').filter(x => x.trim()).slice(-5).join(' | ').slice(0, 400));
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
