// Drivers next to a guide see the group size and only the guests who need a pick-up; transfers and tours without a guide show everyone;
// a pick-up added later shows as a change. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    const ids = await p.evaluate(async () => { const S = window.Store, d = new Date().toISOString().slice(0, 10), g = S.db.profiles.find(x => x.role === 'guide').id, dr = S.db.profiles.find(x => x.role === 'driver').id;
      const mk = async (title, kind, guide, bookings) => { const t = { id: S.uid(), date: d, date_to: null, start_time: '10:00', title, kind, capacity: 0, pax: bookings.reduce((n, x) => n + x[1], 0), adults: bookings.reduce((n, x) => n + x[1], 0), status: 'confirmed', guide_id: guide, driver_id: dr, pickup: 'Meeting Square' };
        await S.save('tours', t); for (const [guest, pax, addr, phone] of bookings) await S.save('bookings', { id: S.uid(), tour_id: t.id, guest, adults: pax, children: 0, pax, phone, pickup_addr: addr || null, marks: addr ? ['pickup'] : [] }); return t.id; };
      const a = await mk('Drv Group Test', 'private', g, [['Alpha Guest', 2, 'Hotel Alpha', '+995555000001'], ['Bravo Guest', 3, '', '+995555000002'], ['Charlie Guest', 1, '', '+995555000003']]);
      const t = await mk('Drv Transfer Test', 'transfer', g, [['Delta Guest', 2, '', '+995555000004']]);
      const n = await mk('Drv Alone Test', 'private', null, [['Echo Guest', 2, '', '+995555000005']]);
      return { a, t, n, dr, g }; });
    await p.selectOption('#demo-as', ids.dr); await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(600);
    const sheetOf = async id => { await p.evaluate(i => { const c = document.querySelector('[data-act=tour][data-id="' + i + '"]'); c && c.click(); }, id); await p.waitForTimeout(500); const t = await p.evaluate(() => (document.querySelector('.sheet') || {}).innerText || ''); await p.evaluate(() => { const c = document.querySelector('.sheet [data-act=close]'); c && c.click(); }); await p.waitForTimeout(300); return t; };
    let s = await sheetOf(ids.a);
    ok(/Alpha Guest/.test(s) && /Hotel Alpha/.test(s), w + ' driver sees the pick-up guest and address');
    ok(!/Bravo Guest|Charlie Guest|555000002|555000003/.test(s), w + ' driver does not see the other guests');
    ok(/Pick-up guests \(1\)/.test(s) && /4 more guests meet/.test(s), w + ' pick-up heading and "4 more guests" note');
    s = await sheetOf(ids.t); ok(/Delta Guest/.test(s), w + ' transfer: driver sees the guest');
    s = await sheetOf(ids.n); ok(/Echo Guest/.test(s), w + ' tour without a guide: driver sees everyone');
    // late request: a pick-up is added for Bravo
    await p.evaluate(async id => { const S = window.Store, b = S.db.bookings.find(x => x.tour_id === id && x.guest === 'Bravo Guest'); await S.save('bookings', { ...b, pickup_addr: 'Hotel Bravo', marks: ['pickup'] }); }, ids.a);
    await p.evaluate(() => document.querySelector('.nav [data-v=timeoff]').click()); await p.waitForTimeout(200); await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(600);
    ok(/pick-up changed/i.test(await p.evaluate(() => [...document.querySelectorAll('.tag.t-chg')].map(x => x.innerText).join('|'))), w + ' driver sees "pick-up changed"');
    s = await sheetOf(ids.a); ok(/Bravo Guest/.test(s) && /Hotel Bravo/.test(s) && !/Charlie Guest/.test(s), w + ' the new pick-up guest shows, Charlie still hidden');
    // the guide sees all
    await p.selectOption('#demo-as', ids.g); await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(500);
    s = await sheetOf(ids.a); ok(/Alpha Guest/.test(s) && /Bravo Guest/.test(s) && /Charlie Guest/.test(s), w + ' the guide sees every guest');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
