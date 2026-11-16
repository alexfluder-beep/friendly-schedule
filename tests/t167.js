// Task 13 (owner's video, 16 Nov): the day row is one row you swipe through: 70 days (2 weeks back, 8 ahead), the shown week fills the width
// at load, weekend names marked, a month label where a month starts; tapping a day in a later week shows that week and keeps the day where
// the finger was; a data refresh keeps the swipe position. Invented data only (sample data).
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [390, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(700);
    const row = () => p.evaluate(() => { const el = [...document.querySelectorAll('.strip.sroll')].find(x => x.offsetParent), y = el.getBoundingClientRect(); const vis = [...el.querySelectorAll('button')].filter(b => { const x = b.getBoundingClientRect(); return x.left >= y.left - 1 && x.right <= y.right + 1; }).map(b => b.dataset.date); return { n: el.querySelectorAll('button').length, vis, wk: el.dataset.wk, we: [...el.querySelectorAll('button.we')].every(b => [0, 6].includes(new Date(b.dataset.date + 'T12:00').getDay())), mons: [...el.querySelectorAll('.smon')].map(s => s.textContent), x: el.scrollLeft, pageW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }; });
    let r = await row();
    ok(r.n === 70 && r.vis.length === 7 && r.vis[0] === r.wk, `${w}: 70 days in the row, the shown week (7 days from Monday) fills the width`);
    ok(r.we, `${w}: only Saturdays and Sundays are marked as weekend`);
    ok(r.mons.length >= 3, `${w}: month labels where months start: ` + r.mons.join(' '));
    ok(r.pageW === r.vw, `${w}: the page itself does not scroll sideways`);
    // swipe ahead 3 weeks, tap a day there
    await p.evaluate(() => { const el = [...document.querySelectorAll('.strip.sroll')].find(x => x.offsetParent); el.scrollLeft += el.clientWidth * 3; }); await p.waitForTimeout(250);
    const t = await p.evaluate(() => { const el = [...document.querySelectorAll('.strip.sroll')].find(x => x.offsetParent), y = el.getBoundingClientRect(); const b = [...el.querySelectorAll('button')].find(b => { const x = b.getBoundingClientRect(); return x.left >= y.left + 20 && x.right <= y.right; }); return { d: b.dataset.date, x: Math.round(b.getBoundingClientRect().left) }; });
    await p.click(`.strip.sroll:visible [data-date="${t.d}"]`); await p.waitForTimeout(500);
    const a = await p.evaluate(d => { const el = [...document.querySelectorAll('.strip.sroll')].find(x => x.offsetParent); return { x: Math.round(el.querySelector(`[data-date="${d}"]`).getBoundingClientRect().left), wk: el.dataset.wk }; }, t.d);
    const mon = await p.evaluate(d => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); }, t.d);
    ok(a.wk === mon, `${w}: tapping ${t.d} shows its week (${mon})`);
    ok(Math.abs(a.x - t.x) <= 1, `${w}: the tapped day stays where the finger was (${t.x} → ${a.x})`);
    // a refresh (render) keeps the swipe position
    await p.evaluate(() => { const el = [...document.querySelectorAll('.strip.sroll')].find(x => x.offsetParent); el.scrollLeft += 60; el.dispatchEvent(new Event('scroll')); }); await p.waitForTimeout(150);
    const before = (await row()).x; await p.evaluate(() => document.querySelector('[data-act=view][data-v=calendar]').click()); await p.waitForTimeout(400);
    ok(Math.abs((await row()).x - before) <= 1, `${w}: a refresh keeps the swipe position`);
    await p.context().close(); }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
