const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); let pass = 0, fail = 0; const errs = []; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ok  ' : '  FAIL', m); };
  const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); await p.addInitScript(() => { window.__noCelebrate = true; }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.tabs'); await p.waitForTimeout(600);
  // an old-style notice (names only) from a guide
  const info = await p.evaluate(() => { const db = window.Store.db, me = db.profiles.find(x => x.role === 'admin'), g = db.profiles.find(x => x.role === 'guide'); const cat = (window.TOUR_CATALOG || []).filter(c => c.id); const drop = cat.slice(0, 3);
    db.notifications.push({ id: 'n-tc', user_id: me.id, kind: 'tours_change', params: { name: g.name, add: '—', drop: drop.map(c => c.title).join(', ') }, read: false, created_at: new Date().toISOString() });
    return { gid: g.id, drop: drop.map(c => String(c.id)), all: cat.length, before: (g.skills || []).length }; });
  await p.click('[data-act=bell]'); await p.waitForTimeout(500);
  ok(await p.locator('[data-act=tcapply]').count() === 1 && await p.locator('[data-act=tcdecline]').count() === 1 && await p.locator('[data-act=tccorrect]').count() === 1, 'Apply, Correct, Decline on the notice');
  await p.click('[data-act=tcapply]'); await p.waitForTimeout(800);
  const after = await p.evaluate(i => { const db = window.Store.db, g = db.profiles.find(x => x.id === i.gid); return { skills: (g.skills || []).map(String), note: db.notifications.filter(n => n.user_id === i.gid).map(n => n.kind + ':' + (n.params || {}).title).pop(), done: db.notifications.find(n => n.id === 'n-tc').params.done }; }, info);
  ok(info.drop.every(x => !after.skills.includes(x)) && after.skills.length === info.all - 3, `3 tours removed from the guide (${after.skills.length} of ${info.all} left)`);
  ok(/creq_approved:your tour list|creq_approved:ваш|creq_approved:თქვენი/.test(after.note), 'guide is told: ' + after.note);
  ok(after.done === 'applied' && await p.locator('[data-act=tcapply]').count() === 0 && /Applied/.test(await p.locator('#modal').innerText()), 'notice shows Applied, buttons gone');
  await p.click('[data-act=close]'); await p.waitForTimeout(300);
  // unsaved guard on the tour form
  await p.locator('[data-act=tour]:visible').first().click(); await p.waitForTimeout(500); await p.click('[data-act=touredit]'); await p.waitForTimeout(500);
  await p.click('[data-act=close]'); await p.waitForTimeout(300); ok(await p.locator('#askbox').count() === 0, 'no question when nothing was typed');
  await p.locator('[data-act=tour]:visible').first().click(); await p.waitForTimeout(400); await p.click('[data-act=touredit]'); await p.waitForTimeout(400);
  const inp = p.locator('form[data-form=tour] input[type=text], form[data-form=tour] input:not([type])').first(); await inp.fill('Changed title'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); ok(await p.locator('#askbox').count() === 1, 'question appears with unsaved data');
  await p.click('#askbox [data-a=keep]'); await p.waitForTimeout(200); ok(await inp.inputValue() === 'Changed title' && await p.locator('#askbox').count() === 0, 'Keep editing keeps what was typed');
  await p.locator('#modal [data-act=close]').first().click(); await p.waitForTimeout(200); await p.click('#askbox [data-a=drop]'); await p.waitForTimeout(400);
  ok(await p.locator('form[data-form=tour]').count() === 0, 'Close without saving closes the form');
  // delete a tour
  await p.evaluate(() => document.querySelector('[data-act=close]')?.click()); await p.waitForTimeout(300);
  const n0 = await p.evaluate(() => window.Store.db.tours.length);
  await p.locator('[data-act=tour]:visible').first().click(); await p.waitForTimeout(500); await p.click('.sheet [data-act=tmore]'); await p.waitForTimeout(200); const tid = await p.locator('[data-act=tourdelask]').getAttribute('data-id');
  await p.click('[data-act=tourdelask]'); await p.waitForTimeout(300); ok(/for good/.test(await p.locator('#modal').innerText()), 'delete asks first');
  await p.screenshot({ path: 'unslop/del.png' });
  await p.click('[data-act=confirmyes]'); await p.waitForTimeout(900);
  const d = await p.evaluate(id => ({ n: window.Store.db.tours.length, b: window.Store.db.bookings.filter(x => x.tour_id === id).length }), tid);
  ok(d.n === n0 - 1 && d.b === 0, 'tour and its bookings are gone');
  console.log(errs.length ? 'ERRORS ' + errs : 'ERRORS []'); console.log(`${pass} passed, ${fail} failed`); await b.close(); })();
