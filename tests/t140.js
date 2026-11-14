// Team hover card: phone with copy, car number, car photo; admin can set car number. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(500);
  const png = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const id = await p.evaluate(async png => { const S = window.Store, d = S.db.profiles.find(x => x.role === 'driver'); await S.save('profiles', { ...d, phone: '+995500000123', car_plate: 'AA-123-BB', car_photo: png }); return d.id; }, png);
  await p.waitForTimeout(300);
  await p.locator(`.sidepanel .cpp[data-v="${id}"]`).hover(); await p.waitForTimeout(300);
  const txt = await p.locator('.pcard').innerText(); console.log(txt.replace(/\n+/g, ' | '));
  ok(txt.includes('+995500000123'), 'phone shown'); ok(txt.includes('AA-123-BB'), 'car number shown');
  ok(await p.locator('.pcard .pccar').count() === 1, 'car photo shown');
  await p.locator('.pcard').hover(); await p.waitForTimeout(400);
  ok(await p.locator('.pcard').count() === 1, 'card stays while the mouse is on it');
  ok(await p.locator('.pcard [data-act=copy]').count() >= 2, 'copy buttons for phone and car number');
  ok(await p.locator('.pcard a[href^="tel:"]').count() === 1, 'call button');
  await p.mouse.move(5, 5); await p.waitForTimeout(500); ok(await p.locator('.pcard').count() === 0, 'card hides');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
