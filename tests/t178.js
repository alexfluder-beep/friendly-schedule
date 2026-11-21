// Ideas from the Sava demo (18 Nov): Team "People · next 14 days", the person editor in 3 steps, the tour window (seats bar, Collected / Left to pay,
// big + Booking) and the guide day report (send, office accepts or pays). Invented data only.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  const g = await p.evaluate(async () => { const S = window.Store, gd = S.db.profiles.find(x => x.role === 'guide' && x.active !== false), td = window.__test.today();
  /* 21 Nov: pay 400 so the day payout stays above the cash taken (100 USD) whatever the day's exchange rate; at 40 it failed once real rates loaded. */
    await S.save('tours', { id: 'zs1', title: 'Zz Seats Tour', date: td, start_time: '10:00', kind: 'group', status: 'confirmed', capacity: 10, pax: 3, adults: 3, children: 0, guide_id: gd.id, driver_id: null, guide_pay: 400 });
    await S.save('bookings', { id: 'zsb1', tour_id: 'zs1', guest: 'Test Guest A', pax: 2, adults: 2, children: 0, payment: 'prepaid', price: 100, currency: 'USD', source: 'Viator', attendance: null, marks: [] });
    await S.save('bookings', { id: 'zsb2', tour_id: 'zs1', guest: 'Test Guest B', pax: 1, adults: 1, children: 0, payment: 'cash', amount_due: 50, price: 50, currency: 'GEL', source: 'Direct', attendance: null, marks: [] });
    return { id: gd.id, name: gd.name, td }; });
  // 1. Team: People · next 14 days
  await p.evaluate(() => window.__test.go('team')); await p.waitForTimeout(400);
  ok(await p.locator('#tm-days14').count() === 1 && await p.evaluate(() => document.querySelector('#tm-days14').getBoundingClientRect().top < document.querySelector('#tm-today').getBoundingClientRect().top), 'Team starts with People · next 14 days');
  const row = p.locator('.d14row', { hasText: g.name }); ok(await row.count() === 1 && await row.locator('.d14c').count() === 14, '14 days for each person');
  ok(await row.locator('.d14c').first().evaluate(e => e.classList.contains('busy')), 'today is busy for the guide with the test tour');
  await p.fill('[data-ch=d14q]', 'zz seats'); await p.waitForTimeout(300); ok(await p.locator('.d14row:visible').count() === 1, 'search by tour name finds the guide');
  await p.fill('[data-ch=d14q]', ''); await p.waitForTimeout(500); await p.click('[data-act=d14f][data-v=driver]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('.d14row .d14who .small.muted')].every(e => /Driver/.test(e.textContent))), 'Drivers filter shows drivers only');
  await p.click('[data-act=d14f][data-v=all]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Team does not stick out on a phone');
  // 2. Person editor in 3 steps
  await p.locator('.d14row', { hasText: g.name }).locator('[data-act=pedit]').click(); await p.waitForTimeout(400);
  ok(await p.locator('.psteps [data-act=pstep]').count() === 3, 'editor has 3 steps');
  await p.fill('#pe-phone', '+995 555 000 111');
  await p.click('.psteps [data-act=pstep][data-v="2"]'); await p.waitForTimeout(200);
  ok(await p.locator('.pstep[data-s="2"]').isVisible() && !(await p.locator('.pstep[data-s="1"]').isVisible()), 'step 2 shows the tours, step 1 is hidden');
  await p.click('[data-act=skall][data-v="1"]'); const n = await p.locator('.pform [data-sk]:checked').count(); ok(n > 3, 'Tick all ticks every tour (' + n + ')');
  await p.click('[data-act=skall][data-v="0"]'); ok(await p.locator('.pform [data-sk]:checked').count() === 0, 'Clear unticks them');
  await p.click('.psteps [data-act=pstep][data-v="3"]'); await p.waitForTimeout(200); ok(await p.locator('.pstep[data-s="3"]').isVisible(), 'step 3: when not working');
  await p.click('.pform button.primary'); await p.waitForTimeout(500);
  ok(await p.evaluate(id => window.Store.db.profiles.find(x => x.id === id).phone === '+995 555 000 111', g.id), 'the phone typed in step 1 was saved after switching steps');
  // 3. Tour window
  await p.evaluate(() => window.__test.openTour('zs1')); await p.waitForTimeout(400);
  ok(await p.locator('.seatbar').count() === 1 && /3\/10/.test(await p.locator('.seatbar').innerText()), 'seats bar 3/10');
  const mf = await p.locator('.mfoot').innerText(); ok(/100 USD/.test(mf) && /50 GEL/.test(mf), 'Collected 100 USD, left to pay 50 GEL (' + mf.replace(/\s+/g, ' ') + ')');
  ok(await p.locator('.addbk [data-act=touredit][data-add]').count() === 1, 'big + Booking button');
  await p.click('.addbk [data-act=touredit]'); await p.waitForTimeout(400); ok(await p.evaluate(() => (window.Store && true) && document.querySelectorAll('[data-form=tour] input[data-bf="guest"]').length >= 3), '+ Booking opens the editor with a new empty guest');
  await p.evaluate(() => window.__test.go('calendar')); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 4a. Office: a waiting report in Money › Team, paid with one button
  await p.evaluate(async id => { const S = window.Store, td = window.__test.today(), pr = S.db.profiles.find(x => x.id === id); await S.save('profiles', { ...pr, display: { ...(pr.display || {}), dayrep: { [td]: { at: new Date().toISOString(), note: 'from test' } } } }); }, g.id);
  await p.evaluate(() => window.__test.go('admin', 'money')); await p.waitForTimeout(300); await p.click('[data-act=mntab][data-v=team]'); await p.waitForTimeout(400);
  const li = p.locator('.drli', { hasText: g.name }); ok(await li.count() === 1 && /Waiting/.test(await li.innerText()), 'office sees the waiting day report');
  await li.locator('[data-act=dropen]').click(); await p.waitForTimeout(300);
  const before = await p.evaluate(id => window.Store.db.staff_payments.filter(x => x.user_id === id).length, g.id);
  await p.locator('.drli.open button[name=st][value=paid]').click(); await p.waitForTimeout(600);
  const pays = await p.evaluate(id => window.Store.db.staff_payments.filter(x => x.user_id === id), g.id);
  ok(pays.length === before + 1 && pays[pays.length - 1].amount > 0, 'Pay writes one payout for the day (' + (pays[pays.length - 1] || {}).amount + ')');
  ok(await p.evaluate(id => ((window.Store.db.settings.find(x => x.id === 'dayrep') || {}).value || {})[id][window.__test.today()].st === 'paid', g.id), 'the report is marked settled');
  await p.click('[data-act=drf][data-v=all]'); await p.waitForTimeout(300);
  ok(/Settled/.test(await p.locator('.drli', { hasText: g.name }).innerText()), 'the list shows it as Settled');
  // 4. Day report: the guide sends, the office pays
  await p.evaluate(() => { const s = document.querySelector('#demo-as'); const o = [...s.options].find(x => /Guide/.test(x.text)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(700);
  const me = await p.evaluate(async () => { const S = window.Store, m = S.me ? S.db.profiles.find(x => x.id === S.me.id) : null, id = (m || {}).id || window.__test.meId && window.__test.meId(); return id; });
  await p.evaluate(async () => { const S = window.Store, td = window.__test.today(), id = document.querySelector('#demo-as').value; await S.save('tours', { id: 'zs2', title: 'Zz Report Tour', date: td, start_time: '09:00', kind: 'private', status: 'confirmed', capacity: 4, pax: 2, adults: 2, children: 0, guide_id: id, driver_id: null, guide_pay: 40 }); await S.save('bookings', { id: 'zsb3', tour_id: 'zs2', guest: 'Test Guest C', pax: 2, adults: 2, children: 0, payment: 'cash', amount_due: 30, price: 30, currency: window.__test.money ? 'USD' : 'USD', source: 'Direct', attendance: null, marks: [] }); });
  await p.evaluate(async () => { await window.Store.save('settings', { id: 'dayrep', value: {} }); });   /* start clean after the office test */
  await p.evaluate(() => window.__test.go('me', 'month')); await p.waitForTimeout(500);
  ok(await p.locator('.drcard').count() === 1, 'the guide sees the day report in Me › Pay');
  ok(/40/.test(await p.locator('.drcard').innerText()), 'it shows the pay for the day');
  await p.fill('form[data-form=drsend] input[name=note]', 'test note'); await p.click('form[data-form=drsend] button.primary'); await p.waitForTimeout(500);
  ok(/Waiting/.test(await p.locator('.drcard').innerText()), 'after sending: Waiting');
  const gid = await p.evaluate(() => window.Store.me.id);
  // the office side (same demo data, switch back without rebuilding is not possible: check the module directly)
  const st = await p.evaluate(id => { const td = window.__test.today(); const pr = window.Store.db.profiles.find(x => x.id === id); return pr && pr.display && pr.display.dayrep && pr.display.dayrep[td] && pr.display.dayrep[td].note; }, gid);
  ok(st === 'test note', 'the report is saved on the guide profile');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Me › Pay does not stick out');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
