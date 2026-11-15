// Office: commission as one table, pay fields visible on the tour form, 48 h tour gets a correct end date, guest money line. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
    await p.evaluate(() => { const t = document.querySelector('[data-v=admin]'); if (t) t.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'admintab'; el.dataset.v = 'money'; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }); await p.waitForTimeout(400);
    const rows = p.locator('.crow'); ok(await rows.count() >= 5, W + ': commission table has a line per platform (' + await rows.count() + ')');
    const r0 = rows.first(); await r0.locator('input[name=percent]').fill('21'); await r0.locator('button').click(); await p.waitForTimeout(600);
    ok(await p.locator('.crow').first().locator('input[name=percent]').inputValue() === '21', W + ': percent kept after Confirm');
    const g = await p.evaluate(() => { const rs = [...document.querySelectorAll('.crow')].map(r => { const a = r.getBoundingClientRect(); return [...r.children].every(c => { const q = c.getBoundingClientRect(); return !q.width || q.right <= a.right + 1 && q.left >= a.left - 1; }); }); const nm = [...document.querySelectorAll('.crow .cname')].map(e => Math.round(e.getBoundingClientRect().left)); const bt = [...document.querySelectorAll('.crow .btn')].map(e => Math.round(e.getBoundingClientRect().right)); return { inside: rs.every(Boolean), nmSame: new Set(nm).size === 1, btSame: new Set(bt).size === 1, h: document.documentElement.scrollWidth > innerWidth + 1 }; });
    ok(g.inside && g.nmSame && g.btSame && !g.h, W + ': commission rows aligned ' + JSON.stringify(g));
    await p.evaluate(() => { const t = document.querySelector('[data-v=calendar]'); if (t) t.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const e = document.querySelector('[data-act=newtour]'); if (e) e.click(); }); await p.waitForSelector('#t-title');
    ok(await p.locator('#t-gpay').isVisible() && await p.locator('#t-dpay').isVisible(), W + ': guide and driver pay fields visible without opening More options');
    await p.fill('#t-title', 'Test long trip'); await p.fill('#t-date', '2026-12-01'); await p.fill('#t-start', '10:00'); await p.fill('#t-dur', '48'); await p.dispatchEvent('#t-dur', 'input'); await p.waitForTimeout(200);
    ok(await p.inputValue('#t-dateto') === '2026-12-03' && /10:00/.test(await p.innerText('#t-endtxt')), W + ': 48 h = ends 3 Dec 10:00 (' + await p.inputValue('#t-dateto') + ' ' + await p.innerText('#t-endtxt') + ')');
    const a = await p.evaluate(() => { const r = e => document.querySelector(e).getBoundingClientRect(); const g = r('#t-gpay'), d = r('#t-dpay'); return { gw: g.width, top: Math.abs(g.top - d.top) < 3 || innerWidth < 500, inside: g.right <= innerWidth && d.right <= innerWidth }; });
    ok(a.top && a.inside, W + ': pay fields aligned side by side and inside the window');
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
