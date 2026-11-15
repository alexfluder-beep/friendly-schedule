// Guide home: third block "My earnings" next to next tour / next day off, aligned; month cells show payment (office) or own pay (guide). Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
    await p.selectOption('#demo-as', { label: 'Mariam (sample) · Guide' }); await p.waitForTimeout(700);
    const n = await p.locator('.nextrow .earnc').count(); ok(n === 1, W + ': earnings block on guide home');
    if (n) {
      const t = await p.locator('.nextrow .earnc').innerText(); ok(/earnings/i.test(t) && /\d/.test(t), W + ': block shows earnings number: ' + t.replace(/\n/g, ' | '));
      const g = await p.evaluate(() => { const row = document.querySelector('.nextrow').getBoundingClientRect(); const cs = [...document.querySelectorAll('.nextrow > *')].map(e => e.getBoundingClientRect()); return { inside: cs.every(r => r.left >= row.left - 1 && r.right <= row.right + 1), hscroll: document.documentElement.scrollWidth > innerWidth + 1, n: cs.length, sameTop: innerWidth > 1000 ? cs.every(r => Math.abs(r.top - cs[0].top) < 3) : true }; });
      ok(g.inside && !g.hscroll && (g.n === 3 || (W < 500 && g.n >= 1)) && g.sameTop, W + ': three blocks aligned ' + JSON.stringify(g));
      await p.locator('.nextrow .earnc').click(); await p.waitForTimeout(400); ok(await p.locator('#modal .prow').count() > 0 && await p.locator('#modal .earnhero .bignum').count() === 1, W + ': tap opens own statement');
      ok(await p.locator('#modal input.pinp').count() === 0 && await p.locator('#modal .paydash').innerText().then(x => !/Commission|Paid online/.test(x)), W + ': guide sees no edit fields, no commission');
    }
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
