// Micro animations (owner, 17 Nov): messages slide in, a saved pay row glows, a changed count pops, an assigned tour slides away,
// a ticked task dims; the actions still complete. With "reduce motion" on, nothing animates and nothing waits. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const motion of ['no-preference', 'reduce']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: motion }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(700);
    const M = motion === 'reduce' ? 'reduce: ' : 'motion: ', on = motion !== 'reduce';
    // watch classes as they appear
    await p.evaluate(() => { window.__fx = new Set(); new MutationObserver(ms => ms.forEach(m => { const c = m.target.className; if (typeof c === 'string') c.split(/\s+/).filter(x => x.startsWith('fx-')).forEach(x => window.__fx.add(x)); })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); });
    // 4 assign from Tours to staff
    await p.evaluate(async () => { const S = window.Store, d = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10); await S.save('tours', { id: 'zf1', title: 'Zz Walking Fx Test', kind: 'group', date: d, start_time: '10:00', end_time: '13:00', status: 'confirmed', capacity: 15, pax: 3, adults: 3, children: 0, guide_id: null, driver_id: null }); });
    await p.evaluate(() => document.querySelector('.tabs [data-v=tasks]').click()); await p.waitForTimeout(500);
    const fit = p.locator('[data-act=fitassign][data-id=zf1]').first(); const hasFit = await fit.count();
    if (hasFit) { await p.evaluate(() => { const q = document.querySelector('[data-act=fitassign][data-id=zf1]').closest('.qfits'), r = q.previousElementSibling; window.__lv = []; new MutationObserver(() => { if (r.classList.contains('fx-leave')) window.__lv.push('row'); if (q.classList.contains('fx-leave')) window.__lv.push('fits'); }).observe(q.parentElement, { subtree: true, attributes: true, attributeFilter: ['class'] }); }); await fit.click(); await p.waitForTimeout(700); ok(await p.evaluate(() => !!window.Store.db.tours.find(t => t.id === 'zf1').guide_id), M + 'assign still saves'); ok(on === await p.evaluate(() => window.__fx.has('fx-leave')), M + (on ? 'the assigned tour slides away' : 'no slide')); if (on) ok(await p.evaluate(() => window.__lv.includes('row') && window.__lv.includes('fits')), M + 'the tour line and its suggestions slide together'); }
    else ok(false, M + 'a suggestion to assign was shown');
    // 1 message slides in
    ok(on === await p.evaluate(() => { const t = document.querySelector('.toast'); return !!t && getComputedStyle(t).animationName === 'fx-toast'; }), M + (on ? 'the message slides in' : 'the message just appears'));
    // 3 a count pops: add a task for me
    await p.evaluate(async () => { const S = window.Store; await S.save('tasks', { id: 'zk1', title: 'Zz fx task', notes: '', due_date: null, kind: null, assignees: [S.me ? S.me.id : window.Store.db.profiles.find(x => x.role === 'admin').id], status: 'open', tour_id: null, created_by: null }); document.querySelector('.tabs [data-v=calendar]').click(); });
    await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('.tabs [data-v=tasks]').click()); await p.waitForTimeout(400);
    ok(on === await p.evaluate(() => window.__fx.has('fx-bump')), M + (on ? 'a changed count pops' : 'no pop'));
    // 5 tick the task
    await p.evaluate(() => { const e = document.querySelector('[data-act=tasksec][data-v=tasks]'); if (e) e.click(); }); await p.waitForTimeout(300);
    const box = p.locator('input[data-act=taskdone][data-id=zk1], input[type=checkbox][id$="zk1"]').first();
    if (await box.count()) { await box.check(); await p.waitForTimeout(700); ok(await p.evaluate(() => window.Store.db.tasks.find(t => t.id === 'zk1').status === 'done'), M + 'ticked task saved as done'); ok(on === await p.evaluate(() => window.__fx.has('fx-done')), M + (on ? 'the ticked task dims' : 'no dim')); }
    else ok(false, M + 'the task row was shown');
    await ctx.close(); }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
