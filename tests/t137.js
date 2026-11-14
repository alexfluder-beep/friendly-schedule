// A team member without an avatar sees a must-do task and cannot send requests until an avatar is chosen. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Nino (sample) · Guide' }); await p.waitForTimeout(600);
  await p.evaluate(() => { window.Store.mode = 'supabase'; const me = window.Store.me; me.avatar = null; });
  await p.evaluate(() => { document.querySelector('.nav [data-v=tasks], .tabs [data-v=tasks]').click(); }); await p.waitForTimeout(600);
  ok(await p.locator('.avmust').count() === 1, 'must-do avatar task is shown');
  const n = await p.locator('[data-act=xctake]').count();
  if (n) { await p.locator('[data-act=xctake]').first().click(); await p.waitForTimeout(500); ok(await p.evaluate(() => window.Store.db.change_requests.filter(q => q.user_id === window.Store.me.id).length) === 0, 'request is blocked without an avatar'); }
  if (!n) { await p.evaluate(() => { document.querySelector('.avmust [data-act=avgo]').click(); }); await p.waitForTimeout(600); }
  ok(await p.locator('details.avpick').count() >= 1, 'goes to the avatar picker');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
