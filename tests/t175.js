// Tapping a day in the day row must move the page once, straight to that day: no jump to the top and back (iPhone video, 17 Nov),
// the day heading ends just under the sticky day row, and on a later week the month name is not cut. Invented data only.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.waitForTimeout(800);
  const rec = () => p.evaluate(() => { window.__ys = []; const t0 = performance.now(); const f = () => { window.__ys.push(Math.round(scrollY)); if (performance.now() - t0 < 1800) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (const [label, start, nth] of [['later day', 300, 5], ['earlier day', 2600, 0]]) {
    await p.evaluate(y => window.scrollTo(0, y), start); await p.waitForTimeout(400);
    const y0 = await p.evaluate(() => scrollY); await rec();
    const btn = p.locator('.strip button.inwk').nth(nth), date = await btn.getAttribute('data-date'); await btn.tap(); await p.waitForTimeout(1900);
    const ys = await p.evaluate(() => window.__ys), end = ys[ys.length - 1], up = end < y0;
    const mono = ys.every((y, i) => i === 0 || (up ? y <= ys[i - 1] + 2 : y >= ys[i - 1] - 2));
    ok(mono, `${label}: the page moves one way only (${y0} → ${end}; ${ys.filter((_, i) => i % 8 === 0).join(',')})`);
    const pos = await p.evaluate(d => { const x = document.getElementById('day-' + d), s = document.querySelector('.strip'); return x ? { top: Math.round(x.getBoundingClientRect().top), under: Math.round(s.getBoundingClientRect().bottom) } : null; }, date);
    const atEnd = await p.evaluate(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 3);
    ok(pos && pos.top >= pos.under - 2 && (pos.top <= pos.under + 40 || atEnd), `${label}: the day heading sits just under the day row (${JSON.stringify(pos)})`);
  }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.click('.calhd [data-act=nav][data-d="1"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const t = document.querySelector('.calttl'), b = t.querySelector('b'); return b.getBoundingClientRect().right <= t.getBoundingClientRect().right + 1 && b.scrollWidth <= b.clientWidth + 1; }), 'next week: the month name fits (' + await p.locator('.calttl').innerText() + ')');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
