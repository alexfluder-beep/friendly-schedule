// Guide sees: corrections in own statement (phone and desktop), payment (online / cash amount) on tour cards and guest rows. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Mariam (sample) · Guide' }); await p.waitForTimeout(700);
    const info = await p.evaluate(() => { const db = window.Store.db, me = db.people ? null : null; const sel = document.querySelector('#demo-as'); return { ok: !!db }; });
    const set = await p.evaluate(() => { const db = window.Store.db; const pid = (db.profiles || db.people || []).find(x => /Mariam/.test(x.name || ''))?.id; if (!pid) return null; const t = db.tours.filter(x => (x.guide_id === pid || x.driver_id === pid)).sort((a, c) => c.date.localeCompare(a.date))[0]; if (!t) return { pid, none: 1 }; const mo = t.date.slice(0, 7); db.pay_adjustments.push({ id: 'zz1', user_id: pid, month: mo, amount: 25, note: 'Bonus test', created_at: t.date + 'T10:00:00Z' }); const bk = db.bookings.filter(x => x.tour_id === t.id); db.bookings.forEach(x => { if (x.tour_id === t.id) x.payment = 'prepaid'; }); const nb = { id: 'zzb1', tour_id: t.id, guest: 'Pat Sample', adults: 2, children: 0, pax: 2, payment: 'cash', amount_due: 40, currency: 'GEL' }; db.bookings.push(nb, { id: 'zzb2', tour_id: t.id, guest: 'Lee Sample', adults: 1, children: 0, pax: 1, payment: 'prepaid', currency: 'GEL' }); return { pid, mo, tid: t.id }; });
    ok(set && set.mo, W + ': demo tour found for the guide ' + JSON.stringify(set));
    if (!set || !set.mo) { await p.context().close(); continue; }
    await p.evaluate(m => { window.__m = m; }, set.mo);
    await p.evaluate(() => { const e = document.createElement('button'); e.dataset.act = 'metab'; e.dataset.v = 'month'; e.hidden = true; document.querySelector('main').appendChild(e); e.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const e = document.querySelector('.tabs [data-v=me], [data-act=nav][data-v=me], [data-v=me]'); if (e) e.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const e = document.createElement('button'); e.dataset.act = 'metab'; e.dataset.v = 'month'; e.hidden = true; document.querySelector('main').appendChild(e); e.click(); }); await p.waitForTimeout(300);
    await p.evaluate(m => { const e = document.createElement('button'); e.dataset.act = 'paymonth'; e.dataset.m = m; e.hidden = true; document.querySelector('main').appendChild(e); e.click(); }, set.mo); await p.waitForTimeout(400);
    const stm = await p.locator('.stmt').count(); ok(stm === 1, W + ': guide statement is one column block');
    if (stm) { if (W > 900) { const g = await p.evaluate(() => { const a = document.querySelector('.payside').getBoundingClientRect(), m = document.querySelector('.paymain').getBoundingClientRect(); return a.right <= m.left + 1 && a.width < 300; }); ok(g, W + ': period switch in a left panel'); } const t = await p.locator('.stmt').innerText(); ok(/Bonus test/.test(t) && /25/.test(t), W + ': guide sees the correction'); const w = await p.locator('.stmt').evaluate(e => e.getBoundingClientRect().width); ok(W > 800 ? w <= 725 : w <= W, W + ': statement width ' + Math.round(w)); ok(await p.locator('.stmt .dplnk').count() > 0 && await p.locator('.stmt .dpbtn').count() === 0, W + ': Pay not right is a small link'); await p.screenshot({ path: '/tmp/claude-0/shots/guide-' + W + '.png' }); }
    await p.evaluate(id => { const e = document.createElement('button'); e.dataset.act = 'tour'; e.dataset.id = id; e.hidden = true; document.querySelector('main').appendChild(e); e.click(); }, set.tid); await p.waitForTimeout(500);
    const gs = await p.locator('#modal .gsum').allInnerTexts(); ok(gs.some(x => /Online|Prepaid/i.test(x)) && gs.some(x => /Cash.*40/.test(x)), W + ': guest rows show prepaid and cash amount: ' + JSON.stringify(gs));
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
