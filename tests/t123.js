// Free tours: the "Tips received" button shows only when the tour has a free-tour guest; the amount is saved and listed. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    await p.evaluate(async () => { const S = window.Store, id = () => S.uid(), d = new Date().toISOString().slice(0, 10), g = S.db.profiles.find(x => x.role === 'guide').id;
      const mk = async (title, src) => { const t = { id: id(), date: d, date_to: null, start_time: '10:00', title, kind: 'group', capacity: 20, pax: 3, status: 'confirmed', guide_id: g }; await S.save('tours', t);
        await S.save('bookings', { id: id(), tour_id: t.id, guest: 'Guest ' + title, adults: 3, children: 0, pax: 3, source: src, attendance: null }); };
      await mk('Free walk test', 'FreeTour'); await mk('Paid walk test', 'GetYourGuide'); });
    const open = async name => { await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(300); await p.evaluate(n => { const c = [...document.querySelectorAll('.chip')].find(x => x.innerText.includes(n)); if (c) c.click(); }, name); await p.waitForTimeout(400); };
    await open('Paid walk test'); ok(await p.locator('.sheet [data-act=tipsin]').count() === 0, w + ' no tips button on a paid tour');
    await p.evaluate(() => document.querySelector('.sheet [data-act=close]') && document.querySelector('.sheet [data-act=close]').click()); await p.waitForTimeout(200);
    await open('Free walk test'); ok(await p.locator('.sheet [data-act=tipsin]').count() === 1, w + ' tips button on a free tour');
    await p.evaluate(() => document.querySelector('.sheet [data-act=tipsin]').click()); await p.waitForTimeout(300);
    await p.evaluate(() => { const f = document.querySelector('form[data-form=tips]'); f.amount.value = '85'; f.currency.value = 'GEL'; f.requestSubmit(); }); await p.waitForTimeout(500);
    ok(await p.evaluate(() => window.Store.db.tour_tips.length === 1 && window.Store.db.tour_tips[0].amount === 85), w + ' tip saved');
    ok(/85/.test(await p.evaluate(() => document.querySelector('.sheet').innerText)), w + ' tip total shown');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
