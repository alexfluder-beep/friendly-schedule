// Back office: car number and car photo can be set on a person and show on the hover card. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(500);
  const id = await p.evaluate(() => { const d = window.Store.db.profiles.find(x => x.role === 'driver'); return d.id; });
  await p.evaluate(i => { const o = document.createElement('div'); window.__id = i; }, id);
  await p.evaluate(() => { document.querySelector('.nav [data-v=admin], .tabs [data-v=admin]').click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('.admmain [data-act=admintab][data-v=team], .admnav [data-act=admintab][data-v=team]').click(); }); await p.waitForTimeout(400);
  await p.evaluate(i => { const e = document.querySelector(`[data-act=pedit][data-id="${i}"]`); if (e) e.click(); }, id); await p.waitForTimeout(400);
  ok(await p.locator('#pe-plate').count() === 1, 'car number field in the person form');
  await p.fill('#pe-plate', 'zz-777-yy');
  await p.locator('input[data-ch=carphoto]').setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }); await p.waitForTimeout(600);
  ok(await p.locator('.carphoto img').count() === 1, 'photo preview after choosing a file');
  await p.locator('.modal form button.primary, .sheet form button.primary').first().click(); await p.waitForTimeout(600);
  const r = await p.evaluate(i => { const d = window.Store.db.profiles.find(x => x.id === i); return [d.car_plate, (d.car_photo || '').slice(0, 22)]; }, id);
  ok(r[0] === 'ZZ-777-YY', 'car number saved upper case: ' + r[0]); ok(r[1] === 'data:image/jpeg;base64', 'photo saved small jpeg');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
