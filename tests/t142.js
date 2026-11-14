// A driver adds a second car in Me: the office gets a task. Timeline with many people stays usable. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Gela (sample) · Driver' }); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelector('.nav [data-v=me], .tabs [data-v=me]').click(); }); await p.waitForTimeout(400);
  ok(await p.locator('.metabs [data-v=car]').count() === 1, 'driver has the My car tab after Profile'); ok((await p.locator('.metabs button').first().innerText()).trim() === 'Profile' && (await p.locator('.metabs button').nth(1).innerText()).trim() === 'My car', 'tab order: Profile, My car');
  await p.locator('.metabs [data-v=car]').click(); await p.waitForTimeout(400);
  await p.fill('[data-car="0.model"]', 'Delica'); await p.fill('[data-car="0.plate"]', 'aa-1-bb');
  await p.locator('[data-act=caradd]').click(); await p.waitForTimeout(200); await p.fill('[data-car="1.model"]', 'Prius');
  await p.locator('form[data-form=cars] button.primary').click(); await p.waitForTimeout(700);
  const k = await p.evaluate(() => window.Store.db.tasks.filter(t => t.kind === 'car_check').map(t => [t.title, t.notes, t.assignees.length]));
  ok(k.length === 1 && k[0][2] >= 1 && /Prius/.test(k[0][1]), 'task for the office: ' + JSON.stringify(k));
  await p.selectOption('#demo-as', { label: 'Mariam (sample) · Guide' }); await p.waitForTimeout(500); await p.evaluate(() => { document.querySelector('.nav [data-v=me], .tabs [data-v=me]').click(); }); await p.waitForTimeout(400);
  ok(await p.locator('.metabs [data-v=car]').count() === 0, 'guide without a car has no tab'); await p.locator('[data-act=mycaradd]').click(); await p.waitForTimeout(700);
  ok(await p.locator('.metabs [data-v=car]').count() === 1 && await p.locator('form[data-form=cars]').count() === 1, 'I have a car opens the My car tab');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
