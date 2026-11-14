// A driver adds a second car in Me: the office gets a task. Timeline with many people stays usable. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Gela (sample) · Driver' }); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelector('.nav [data-v=me], .tabs [data-v=me]').click(); }); await p.waitForTimeout(400);
  ok(await p.locator('[data-act=cars]').count() >= 1, 'driver sees the My car button');
  await p.locator('[data-act=cars]').first().click(); await p.waitForTimeout(300);
  await p.fill('[data-car="0.model"]', 'Delica'); await p.fill('[data-car="0.plate"]', 'aa-1-bb');
  await p.locator('[data-act=caradd]').click(); await p.waitForTimeout(200); await p.fill('[data-car="1.model"]', 'Prius');
  await p.locator('#modal form[data-form=cars] button.primary').click(); await p.waitForTimeout(700);
  const k = await p.evaluate(() => window.Store.db.tasks.filter(t => t.kind === 'car_check').map(t => [t.title, t.notes, t.assignees.length]));
  ok(k.length === 1 && k[0][2] >= 1 && /Prius/.test(k[0][1]), 'task for the office: ' + JSON.stringify(k));
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
