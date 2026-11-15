// Several guides on one tour: "Add guide", own pay for each, saved, shown on the extra guide's own statement. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
    await p.evaluate(() => { const e = document.querySelector('[data-act=newtour]'); if (e) e.click(); }); await p.waitForSelector('#t-title');
    await p.fill('#t-title', 'Test big group ' + W); await p.fill('#t-date', '2026-11-20'); await p.fill('#t-start', '10:00');
    await p.click('[data-act=xgadd]'); await p.waitForTimeout(200);
    const sel = p.locator('select[data-xf=id]').first(); const vals = await sel.locator('option').evaluateAll(o => o.map(x => x.value).filter(Boolean)); ok(vals.length > 1, W + ': extra guide list has people');
    await sel.selectOption(vals[vals.length - 1]); await p.fill('input[data-xf=pay]', '77'); await p.waitForTimeout(100);
    const g = await p.evaluate(() => { const r = [...document.querySelectorAll('.xg > *')].filter(e => e.getBoundingClientRect().width).map(e => e.getBoundingClientRect()); const f = document.querySelector('.xg').getBoundingClientRect(); return { inside: r.every(q => q.right <= f.right + 1 && q.left >= f.left - 1), one: Math.max(...r.map(q => q.top + q.height / 2)) - Math.min(...r.map(q => q.top + q.height / 2)) < 4 }; });
    ok(g.inside && g.one, W + ': extra guide row aligned on one line ' + JSON.stringify(g));
    await p.click('form[data-form=tour] > .actions button.primary'); await p.waitForTimeout(600);
    const who = vals[vals.length - 1];
    const saved = await p.evaluate(async (w) => { const key = Object.keys(localStorage).find(k => /demo|fs-/.test(k) && (localStorage.getItem(k) || '').includes('Test big group')); return !!key; }, who);
    // the extra guide's own statement lists the tour with 77
    const nm = await p.evaluate(w => { const o = [...document.querySelectorAll('#demo-as option')].find(x => x.textContent.includes('Guide')); return o ? o.value : ''; }, who);
    const name = sel ? '' : '';
    await p.selectOption('#demo-as', { label: await p.evaluate(w => { const o = document.querySelector('#demo-as option[value="' + w + '"]'); return o ? o.textContent : ''; }, who) }).catch(() => {});
    await p.waitForTimeout(700);
    await p.evaluate(() => { const e = document.querySelector('.earnc'); if (e) e.click(); }); await p.waitForTimeout(500);
    const txt = await p.locator('#modal').innerText().catch(() => ''); ok(/Test big group/.test(txt) && /77/.test(txt), W + ': extra guide sees the tour with pay 77 in own statement');
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
