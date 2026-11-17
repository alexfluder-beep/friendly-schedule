// Money module (17 Nov): Back office > Money with Overview / Team / Guests / Setup, a running balance per person in every currency,
// Pay and Took cash, filling a missing price, and the bank-style balance a guide sees in Me > Pay. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 390]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
    const g = await p.evaluate(async () => { const S = window.Store, gd = S.db.profiles.find(x => x.role === 'guide' && x.active !== false), d = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      await S.save('tours', { id: 'zm1', title: 'Zz Money Test Tour', date: d, start_time: '10:00', end_time: '', kind: 'private', status: 'confirmed', capacity: 4, pax: 2, adults: 2, children: 0, guide_id: gd.id, driver_id: null, guide_pay: 40, driver_pay: null });
      await S.save('bookings', { id: 'zmb1', tour_id: 'zm1', guest: 'Test Guest One', pax: 2, adults: 2, children: 0, payment: 'cash', amount_due: 100, price: 100, currency: 'GEL', source: 'Direct', attendance: null, marks: ['wine'] });
      await S.save('bookings', { id: 'zmb2', tour_id: 'zm1', guest: 'Test Guest Two', pax: 1, adults: 1, children: 0, payment: null, price: null, currency: 'USD', source: 'Viator', attendance: null, marks: [] });
      return { id: gd.id, name: gd.name, mo: d.slice(0, 7) }; });
    await p.evaluate(mo => { window.__test.go('admin', 'money'); }, g.mo); await p.waitForTimeout(500);
    ok(await p.locator('.mn-hero .bignum').count() === 1 && await p.locator('.mn-tile').count() === 4, W + ': Overview shows the profit and four tiles');
    ok(await p.locator('.mn-wf').count() >= 4 && await p.locator('.mn-tc').count() >= 1, W + ': where the money went and the 12-month bars');
    ok(/Zz Money Test Tour/.test(await p.locator('.mn').innerText()), W + ': the test tour is in the tours table');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), W + ': Overview does not stick out');
    if (W === 390) await p.screenshot({ path: 'mn-overview-390.png', fullPage: true });
    // Team: balance, pay, took cash
    await p.click('[data-act=mntab][data-v=team]'); await p.waitForTimeout(300);
    const before = await p.evaluate(a => window.__test.money.ledger(a.id, a.mo), g);
    const card = p.locator('.mn-person', { hasText: g.name }); ok(await card.count() === 1, W + ': a card for the guide');
    await card.locator('[data-act=mnopen]').click(); await p.waitForTimeout(300);
    ok(await p.locator('.mn-person.open .mn-bank').count() === 1 && /Zz Money Test Tour/.test(await p.locator('.mn-person.open .mn-feed').innerText()), W + ': open card shows the bank card and the activity list');
    ok(/Cash you kept from guests[\s\S]{0,40}−100 GEL/.test(await p.locator('.mn-person.open .mn-feed').innerText()), W + ': the 100 GEL cash she kept is a minus line');
    await p.locator('.mn-person', { hasText: g.name }).locator('[data-act=mnpay][data-k=pay]').click(); await p.waitForTimeout(300);
    await p.fill('.mn-payf input[name=amount]', '25'); await p.selectOption('.mn-payf select[name=currency]', 'USD'); await p.click('.mn-payf button.primary'); await p.waitForTimeout(500);
    const after = await p.evaluate(a => window.__test.money.ledger(a.id, a.mo), g);
    ok(Math.abs((before.bal.USD || 0) - 25 - (after.bal.USD || 0)) < 0.01, W + ': paying 25 USD lowers the USD balance by 25');
    if (W === 390) await p.screenshot({ path: 'mn-team-390.png', fullPage: true });
    ok(/Paid out/.test(await p.locator('.mn-person', { hasText: g.name }).innerText()), W + ': the payout shows in the activity list');
    await p.locator('.mn-person', { hasText: g.name }).locator('[data-act=mnpay][data-k=gave]').click(); await p.waitForTimeout(300);
    await p.fill('.mn-payf input[name=amount]', '100'); await p.selectOption('.mn-payf select[name=currency]', 'GEL'); await p.click('.mn-payf button.primary'); await p.waitForTimeout(500);
    const after2 = await p.evaluate(a => window.__test.money.ledger(a.id, a.mo), g);
    ok(Math.abs((after2.bal.GEL || 0) - ((after.bal.GEL || 0) + 100)) < 0.01, W + ': cash handed to the office brings the GEL balance back up');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), W + ': Team does not stick out');
    // Guests: fill the missing price
    await p.click('[data-act=mntab][data-v=guests]'); await p.waitForTimeout(300);
    ok(await p.locator('#mnp-zmb2').count() === 1, W + ': the booking without a price is listed');
    await p.fill('#mnp-zmb2', '60'); await p.selectOption('#mny-zmb2', 'prepaid'); await p.click('[data-act=mnbk][data-id=zmb2]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => { const x = window.Store.db.bookings.find(y => y.id === 'zmb2'); return Number(x.price) === 60 && x.payment === 'prepaid'; }), W + ': price and payment type saved');
    ok(await p.locator('#mnp-zmb2').count() === 0, W + ': the filled booking leaves the list');
    // Setup: show balances to the team
    await p.click('[data-act=mntab][data-v=setup]'); await p.waitForTimeout(300);
    await p.check('form[data-form=mncfg] input[name=staffSee]'); await p.click('form[data-form=mncfg] button'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => !!((window.Store.db.settings.find(s => s.id === 'money') || {}).value || {}).staffSee), W + ': the switch is saved');
    if (W === 390) await p.screenshot({ path: 'mn-admin-390.png', fullPage: false });
    // The guide's own view
    await p.evaluate(a => { const s = document.querySelector('#demo-as'); const o = [...s.options].find(x => x.text.startsWith(a.name)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }, g); await p.waitForTimeout(700);
    await p.evaluate(async a => { const S = window.Store, gd = S.db.profiles.find(x => x.name === a.name), d = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      await S.save('tours', { id: 'zm1', title: 'Zz Money Test Tour', date: d, start_time: '10:00', end_time: '', kind: 'private', status: 'confirmed', capacity: 4, pax: 2, adults: 2, children: 0, guide_id: gd.id, driver_id: null, guide_pay: 40, driver_pay: null });
      await S.save('bookings', { id: 'zmb1', tour_id: 'zm1', guest: 'Test Guest One', pax: 2, adults: 2, children: 0, payment: 'cash', amount_due: 100, price: 100, currency: 'GEL', source: 'Direct', attendance: null, marks: [] });
      await S.save('settings', { id: 'money', value: { staffSee: true } }); }, g); await p.waitForTimeout(300);
    await p.evaluate(() => window.__test.go('me', 'month')); await p.waitForTimeout(500);
    ok(await p.locator('.mn-mine .mn-bank .mn-bn').count() === 1, W + ': the guide sees her balance card in Me > Pay');
    ok(await p.locator('.mn-mine [data-act=expnew]').count() === 1 && await p.locator('.mn-mine [data-act=mnpay]').count() === 0, W + ': she can add an expense but has no Pay button');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), W + ': Me > Pay does not stick out');
    if (W === 390) await p.screenshot({ path: 'mn-guide-390.png', fullPage: true });
    await p.context().close(); }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
