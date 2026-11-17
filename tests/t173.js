// Back office > Tour names (owner, 17 Nov): one row per schedule tour name with a suggested catalogue tour; nothing is linked until Save;
// after Save the short name finds its catalogue tour, so "Tours I do" works on it (guide-as-driver here). Clearing a link removes it.
// Nothing sticks out at 390. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const W of [1280, 390]) {
    const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
    const SHORT = 'Tusheti 4x4 3 days', MAYBE = 'Tusheti weekend', CAT = '319104';
    await p.evaluate(async s => { const S = window.Store, d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), base = { kind: 'group', start_time: '07:00', end_time: '', status: 'confirmed', capacity: 6, pax: 2, adults: 2, children: 0, guide_id: null, driver_id: null };
      await S.save('tours', { ...base, id: 'zl1', title: s[0], date: d(-30) }); await S.save('tours', { ...base, id: 'zl2', title: s[0], date: d(30) }); await S.save('tours', { ...base, id: 'zl3', title: s[1], date: d(20) }); }, [SHORT, MAYBE]);
    ok(await p.evaluate(s => window.__test.catFind(s), SHORT) === null, W + ': before: the short name is not in the catalogue');
    await p.evaluate(() => { const t = document.querySelector('.tabs [data-v=admin], [data-v=admin]'); if (t) t.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'admintab'; el.dataset.v = 'tourlinks'; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }); await p.waitForTimeout(400);
    const row = p.locator('.tlrow', { hasText: SHORT }); ok(await row.count() === 1, W + ': a row for the short name');
    ok(/Suggested/.test(await row.innerText()) && (await row.locator('select').inputValue()) === CAT, W + ': the matching catalogue tour is suggested');
    ok(await p.evaluate(s => window.__test.catFind(s), SHORT) === null, W + ': nothing linked before Save');
    { const mr = p.locator('.tlrow', { hasText: MAYBE }); ok(/Maybe: 3-Day Tusheti/.test(await mr.innerText()) && (await mr.locator('select').inputValue()) === '', W + ': an uncertain name shows "Maybe" and is not pre-selected'); }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.tlrow select')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), W + ': nothing sticks out');
    if (W < 760) ok(await p.evaluate(() => { const s = document.querySelector('.stickbar').getBoundingClientRect(), t = document.querySelector('.tabs').getBoundingClientRect(); return s.bottom <= t.top + 1; }), W + ': the Save bar is not hidden behind the bottom menu');
    await p.click('[data-act=tlsave]'); await p.waitForTimeout(700);
    ok(String(await p.evaluate(s => window.__test.catFind(s), SHORT)) === CAT, W + ': after Save the short name finds its catalogue tour');
    const dr = await p.evaluate(async () => { const S = window.Store; await S.save('profiles', { id: 'zg9', name: 'Zed Carguide', role: 'guide', active: true, vehicle: 'sedan', skills: ['319104'], languages: 'EN' }); return window.__test.fitIds(S.db.tours.find(t => t.id === 'zl2'), 'driver'); });
    ok(dr.includes('zg9'), W + ': a guide with this tour on her list is now suggested as driver for it');
    await p.locator('.tlrow', { hasText: SHORT }).locator('select').selectOption(''); await p.click('[data-act=tlsave]'); await p.waitForTimeout(600);
    ok(await p.evaluate(s => window.__test.catFind(s), SHORT) === null, W + ': clearing the link removes it');
    await p.context().close(); }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
