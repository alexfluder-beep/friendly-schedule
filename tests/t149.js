// Pay statement (office): per-tour pay field with Edit / Confirm / Delete, corrections list with date and edit/delete, cash/online/commission dashboard. Buttons stay inside the window and aligned at 375 and 1280. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
    await p.evaluate(() => { const t = document.querySelector('.tabs [data-v=admin], [data-act=viewNow][data-v=admin], [data-v=admin]'); if (t) t.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'admintab'; el.dataset.v = 'pay'; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }); await p.waitForTimeout(300);
    const btn = p.locator('[data-act=prange], [data-act=statement]'); const n = await btn.count(); ok(n > 0, W + ': pay tab lists people');
    let found = false;
    for (let i = 0; i < n && !found; i++) {
      await btn.nth(i).click(); await p.waitForTimeout(300);
      if (await p.locator('#modal [data-act=paymonth]').count()) await p.locator('#modal [data-act=paymonth]').first().click(); await p.waitForTimeout(300);
      if (await p.locator('#modal .prow').count()) found = true; else { await p.keyboard.press('Escape'); await p.evaluate(() => { const c = document.querySelector('#modal [data-act=close]'); if (c) c.click(); }); await p.waitForTimeout(200); }
    }
    ok(found, W + ': a statement with tour lines opened'); if (!found) continue;
    const m = '#modal';
    ok(await p.locator(m + ' .paydash').count() === 1, W + ': dashboard shown');
    const dash = await p.locator(m + ' .paydash').innerText(); ok(/Cash collected/.test(dash) && /Commission/.test(dash) && /Paid online/.test(dash), W + ': dashboard has earned, cash, online, commission');
    const row = p.locator(m + ' .prow').first(); const rt = await row.innerText(); ok(/people/.test(rt) && /(Group|Private)/.test(rt), W + ': row shows people and group/private');
    ok(/Confirm/.test(rt) && /Delete/.test(rt) && !/Edit/.test(rt), W + ': row has Confirm and Delete, no Edit step');
    // edit then confirm
    const inp = row.locator('input.pinp').first(); const oldv = await inp.inputValue(); ok(await inp.getAttribute('readonly') === null && await row.locator('[data-act=paysave]').first().isDisabled(), W + ': field open, Confirm waits for a change');
    const row2 = p.locator(m + ' .prow').first(); await row2.locator('input.pinp').first().fill('77'); await row2.locator('[data-act=paysave]').first().click(); await p.waitForTimeout(500);
    ok(await p.locator(m + ' .prow').first().locator('input.pinp').first().inputValue() === '77', W + ': confirmed amount shows 77 (was ' + oldv + ')');
    // delete asks first
    await p.locator(m + ' .prow').first().locator('[data-act=paydel]').first().click(); await p.waitForTimeout(300);
    ok(/Remove this amount/.test(await p.locator('#modal').innerText()), W + ': delete asks Are you sure');
    await p.locator('[data-act=confirmyes]').click(); await p.waitForTimeout(500);
    ok(await p.locator(m + ' .prow').first().locator('input.pinp').first().inputValue() !== '77', W + ': pay back to standard after delete');
    // correction
    await p.fill('#adj-amount', '15'); await p.fill('#adj-note', 'test fix'); await p.fill('#adj-date', '2026-11-03'); await p.locator('.adjform button').click(); await p.waitForTimeout(500);
    const av = await p.evaluate(() => [...document.querySelectorAll('#modal .adjlist input')].map(i => i.value).join('|')); ok(/15/.test(av) && /test fix/.test(av) && /2026-11-03/.test(av), W + ': correction listed open with amount, reason, chosen date: ' + av);
    await p.fill('[id^=ae-amt-]', '20'); await p.locator(m + ' .adjlist [data-act=adjsave]').click(); await p.waitForTimeout(500);
    ok(/20/.test(await p.evaluate(() => document.querySelector('#modal .adjlist input').value)), W + ': correction edited');
    await p.locator(m + ' .adjlist [data-act=adjdel]').click(); await p.waitForTimeout(300); ok(/sure/.test(await p.locator('#modal').innerText()), W + ': correction delete asks');
    await p.locator('[data-act=confirmyes]').click(); await p.waitForTimeout(500); ok(await p.locator(m + ' .adjlist').count() === 0, W + ': correction deleted');
    // cash field
    await p.fill('#cash-val', '10'); await p.locator('.cashfix button').first().click(); await p.waitForTimeout(500);
    ok(await p.inputValue('#cash-val') === '10', W + ': cash corrected to 10'); ok(await p.locator('[data-act=cashreset]').count() === 1, W + ': back-to-automatic button');
    // alignment: nothing sticks out of the window, buttons inside their row
    const geo = await p.evaluate(() => { const sh = document.querySelector('#modal .sheet') || document.querySelector('#modal'); const sr = sh.getBoundingClientRect(); const bad = []; sh.querySelectorAll('.prow, .prow button, .prow input, .paydash .stat, .cashfix *, .adjform *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > sr.right + 1 || r.left < sr.left - 1)) bad.push(e.className || e.tagName); }); const rw = document.querySelector('#modal .prow'); const kids = [...rw.querySelectorAll('button')].map(e => e.getBoundingClientRect()); const tops = kids.map(k => Math.round(k.top)); const hs = kids.map(k => Math.round(k.height)); return { bad, tops, hs, hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 || sh.scrollWidth > sh.clientWidth + 1 }; });
    ok(!geo.bad.length, W + ': nothing outside the window ' + geo.bad.join(','));
    ok(!geo.hscroll, W + ': no sideways scroll');
    ok(Math.max(...geo.tops) - Math.min(...geo.tops) < 4 && Math.min(...geo.hs) >= 32, W + ': row buttons on one line and 32px+ tall ' + geo.tops + ' ' + geo.hs);
    await p.evaluate(() => { const r = document.querySelector('#modal .prow'); if (r) r.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(150); await p.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/pay-' + W + '.png' : '/tmp/pay-' + W + '.png', fullPage: false });
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
