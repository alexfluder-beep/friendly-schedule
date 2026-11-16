// Pay typed in another currency (owner, 16 Nov, option 1): next to each tour's pay on the statement there is a currency picker; typing
// 100 USD when the pay currency is GEL shows the conversion at the tour day's rate before ✓, and ✓ saves the converted GEL amount.
// Leaving the picker on the pay currency works as before. Nothing sticks out at 375. Invented data only (sample data, manual rate USD 2.70).
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
    await p.evaluate(() => { const t = document.querySelector('.tabs [data-v=admin], [data-v=admin]'); if (t) t.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'admintab'; el.dataset.v = 'pay'; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }); await p.waitForTimeout(300);
    const btn = p.locator('[data-act=prange], [data-act=statement]'); const n = await btn.count(); let found = false;
    for (let i = 0; i < n && !found; i++) { await btn.nth(i).click(); await p.waitForTimeout(300); if (await p.locator('#modal [data-act=paymonth]').count()) await p.locator('#modal [data-act=paymonth]').first().click(); await p.waitForTimeout(300); if (await p.locator('#modal .prow').count()) found = true; else { await p.evaluate(() => { const c = document.querySelector('#modal [data-act=close]'); if (c) c.click(); }); await p.waitForTimeout(200); } }
    ok(found, W + ': a statement with tour lines opened'); if (!found) continue;
    const row = p.locator('#modal .prow').first(), id = (await row.locator('input.pinp').getAttribute('id')).slice(3);
    ok(await row.locator('select.pcursel').count() === 1 && (await row.locator('select.pcursel').inputValue()) === 'GEL', W + ': currency picker next to the pay, set to the pay currency (GEL)');
    await row.locator('select.pcursel').selectOption('USD'); await row.locator('input.pinp').fill('100'); await p.waitForTimeout(200);
    const conv = await row.locator('.pconv').innerText(); ok(/100 USD = 270 GEL \(1 USD = 2\.7 GEL/.test(conv), W + ': shows the conversion before saving: ' + conv);
    ok(!(await row.locator('[data-act=paysave]').isDisabled()), W + ': ✓ is ready');
    await row.locator('[data-act=paysave]').click(); await p.waitForTimeout(600);
    const pay = await p.evaluate(id => { const t = window.Store.db.tours.find(x => x.id === id); return [t.guide_pay, t.driver_pay].filter(v => v !== null && v !== undefined); }, id);
    ok(pay.includes(270), W + ': saved 270 GEL on the tour: ' + JSON.stringify(pay));
    const r2 = p.locator('#modal .prow', { has: p.locator('#pi-' + id) }); { const sv = await r2.locator('select.pcursel').inputValue().catch(e => 'ERR ' + e.message.slice(0, 60)), iv = await r2.locator('input.pinp').inputValue().catch(e => 'ERR'); ok(sv === 'GEL' && iv === '270', W + ': after saving the row shows 270 GEL: ' + sv + ' ' + iv); }
    // same currency: plain save as before
    await r2.locator('input.pinp').fill('77'); await p.waitForTimeout(150); ok((await r2.locator('.pconv').innerText()) === '', W + ': no conversion line in the pay currency');
    await r2.locator('[data-act=paysave]').click(); await p.waitForTimeout(500);
    ok(await p.evaluate(id => { const t = window.Store.db.tours.find(x => x.id === id); return t.guide_pay === 77 || t.driver_pay === 77; }, id), W + ': 77 GEL saved as typed');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#modal .prow .pa > *')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), W + ': nothing sticks out');
    await p.context().close(); }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
