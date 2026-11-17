// iPhone shaking (17 Nov, second video): no overflow on html/body (Safari made the fixed bottom bar drift and the sticky day row shake),
// the bottom bar stays glued to the bottom while scrolling, the Team tab has its icon, and server updates wait while a finger scrolls.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(700);
  await p.evaluate(() => document.documentElement.classList.remove('fs-noclip'));   /* as on a real phone */
  const ov = await p.evaluate(() => [getComputedStyle(document.documentElement).overflowX, getComputedStyle(document.body).overflowX, getComputedStyle(document.querySelector('main')).overflowX]);
  ok(ov[0] === 'visible' && ov[1] === 'visible', 'html and body have no overflow rule (' + ov.join(',') + ')');
  ok(ov[2] === 'clip' || ov[2] === 'hidden', 'the content area still keeps the page from getting wider');
  for (const y of [0, 900, 2200]) {
    await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(150);
    const g = await p.evaluate(() => { const t = document.querySelector('.tabs').getBoundingClientRect(), s = document.querySelector('.strip').getBoundingClientRect(); return { tb: Math.round(t.bottom), vh: innerHeight, st: Math.round(s.top) }; });
    ok(Math.abs(g.tb - g.vh) <= 1, `scrolled to ${y}: bottom bar sits on the bottom edge (${g.tb}/${g.vh})`);
  }
  ok(await p.evaluate(() => { const b = document.querySelector('.tabs button[data-v=team] svg'); return !!b && b.innerHTML.trim().length > 20; }), 'Team tab has its icon');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the page is not wider than the phone');
  // a finger on the screen: redraws from the server wait
  await p.evaluate(() => document.dispatchEvent(new TouchEvent('touchstart', { bubbles: true })));
  ok(await p.evaluate(() => window.__test.busy()), 'while a finger is on the screen the app counts as busy');
  await p.evaluate(() => document.dispatchEvent(new TouchEvent('touchend', { bubbles: true }))); await p.waitForTimeout(700);
  ok(await p.evaluate(() => !window.__test.busy()), 'half a second after the finger lifts, redraws may happen again');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
