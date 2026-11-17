// Owner's screenshots, 17 Nov: "Tours without a guide or driver" is in date order (not "asked first"); the page can never be wider than
// the phone (html/body overflow-x: clip), and the sticky day row still sticks at the top when the page scrolls. Invented data only.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(700);
  // a request on a later tour must not move it ahead of an earlier one
  await p.evaluate(async () => { const S = window.Store, db = S.db, g = db.profiles.find(x => x.role === 'guide'), d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const base = { kind: 'private', start_time: '10:00', end_time: '16:00', status: 'confirmed', capacity: 0, pax: 2, adults: 2, children: 0, guide_id: null, driver_id: null };
    await S.save('tours', { ...base, id: 'zo1', title: 'Zz Order Early', date: d(3) }); await S.save('tours', { ...base, id: 'zo2', title: 'Zz Order Late', date: d(9) });
    await S.save('change_requests', { id: S.uid(), tour_id: 'zo2', user_id: g.id, kind: 'take', role: 'guide_id', status: 'pending', created_at: new Date().toISOString() }); });
  await p.evaluate(() => document.querySelector('.tabs [data-v=tasks]').click()); await p.waitForTimeout(500);
  const dates = await p.evaluate(() => [...document.querySelectorAll('.xcard .xrow [data-act=tour]')].map(b => b.dataset.id).map(id => window.Store.db.tours.find(t => t.id === id)).filter(Boolean).map(t => t.date + (t.start_time || '')));
  ok(dates.length > 1 && dates.every((x, i) => !i || dates[i - 1] <= x), 'tours without staff are in date order: ' + dates.map(x => x.slice(5, 10)).join(' '));
  await p.evaluate(() => document.documentElement.classList.remove('fs-noclip'));   /* the live app has the guard on */
  const ov = await p.evaluate(() => [getComputedStyle(document.querySelector('main')).overflowX, getComputedStyle(document.documentElement).overflowX]);
  ok(ov[0] === 'clip' && ov[1] === 'visible', 'sideways overflow is clipped on the content, not on html/body (iPhone, 17 Nov): ' + ov.join());
  // a too-wide element cannot widen the page
  ok(await p.evaluate(() => { const d = document.createElement('div'); d.style.width = '1200px'; d.style.height = '2px'; document.querySelector('main').appendChild(d); const w = document.documentElement.scrollWidth; d.remove(); return w <= innerWidth; }), 'a 1200 px element does not widen the page');
  // sticky day row still sticks
  await p.evaluate(() => document.querySelector('.tabs [data-v=calendar]').click()); await p.waitForTimeout(500);
  const st = await p.evaluate(async () => { const s = [...document.querySelectorAll('.strip.sroll')].find(x => x.offsetParent); const pos = getComputedStyle(s).position; scrollTo(0, 900); await new Promise(r => setTimeout(r, 300)); return { pos, top: Math.round(s.getBoundingClientRect().top), sy: scrollY }; });
  ok(st.pos !== 'sticky' || (st.sy > 0 && st.top >= 0 && st.top < 200), 'the day row stays at the top while scrolling: ' + JSON.stringify(st));
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
