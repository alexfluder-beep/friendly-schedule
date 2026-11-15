// Pay statement (office): three numbers (earned, cash collected, company owes), one pay field per tour with tick and cross, corrections as date | reason | amount with tick and cross, one cash field that saves itself. Nothing sticks out at 375 and 1280. Invented data only.
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
    const dash = await p.locator(m + ' .paydash').innerText(); ok(/Cash collected/.test(dash) && /Company owes|Owes the company/.test(dash) && !/Commission|Paid online|Company keeps/.test(dash), W + ': dashboard has cash and company owes, no commission / paid online / company keeps');
    ok(/You earn|Earns/.test(await p.locator(m + ' .earnhero').innerText()) && await p.locator(m + ' .paycur').count() === 0, W + ': big earned number, no three-currency card');
    ok(await p.locator(m + ' .paydash button').filter({ hasText: /Confirm/ }).count() === 0, W + ': no Confirm button for the cash field');
    const row = p.locator(m + ' .prow').first(); const rt = await row.innerText(); ok(/people/.test(rt) && /(Group|Private)/.test(rt), W + ': row shows people and group/private');
    ok(await row.locator('[data-act=paysave]').count() === 1 && await row.locator('[data-act=paydel]').count() === 1 && await row.locator('input.pinp').count() === 1 && !/Edit|Confirm|Delete|Guide|Driver/.test(rt), W + ': one pay field with tick and cross, no words, no Guide/Driver lines');
    // edit then confirm
    const inp = row.locator('input.pinp').first(); const oldv = await inp.inputValue(); ok(await inp.getAttribute('readonly') === null && await row.locator('[data-act=paysave]').first().isDisabled(), W + ': field open, Confirm waits for a change');
    const row2 = p.locator(m + ' .prow').first(); await row2.locator('input.pinp').first().fill('77'); await row2.locator('[data-act=paysave]').first().click(); await p.waitForTimeout(500);
    ok(await p.locator(m + ' .prow').first().locator('input.pinp').first().inputValue() === '77', W + ': confirmed amount shows 77 (was ' + oldv + ')');
    // delete asks first
    await p.locator(m + ' .prow').first().locator('[data-act=paydel]').first().click(); await p.waitForTimeout(300);
    ok(/Remove this amount/.test(await p.locator('#modal').innerText()), W + ': delete asks Are you sure');
    await p.locator('[data-act=confirmyes]').click(); await p.waitForTimeout(500);
    ok(await p.locator(m + ' .prow').first().locator('input.pinp').first().inputValue() !== '77', W + ': pay back to standard after delete');
    // correction: date | reason (text) | amount + currency | tick | cross
    await p.fill('#adj-amount', '15'); await p.fill('#adj-note', 'test fix'); await p.fill('#adj-date', '2026-11-03'); await p.locator('.adjform button').click(); await p.waitForTimeout(500);
    const ar = p.locator(m + ' .adjlist .adjrow').first(); const av = await p.evaluate(() => [...document.querySelectorAll('#modal .adjlist input')].map(i => i.value).join('|'));
    ok(/15/.test(av) && /2026-11-03/.test(av) && await ar.locator('.adjn').innerText() === 'test fix' && await ar.locator('input.adjn').count() === 0, W + ': correction row: date and amount open, reason is plain text: ' + av);
    const rx = await ar.evaluate(r => { const q = c => r.querySelector(c).getBoundingClientRect(); return { d: q('.adjd'), n: q('.adjn'), a: q('.adja'), ok: q('.okbtn'), x: q('.xbtn'), c: q('.adjc') }; });
    ok(W > 560 ? (rx.d.left < rx.n.left && rx.n.left < rx.a.left && rx.a.left < rx.c.left && rx.c.left < rx.ok.left && rx.ok.left < rx.x.left && Math.abs(rx.d.top - rx.x.top) < 30) : (rx.d.left < rx.n.left && rx.d.top < rx.a.top && rx.a.left < rx.c.left && rx.c.left < rx.ok.left && rx.ok.left < rx.x.left && Math.abs(rx.a.top - rx.x.top) < 30), W + ': order date, reason, amount, currency, tick, cross');
    ok(await ar.locator('.okbtn').isDisabled(), W + ': tick waits for a change');
    await p.fill('[id^=ae-amt-]', '20'); await p.fill('[id^=ae-date-]', '2026-11-05'); await p.locator(m + ' .adjlist [data-act=adjsave]').click(); await p.waitForTimeout(500);
    const av2 = await p.evaluate(() => [...document.querySelectorAll('#modal .adjlist input')].map(i => i.value).join('|')); ok(/20/.test(av2) && /2026-11-05/.test(av2), W + ': correction amount and date edited: ' + av2);
    const geo0 = await p.evaluate(() => { const sh = document.querySelector('#modal .sheet') || document.querySelector('#modal'); const sr = sh.getBoundingClientRect(); const bad = []; sh.querySelectorAll('.adjrow, .adjrow *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > sr.right + 1 || r.left < sr.left - 1)) bad.push(e.className || e.tagName); }); return bad; });
    ok(!geo0.length, W + ': correction row inside the window ' + geo0.join(','));
    await p.evaluate(() => { const r = document.querySelector('#modal .adjlist'); if (r) r.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(150); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/adj-' + W + '.png' });
    await p.locator(m + ' .adjlist [data-act=adjdel]').click(); await p.waitForTimeout(300); ok(/sure/.test(await p.locator('#modal').innerText()), W + ': correction delete asks');
    await p.locator('[data-act=confirmyes]').click(); await p.waitForTimeout(500); ok(await p.locator(m + ' .adjlist').count() === 0, W + ': correction deleted');
    // cash: one field, saves itself when changed
    await p.fill('#cash-val', '10'); await p.locator('#cash-val').press('Tab'); await p.waitForTimeout(600);
    ok(await p.inputValue('#cash-val') === '10', W + ': cash corrected to 10 without a Confirm button'); ok(await p.locator('[data-act=cashreset]').count() === 1, W + ': back-to-automatic button');
    // alignment: nothing sticks out of the window, buttons inside their row
    const geo = await p.evaluate(() => { const sh = document.querySelector('#modal .sheet') || document.querySelector('#modal'); const sr = sh.getBoundingClientRect(); const bad = []; sh.querySelectorAll('.prow, .prow button, .prow input, .paydash .stat, .paydash input, .adjform *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > sr.right + 1 || r.left < sr.left - 1)) bad.push(e.className || e.tagName); }); const rw = document.querySelector('#modal .prow'); const kids = [...rw.querySelectorAll('button')].map(e => e.getBoundingClientRect()); const tops = kids.map(k => Math.round(k.top)); const hs = kids.map(k => Math.round(k.height)); return { bad, tops, hs, hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 || sh.scrollWidth > sh.clientWidth + 1 }; });
    ok(!geo.bad.length, W + ': nothing outside the window ' + geo.bad.join(','));
    ok(!geo.hscroll, W + ': no sideways scroll');
    ok(Math.max(...geo.tops) - Math.min(...geo.tops) < 4 && Math.min(...geo.hs) >= 32, W + ': row buttons on one line and 32px+ tall ' + geo.tops + ' ' + geo.hs);
    await p.evaluate(() => { const r = document.querySelector('#modal .prow'); if (r) r.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(150); await p.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/pay-' + W + '.png' : '/tmp/pay-' + W + '.png', fullPage: false });
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
