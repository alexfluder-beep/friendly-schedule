// Money > Setup (since the 17 Nov Money module): commission rules per platform and per tour (the tour rule wins). Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    await p.evaluate(async () => { const S = window.Store, d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await S.save('tours', { id: 'zc1', date: d, date_to: null, start_time: '09:00', title: 'Money test tour', kind: 'private', capacity: 6, pax: 2, status: 'confirmed', guide_id: S.db.profiles.find(p => p.role === 'guide').id });
      await S.save('bookings', { id: 'zcb1', tour_id: 'zc1', guest: 'Test Guest', adults: 2, children: 0, pax: 2, source: 'GetYourGuide', price: 200, currency: 'GEL', attendance: null }); });
    await p.evaluate(() => window.__test.go('admin', 'money')); await p.waitForTimeout(300);
    await p.click('[data-act=mntab][data-v=setup]'); await p.waitForTimeout(300);
    await p.evaluate(() => { const f = document.querySelector('form[data-form=mcomm]'); f.platform.value = 'GetYourGuide'; f.percent.value = '30'; f.valid_from.value = '2020-01-01'; f.requestSubmit(); }); await p.waitForTimeout(400);
    ok(await p.evaluate(() => Math.round(window.__test.netOf(window.Store.db.bookings.find(x => x.id === 'zcb1')))) === 140, w + ' platform rule 30%: we get 140 of 200');
    await p.evaluate(() => { const f = document.querySelector('form[data-form=mcomm]'); f.platform.value = 'GetYourGuide'; f.tour_key.value = 'money test tour'; f.percent.value = '10'; f.valid_from.value = '2020-01-01'; f.requestSubmit(); }); await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.Store.db.commission_rules.length) === 2, w + ' two commission rules saved');
    ok(await p.evaluate(() => Math.round(window.__test.netOf(window.Store.db.bookings.find(x => x.id === 'zcb1')))) === 180, w + ' tour rule (10%) wins: 180 of 200');
    await p.click('[data-act=mntab][data-v=ov]'); await p.waitForTimeout(300);
    ok(/Money test tour/.test(await p.locator('.mn').innerText()), w + ' the tour is in Overview');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
