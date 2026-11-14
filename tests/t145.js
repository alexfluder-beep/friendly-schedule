// Back office > Cars: add, edit, retire and bring back a car, date warnings in the list and on the Back office home, at 375 and 1280 px. Invented data only.
// Screenshots go to $SHOTS (default: the current folder, which run-all.sh sets outside the repo).
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS || '.';
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: w < 500 ? 800 : 900 } })).newPage();
    p.on('pageerror', e => errs.push(w + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(w + ' console: ' + m.text()); });
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(500);
    ok(await p.evaluate(() => window.Store.db.vehicles.length === 2), w + ': two sample cars');
    await p.evaluate(() => { document.querySelector('.nav [data-v=admin], .tabs [data-v=admin]').click(); }); await p.waitForTimeout(300);
    ok(await p.locator('.vhalert').count() === 1 && /2/.test(await p.locator('.vhalert').innerText()), w + ': Back office home warns about 2 cars');
    await p.screenshot({ path: `${SHOTS}/cars-${w}-home.png`, fullPage: false });
    await p.evaluate(() => { document.querySelector('.vhalert [data-act=admintab]').click(); }); await p.waitForTimeout(300);
    let t = await p.locator('.admmain').innerText();
    ok(/Delica white tiger/.test(t) && /Insurance ends in 12 days/.test(t) && /Insurance ended/.test(t) && /Service in 600 km/.test(t), w + ': list with warning chips');
    ok(await p.locator('.vhrow .t-danger').count() === 1, w + ': past date is red');
    await p.screenshot({ path: `${SHOTS}/cars-${w}-list.png`, fullPage: true });
    // add
    await p.locator('[data-act=vnew]').click(); await p.waitForSelector('form[data-form=veh]');
    await p.fill('[name=name]', 'Test van'); await p.fill('[name=make]', 'Toyota'); await p.fill('[name=model]', 'Hiace'); await p.fill('[name=plate]', 'tt-111-tt'); await p.fill('[name=seats]', '8');
    await p.check('[name=four_wd]'); await p.selectOption('[name=color]', 'blue'); await p.selectOption('[name=driver_id]', { index: 1 });
    const soon = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }); await p.fill('[name=inspection_until]', soon);
    await p.setInputFiles('[data-ch=vphoto]', { name: 'c.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
    await p.waitForSelector('form[data-form=veh] .carphoto img'); ok(await p.inputValue('[name=name]') === 'Test van', w + ': typed fields kept after the photo');
    await p.screenshot({ path: `${SHOTS}/cars-${w}-add.png`, fullPage: false });
    await p.locator('form[data-form=veh] button.primary').click(); await p.waitForTimeout(400);
    const v = await p.evaluate(() => window.Store.db.vehicles.find(x => x.name === 'Test van'));
    ok(v && v.plate === 'TT-111-TT' && v.seats === 8 && v.four_wd === true && v.color === 'blue' && v.driver_id && v.photo && v.inspection_until === soon, w + ': saved ' + JSON.stringify(v && { ...v, photo: !!v.photo }));
    t = await p.locator('.admmain').innerText(); ok(/Test van/.test(t) && /Inspection ends in 5 days/.test(t), w + ': new car in the list with its warning');
    // edit
    await p.locator(`[data-key="v${v.id}"] [data-act=vedit]`).click(); await p.waitForSelector('form[data-form=veh]');
    await p.fill('[name=seats]', '7'); await p.fill('[name=inspection_until]', ''); await p.locator('form[data-form=veh] button.primary').click(); await p.waitForTimeout(400);
    const v2 = await p.evaluate(id => window.Store.db.vehicles.find(x => x.id === id), v.id); ok(v2.seats === 7 && !v2.inspection_until, w + ': edit saved');
    // retire
    await p.locator(`[data-key="v${v.id}"] [data-act=vedit]`).click(); await p.waitForSelector('form[data-form=veh]');
    await p.locator('form[data-form=veh] [data-act=vretire]').click(); await p.locator('[data-act=confirmyes]').click(); await p.waitForTimeout(400);
    ok(await p.evaluate(id => window.Store.db.vehicles.find(x => x.id === id).active === false, v.id), w + ': retired, not deleted');
    await p.evaluate(() => { const d = document.querySelector('.admmain details.sect'); if (d) d.open = true; });
    ok(/Former cars \(1\)/.test(await p.locator('.admmain').innerText()), w + ': in Former cars');
    await p.screenshot({ path: `${SHOTS}/cars-${w}-former.png`, fullPage: true });
    // restore
    await p.locator(`[data-key="v${v.id}"] [data-act=vrestore]`).click(); await p.waitForTimeout(400);
    ok(await p.evaluate(id => window.Store.db.vehicles.find(x => x.id === id).active === true, v.id) && !/Former cars \(/.test(await p.locator('.admmain').innerText()), w + ': brought back');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), w + ': no sideways scroll');
    await p.evaluate(() => { localStorage.clear(); });
    await p.context().close();
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
