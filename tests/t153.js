// One pay number when a person is guide and driver of the same tour: the office sees one field with the total, a change keeps the driver part, the cross puts both back to standard. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.waitForTimeout(900);
    // make one tour of the current month self-driven: the guide is also the driver, guide pay 80 and driver pay 30
    const info = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('fs-demo-v18')); const mo = new Date().toISOString().slice(0, 7); const t = d.tours.find(x => x.guide_id && x.status !== 'cancelled' && x.date.slice(0, 7) === mo); if (!t) return null; t.driver_id = t.guide_id; t.guide_pay = 80; t.driver_pay = 30; localStorage.setItem('fs-demo-v18', JSON.stringify(d)); return { id: t.id, who: t.guide_id, mo }; });
    ok(!!info, W + ': a tour with a guide exists this month'); if (!info) { await p.context().close(); continue; }
    await p.reload(); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
    await p.evaluate(() => { const t = document.querySelector('[data-v=admin]'); if (t) t.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'admintab'; el.dataset.v = 'pay'; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }); await p.waitForTimeout(300);
    await p.evaluate(i => { const el = document.createElement('button'); el.dataset.act = 'statement'; el.dataset.id = i.who; el.dataset.m = i.mo; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }, info); await p.waitForTimeout(500);
    const row = p.locator('#modal .prow').filter({ has: p.locator('#pi-' + info.id) });
    ok(await row.count() === 1 && await row.locator('input.pinp').count() === 1 && await row.locator('input.pinp').inputValue() === '110', W + ': one field shows the total 110 (80 + 30)');
    ok(!/Guide|Driver/.test(await row.innerText()), W + ': no Guide / Driver words in the row');
    await row.locator('input.pinp').fill('120'); await row.locator('[data-act=paysave]').click(); await p.waitForTimeout(700);
    const saved = await p.evaluate(id => { const t = JSON.parse(localStorage.getItem('fs-demo-v18')).tours.find(x => x.id === id); return [t.guide_pay, t.driver_pay]; }, info.id);
    ok(saved[0] === 90 && saved[1] === 30, W + ': 120 saved as guide 90 + driver 30: ' + saved.join(' + '));
    ok(await p.locator('#pi-' + info.id).inputValue() === '120', W + ': field shows 120 after saving');
    await p.locator('#modal .prow').filter({ has: p.locator('#pi-' + info.id) }).locator('[data-act=paydel]').click(); await p.waitForTimeout(300); await p.locator('[data-act=confirmyes]').click(); await p.waitForTimeout(700);
    const after = await p.evaluate(id => { const t = JSON.parse(localStorage.getItem('fs-demo-v18')).tours.find(x => x.id === id); return [t.guide_pay, t.driver_pay]; }, info.id);
    ok(after[0] === null && after[1] === null, W + ': cross puts both back to the standard rate: ' + after.join(' / '));
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
