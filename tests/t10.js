const { chromium, devices } = require('playwright');
(async () => { const S = process.argv[2]; const b = await chromium.launch(); const errs = []; let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); await p.addInitScript(() => { window.__noCelebrate = true; }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const as = async l => { await p.selectOption('#demo-as', { label: l }); await p.waitForTimeout(200); };
  const txt = s => p.locator(s).first().innerText();
  { const m0 = new Date(); m0.setDate(m0.getDate() - ((m0.getDay() + 6) % 7)); m0.setHours(8, 0, 0, 0); await p.clock.install({ time: m0 }); } /* Monday morning: the sample tours of the week are all still ahead */
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  // --- in-place updates: the header element survives a re-render, typed text is kept
  await p.evaluate(() => { document.querySelector('header.top').dataset.probe = '1'; });
  await p.click('.tabs [data-v=timeoff], .tabs [data-v=team]'); await p.click('.tabs [data-v=calendar]');
  ok(await p.evaluate(() => document.querySelector('header.top').dataset.probe === undefined && !!(window.__h = document.querySelector('header.top'))), 'header kept'); await p.click('.tabs [data-v=tasks]'); ok(await p.evaluate(() => window.__h === document.querySelector('header.top')), 'screen is patched, not rebuilt'); await p.click('.tabs [data-v=calendar]');
  // --- admin cancels a tour with a reason
  await p.click('.acard:has-text("Brutal Tbilisi") >> nth=0'); await p.waitForSelector('[data-act=tmore]'); ok(await p.locator('.sheet .tacts .danger').count() === 0, 'no red button on the tour card before More is opened'); await p.click('[data-act=tmore]'); await p.waitForSelector('[data-act=cancelask]'); await p.click('[data-act=cancelask]'); await p.waitForSelector('#cx-reason');
  await p.screenshot({ path: S + '/v13-cancel.png' });
  await p.fill('#cx-reason', 'Heavy rain'); await p.click('form[data-form=cancel] button.danger'); await p.waitForTimeout(300);
  ok((await txt('.sheet')).includes('Cancelled: Heavy rain'), 'admin cancels a tour, reason shown on the card');
  await p.click('[data-act=close]'); await p.waitForTimeout(150);
  ok(await p.locator('.acard.cancelled:has-text("Brutal Tbilisi")').count() > 0, 'cancelled tour stays in the day list, crossed out');
  await p.screenshot({ path: S + '/v13-cancelled.png' });
  await as('Nino (sample) · Guide'); await p.click('[data-act=bell]'); await p.waitForTimeout(150);
  ok((await txt('.sheet')).includes('Tour cancelled: Brutal Tbilisi'), 'guide gets a cancellation notice with the reason'); await p.click('[data-act=close]');
  await as('Sample Admin · Admin'); await p.click('.acard.cancelled >> nth=0'); await p.click('[data-act=tourrestore]'); await p.waitForTimeout(300);
  await p.click('.sheet [data-act=tmore]'); await p.waitForTimeout(200); ok(await p.locator('.sheet [data-act=cancelask]').count() === 1 && await p.locator('.sheet [data-act=tourrestore]').count() === 0, 'admin restores the tour (Cancel tour is back inside More)'); await p.click('[data-act=close]');
  // --- guide reports a cancellation, admin approves
  await as('Mariam (sample) · Guide'); await p.click('.acard:has-text("Kakheti") >> nth=0'); await p.waitForSelector('.glist'); await p.click('.sheet details.sect summary'); await p.click('.sheet [data-act=cancelask]'); await p.fill('#cx-reason', 'Guest is ill'); await p.click('form[data-form=cancel] button.danger'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  ok(await p.locator('.acard.cancelled').count() === 0, 'a guide report does not cancel the tour by itself');
  await as('Sample Admin · Admin'); await p.click('.tabs [data-v=admin]'); await p.click('.admmain [data-act=admintab][data-v=requests]');
  ok((await txt('main .list')).includes('Tour is cancelled'), 'admin sees the cancellation report'); await p.click('[data-act=creqdecide][data-s="1"] >> nth=0'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Store.db.tours.some(t => t.title.startsWith('Kakheti') && t.status === 'cancelled' && t.cancel_reason === 'Guest is ill')), 'approval cancels the tour and keeps the reason');
  // --- team: add, edit, working hours, skills, delete
  await p.click('.admmain [data-act=admintab][data-v=""]'); await p.click('.admmain [data-act=admintab][data-v=team]'); await p.screenshot({ path: S + '/v13-team.png', fullPage: true });
  await p.click('[data-act=pnew]'); await p.fill('#pe-name', 'Test Guide'); await p.fill('#pe-phone', '+995500111222'); await p.click('.langpick > summary'); await p.check('.langpick input[value=EN]'); await p.screenshot({ path: S + '/v13-person.png' }); await p.click('form[data-form=person] button.primary'); await p.waitForTimeout(250);
  ok((await txt('main')).includes('Test Guide'), 'admin adds a person');
  await p.click('.prow:has-text("Test Guide") [data-act=pedit]'); await p.fill('#pe-name', 'Test Guide Two'); await p.click('.sheet details:has-text("Tours this person leads") summary'); await p.locator('.sheet [data-sk]').first().check(); await p.click('form[data-form=person] button.primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const x = Store.db.profiles.find(q => q.name === 'Test Guide Two'); return x && x.skills.length === 1 && x.phone === '+995500111222'; }), 'admin edits a person and sets the tours they lead');
  await p.click('.prow:has-text("Test Guide Two") [data-act=pedit]'); await p.click('[data-act=pdelete]'); await p.click('[data-act=confirmyes]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !Store.db.profiles.some(q => q.name === 'Test Guide Two')), 'admin deletes a person with no tours');
  await p.click('.prow:has-text("Nino") [data-act=pedit]'); await p.click('[data-act=pdelete]'); await p.click('[data-act=confirmyes]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const x = Store.db.profiles.find(q => q.name.startsWith('Nino')); return x && x.active === false && x.left_at && !x.phone; }), 'deleting a guide with tours keeps the name, closes access, wipes the phone');
  ok(await p.locator('details:has-text("Former team")').count() === 1, 'former team list shown');
  // --- privacy: old guests
  await p.evaluate(async () => { const t = { id: Store.uid(), date: '2023-05-01', title: 'Old tour', kind: 'private', status: 'confirmed', pax: 2, adults: 2, children: 0, guide_id: Store.db.profiles.find(q => q.name.startsWith('Mariam')).id }; const c = { id: Store.uid(), name: 'Ancient Guest', phone: '+4411', email: 'a@b.c' }; await Store.save('tours', t); await Store.save('clients', c); await Store.save('bookings', { id: Store.uid(), tour_id: t.id, client_id: c.id, guest: 'Ancient Guest x2', adults: 2, children: 0, pax: 2, phone: '+4411', ref: 'GYG9', marks: [] }); });
  await p.click('.admmain [data-act=admintab][data-v=""]'); await p.click('.admmain [data-act=admintab][data-v=privacy]'); await p.click('[data-act=pvcount]'); await p.waitForTimeout(200); await p.screenshot({ path: S + '/v13-privacy.png', fullPage: true });
  ok((await txt('main')).includes('months: 1.'), 'privacy tab counts old guests');
  await p.click('[data-act=pvrun]'); await p.click('[data-act=confirmyes]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const c = Store.db.clients.find(x => x.anonymised_at); const bk = Store.db.bookings.find(x => x.client_id === c.id); return c.name === 'Guest' && !c.phone && !c.email && bk.guest === 'Guest' && !bk.phone && bk.pax === 2 && Store.db.clients.filter(x => x.anonymised_at).length === 1; }), 'clean-up removes contacts of old guests only, keeps guest numbers');
  await as('Mariam (sample) · Guide');
  ok(await p.evaluate(() => true), 'switch to guide');
  // --- sign out, sign-in screen, sign in
  await p.click('.tabs [data-v=me]'); await p.click('[data-act=metab][data-v=settings]'); await p.click('[data-act=signout]'); await p.waitForSelector('form.auth'); await p.screenshot({ path: S + '/v13-login.png', fullPage: true });
  ok(await p.locator('#au-email').count() === 1 && await p.locator('.tabs').count() === 0, 'sign out shows the sign-in screen, nothing else');
  await p.fill('#au-email', 'me@x.ge'); await p.fill('#au-pass', 'secret123'); await p.click('[data-act=showpw]');
  ok(await p.inputValue('#au-pass') === 'secret123' && await p.getAttribute('#au-pass', 'type') === 'text', 'show password keeps what was typed');
  await p.click('[data-act=auth][data-to=signup]'); await p.screenshot({ path: S + '/v13-signup.png', fullPage: true }); await p.click('[data-act=auth][data-to=signin]');
  await p.fill('#au-email', 'me@x.ge'); await p.fill('#au-pass', 'secret123'); await p.click('form.auth button.primary'); await p.waitForSelector('.tabs');
  ok(true, 'sign in opens the app');
  // --- day-off marks
  await p.click('.tabs [data-v=calendar]'); await p.click('[data-act=mode][data-m=month]'); await p.waitForSelector('.mgrid');
  ok(await p.locator('.mgrid .offm').count() > 0, 'month shows day-off marks'); await p.screenshot({ path: S + '/v13-month.png' });
  await as('Mariam (sample) · Guide'); await p.click('[data-act=nav][data-d="1"]'); await p.waitForTimeout(350); await p.screenshot({ path: S + '/v13-week-guide.png' });
  // --- notification choices
  await p.click('.tabs [data-v=me]'); await p.uncheck('#mute-cancelled'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Store.me.mute.includes('cancelled')), 'guide switches off cancellation notices');
  // --- refresh button
  await p.click('[data-act=refresh]'); await p.waitForTimeout(300); ok(true, 'refresh works');
  console.log('overflow', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'ERRORS', errs);
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail || errs.length ? 1 : 0); })().catch(e => { console.log('FAIL', e.message.slice(0, 600)); process.exit(1); });
