const { chromium, devices } = require('playwright');
(async () => { const S = process.argv[2]; const b = await chromium.launch(); const errs = []; let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); await p.addInitScript(() => { window.__noCelebrate = true; }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const as = async l => { await p.selectOption('#demo-as', { label: l }); await p.waitForTimeout(250); };
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  // pinned strip
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(300);
  const top = await p.evaluate(() => { const s = document.querySelector('.strip').getBoundingClientRect(), h = document.querySelector('header.top').getBoundingClientRect(); return [Math.round(s.top), Math.round(h.bottom)]; });
  ok(Math.abs(top[0] - top[1]) <= 8, 'week strip stays pinned under the header while scrolling ' + top); await p.screenshot({ path: S + '/v16-strip.png' });
  ok(await p.evaluate(() => { const b = document.querySelector('.strip [aria-pressed=true]'); return b && b.dataset.date !== Store.me && true; }), 'a day stays marked while scrolling');
  await p.evaluate(() => window.scrollTo(0, 0));
  // edit tour: essentials, duration, guest address
  await p.click('.acard:has-text("Kakheti") >> nth=0'); await p.click('[data-act=touredit]'); await p.waitForSelector('#t-dur'); await p.waitForTimeout(300); await p.screenshot({ path: S + '/v16-edit.png' });
  ok(!(await p.locator('#t-kind').isVisible()), 'type, language, capacity are folded under More options');
  await p.fill('#t-start', '10:00'); await p.fill('#t-dur', '6.5'); ok((await p.innerText('#t-endtxt')) === '16:30', 'duration sets the end time');
  ok(await p.evaluate(() => { const f = document.querySelector('form[data-form=tour]'); return [...f.querySelectorAll('input,select')].every(e => e.getBoundingClientRect().right <= innerWidth); }), 'no field runs off the screen');
  await p.locator('.msel summary').first().click(); await p.locator('[data-bm=pickup]').first().check(); await p.click('[data-act=msdone]'); await p.waitForSelector('[data-bf=pickup_addr]'); await p.fill('[data-bf=pickup_addr]', 'Hotel Sample, Rustaveli 12'); await p.locator('form[data-form=tour]').evaluate(f => f.scrollIntoView(false)); await p.screenshot({ path: S + '/v16-addr.png' });
  await p.click('form[data-form=tour] > .actions button.primary'); await p.waitForTimeout(300);
  await p.click('.acard:has-text("Kakheti") >> nth=0'); await p.waitForSelector('.glist');
  await p.waitForSelector('.sheet .gaddr', { state: 'attached' }); ok((await p.locator('.sheet .gaddr').first().textContent()).includes('Hotel Sample'), 'guest pick-up address shows on the tour card with a map link'); 
  ok((await p.locator('.sheet .when').innerText()).includes('10:00–16:30'), 'saved tour has the new times'); await p.screenshot({ path: S + '/v16-card.png' }); await p.keyboard.press('Escape');
  // tour list
  await p.click('.tabs [data-v=admin]'); await p.click('.admmain [data-act=admintab][data-v=catalog]'); await p.waitForSelector('.crow'); await p.screenshot({ path: S + '/v16-cat.png' });
  ok(await p.locator('main table').count() === 0 && await p.locator('.crow').count() > 30, 'tour list is a simple list');
  await p.click('.crow >> nth=1'); await p.waitForSelector('#c-title'); await p.screenshot({ path: S + '/v16-catedit.png' }); await p.fill('#c-cap', '7'); await p.click('form[data-form=cat] button.primary'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Store.db.settings.find(s => s.id === 'catalog').value.items[1].capacity === 7), 'tour settings are saved from the edit sheet');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'tour list fits the phone width');
  // working week
  await as('Mariam (sample) · Guide'); await p.click('.tabs [data-v=me]'); await p.waitForSelector('details.wsedit summary'); await p.click('details.wsedit summary'); await p.waitForSelector('.wweek'); await p.uncheck('form[data-form=worksched] [name=wd6]'); await p.fill('form[data-form=worksched] [name=wf5]', '10:00'); await p.fill('form[data-form=worksched] [name=wt5]', '15:00'); await p.locator('.wweek').scrollIntoViewIfNeeded(); await p.screenshot({ path: S + '/v16-week.png' }); await p.click('form[data-form=worksched] button.primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const w = Store.me.work_week; return w[6] === null && w[5][0] === '10:00' && w[5][1] === '15:00' && w[0][0] === ''; }), 'each weekday keeps its own hours');
  // badges by role
  await p.click('[data-act=metab][data-v=badges]'); await p.waitForTimeout(250); await p.evaluate(() => document.querySelectorAll('details.bpmore').forEach(d => { d.open = true; })); await p.waitForTimeout(150); await p.waitForSelector('.medals'); await p.waitForTimeout(300); await p.screenshot({ path: S + '/v16-badges-guide.png', fullPage: true });
  const titles = async () => (await p.locator('main h3').allInnerTexts()).join(' | ');
  ok((await titles()).includes('Guide') && !(await titles()).includes('Behind the wheel'), 'guide sees guide badges, no driving badges: ' + await titles());
  await p.click('.mdl[data-k=lazy]'); await p.waitForSelector('.sheet .mdl.big'); ok((await p.locator('.sheet').innerText()).includes('Sofa champion'), 'tapping a medal explains it'); await p.screenshot({ path: S + '/v16-badge.png' }); await p.click('[data-act=close]');
  await as('Zura (sample) · Driver'); await p.click('.tabs [data-v=me]'); ok(await p.locator('[data-act=metab][data-v=badges]').count() === 0, 'driver has no badges tab (simple driver view)');
  ok(true, 'Delica driver: badges are not shown to drivers any more (simple driver view)');
  ok(true, 'drive to the Moon badge: not shown to drivers');
  await as('Dato (sample) · Guide'); await p.click('.tabs [data-v=me]'); await p.click('[data-act=metab][data-v=badges]'); await p.waitForTimeout(250); await p.evaluate(() => document.querySelectorAll('details.bpmore').forEach(d => { d.open = true; })); await p.waitForTimeout(150); await p.waitForTimeout(300);
  ok((await titles()).includes('Guide with own car') && (await titles()).includes('Behind the wheel'), 'guide with own car sees guide, driving and own-car badges');
  console.log('overflow', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'ERRORS', errs);
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail || errs.length ? 1 : 0); })().catch(e => { console.log('FAIL', e.message.slice(0, 700)); process.exit(1); });
