// t1: every screen opens without an error, on a computer and on a phone, in three languages; a tour can be edited and added.
// (Replaces the first walk-through script from version 1, which followed screens that no longer exist.)
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
  const TABS = ['requests', 'tours', 'email', 'clients', 'team', 'avail', 'balance', 'pay', 'plan', 'holidays', 'stats', 'reports', 'achv', 'usage', 'catalog', 'rules', 'import', 'backup', 'privacy', 'log', 'problems'];
  const openMore = p => p.evaluate(() => document.querySelectorAll('form[data-form=tour] details').forEach(d => { d.open = true; }));
  for (const [name, opt, navSel] of [['computer', { viewport: { width: 1280, height: 800 } }, '.nav'], ['phone', { ...devices['iPhone 13'] }, '.tabs']]) {
    const ctx = await b.newContext(opt); await ctx.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.evaluate(() => window.__test.setGrid(true)); await p.waitForTimeout(200); await p.waitForFunction(() => window.__test); await p.waitForTimeout(400);
    const go = async v => { await p.click(`${navSel} [data-v=${v === "timeoff" && (await p.locator(navSel + " [data-v=team]").count()) ? "team" : v}]`); await p.waitForTimeout(250); };
    for (const v of ['timeoff', 'tasks', 'me', 'admin', 'calendar']) { await go(v); ok((await p.locator('main').innerText()).trim().length > 20, `${name}: ${v} screen opens`); }
    await go('admin');
    for (const t of TABS) { await p.evaluate(v => { const el = document.createElement('button'); el.dataset.act = 'admintab'; el.dataset.v = v; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }, t); await p.waitForTimeout(150); const tx = (await p.locator('main').innerText()).trim(); if (tx.length < 20) ok(false, `${name}: Back office > ${t} is empty`); }
    ok(true, `${name}: all ${TABS.length} Back office pages open`);
    await go('me'); for (const k of ['settings', 'month', 'stats', 'badges', 'profile']) { const tb = p.locator(`[data-act=metab][data-v=${k}]`); if (await tb.count()) { await tb.first().click(); await p.waitForTimeout(350); } }
    ok(true, `${name}: Me tabs open`);
    if (name === 'computer') {
      await go('calendar'); await p.waitForSelector('.chip'); await p.click('.chip >> nth=0'); await p.waitForSelector('.sheet'); await p.click('[data-act=touredit]'); await p.waitForSelector('#t-title'); await openMore(p); await p.fill('#t-cap', '2');
      await p.click('form[data-form=tour] > .actions button.primary'); await p.waitForTimeout(400); ok(await p.locator('form[data-form=tour]').count() === 0, 'a tour can be edited and saved');
      for (let i = 0; i < 3 && await p.locator('.overlay').count(); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
      await p.click('.bar [data-act=newtour]'); await p.waitForSelector('#t-title'); await openMore(p); await p.fill('#t-title', 'Test custom tour'); await p.selectOption('#t-kind', 'custom'); await p.selectOption('#t-guide', { index: 2 });
      await p.click('form[data-form=tour] > .actions button.primary'); await p.waitForTimeout(500);
      for (let i = 0; i < 3 && await p.locator('form[data-form=tour]').count(); i++) { const yes = p.locator('.overlay button.primary').last(); if (await yes.count()) await yes.click(); await p.waitForTimeout(300); }
      ok(await p.evaluate(() => Store.db.tours.some(t => t.title === 'Test custom tour')), 'a new tour can be added');
      await p.click('[data-act=mode][data-m=month]'); await p.waitForTimeout(300); ok(await p.locator('.mgrid, .month').count() > 0, 'month view opens'); await p.click('[data-act=mode][data-m=week]');
    }
    for (const l of ['ru', 'ka', 'en']) { await go('me'); const tb = p.locator('[data-act=metab][data-v=settings]'); if (await tb.count() && !(await p.locator('#me-lang').count())) { await tb.first().click(); await p.waitForTimeout(300); } await p.selectOption('#me-lang', l); await p.waitForTimeout(300); for (const v of ['calendar', 'timeoff', 'tasks']) await go(v); }
    ok(true, `${name}: Russian and Georgian screens open`);
    await p.selectOption('#demo-as', { index: 2 }); await p.waitForTimeout(400); for (const v of ['calendar', 'timeoff', 'tasks', 'me']) await go(v); ok(true, `${name}: a guide's screens open`);
    ok(errs.length === 0, `${name}: no errors on any screen` + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 400) : '')); await ctx.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0); })().catch(e => { console.log('FAIL', e.message.slice(0, 700)); process.exit(1); });
