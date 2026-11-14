// Money screen (admin): missing-payment finder, payment in, payment to staff, commission rule. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    // a finished tour this month with one priced booking and no payment yet
    await p.evaluate(async () => { const S = window.Store, id = () => S.uid(), d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const t = { id: id(), date: d, date_to: null, start_time: '09:00', title: 'Money test tour', kind: 'private', capacity: 6, pax: 2, status: 'confirmed', guide_id: S.db.profiles.find(p => p.role === 'guide').id };
      await S.save('tours', t); await S.save('bookings', { id: id(), tour_id: t.id, guest: 'Test Guest', adults: 2, children: 0, pax: 2, source: 'GetYourGuide', price: 200, currency: 'GEL', attendance: null }); });
    await p.evaluate(() => document.querySelector('.nav [data-v=admin]').click()); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-act=admintab][data-v=money]').click()); await p.waitForTimeout(400);
    let h = await p.evaluate(() => document.body.innerText);
    ok(/Money test tour/.test(h) && /Missing payments/.test(h), w + ' missing payment listed');
    // commission rule for the platform, then for this tour (tour wins)
    await p.evaluate(() => { const f = document.querySelector('form[data-form=mcomm]'); f.platform.value = 'GetYourGuide'; f.percent.value = '30'; f.valid_from.value = '2020-01-01'; f.requestSubmit(); }); await p.waitForTimeout(400);
    await p.evaluate(() => { const f = document.querySelector('form[data-form=mcomm]'); f.platform.value = 'GetYourGuide'; f.tour_key.value = 'money test tour'; f.percent.value = '10'; f.valid_from.value = '2020-01-01'; f.requestSubmit(); }); await p.waitForTimeout(400);
    const exp = await p.evaluate(() => { const S = window.Store; return { rules: S.db.commission_rules.length, tbl: [...document.querySelectorAll('table')].map(t => t.innerText).join('|') }; });
    ok(exp.rules === 2, w + ' two commission rules saved');
    ok(/180/.test(exp.tbl), w + ' tour rule (10%) wins: expected 180 of 200');
    // payment in covers it: tour leaves the missing list
    await p.evaluate(() => { const f = document.getElementById('m-pay'); f.tour_id.selectedIndex = [...f.tour_id.options].findIndex(o => /Money test tour/.test(o.text)); f.amount.value = '180'; f.currency.value = 'GEL'; f.bank.value = 'Test Bank'; f.tx_code.value = 'TX1'; f.requestSubmit(); }); await p.waitForTimeout(500);
    h = await p.evaluate(() => document.body.innerText);
    ok(/No missing payments/.test(h), w + ' no missing payment after receiving 180');
    ok(/Test Bank/.test(h) && /TX1/.test(h), w + ' bank and code shown');
    // payment to staff in USD gets a GEL value
    await p.evaluate(() => { const f = document.querySelector('form[data-form=mstaff]'); f.user_id.selectedIndex = 0; f.amount.value = '50'; f.currency.value = 'USD'; f.gel_rate.value = '2.7'; f.requestSubmit(); }); await p.waitForTimeout(500);
    const sp = await p.evaluate(() => window.Store.db.staff_payments.map(x => x.gel_amount));
    ok(sp.length === 1 && Math.abs(sp[0] - 135) < 0.01, w + ' staff payment 50 USD = 135 GEL');
    await p.evaluate(() => { const f = document.querySelector('form[data-form=mstaff]'); f.user_id.value = ''; f.payee_name.value = 'Outside Driver'; f.amount.value = '100'; f.currency.value = 'GEL'; f.requestSubmit(); }); await p.waitForTimeout(500);
    ok(await p.evaluate(() => window.Store.db.staff_payments.some(x => !x.user_id && x.payee_name === 'Outside Driver' && x.gel_amount === 100)) && (await p.evaluate(() => document.body.innerText)).includes('Outside Driver'), w + ' payment to a person outside the team is saved and shown');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
    await p.screenshot({ path: `s122-${w}.png`, fullPage: true });
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
