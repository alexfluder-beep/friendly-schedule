// Admin calendar: team panel slides in and out from the left (like Setmore). Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); localStorage.removeItem('fs-side'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(500);
    const x = () => p.evaluate(() => Math.round(document.querySelector('#sidepanel').getBoundingClientRect().right));
    ok(await p.evaluate(() => !!document.querySelector('.sidetoggle')), w + ' toggle button exists');
    if (w >= 900) {
      ok((await x()) > 100, w + ' panel is open on a computer');
      const names = await p.evaluate(() => document.querySelectorAll('#sidepanel .cpp[data-n]').length); ok(names > 3, w + ' lists the team (' + names + ')');
      await p.fill('#sideq', 'zzzz-nobody'); await p.waitForTimeout(200);
      ok(await p.evaluate(() => [...document.querySelectorAll('#sidepanel .cpp[data-n]')].every(e => e.hidden)), w + ' search hides non-matching names');
      await p.fill('#sideq', ''); await p.waitForTimeout(200);
      const openL = await p.evaluate(() => document.querySelector('.calmain').getBoundingClientRect().left);
      await p.evaluate(() => document.querySelector('.sidetoggle').click()); await p.waitForTimeout(600);
      const calW = await p.evaluate(() => document.querySelector('.calmain').getBoundingClientRect().left);
      ok(calW < openL - 100, w + ' closing gives the calendar the room (' + openL + ' to ' + calW + ')');
      await p.evaluate(() => document.querySelector('.sidetoggle').click()); await p.waitForTimeout(600);
      ok((await x()) > 100, w + ' opens again');
      const id = await p.evaluate(() => { const e = [...document.querySelectorAll('#sidepanel [data-act=whoset]')].find(e => e.dataset.v); e.click(); return e.dataset.v; }); await p.waitForTimeout(400);
      ok(await p.evaluate(i => document.querySelector('#sidepanel [data-act=whoset][data-v="' + i + '"]').classList.contains('on'), id), w + ' chosen person is highlighted');
      await p.screenshot({ path: 'cal-side-open.png' });
    } else {
      ok((await x()) <= 0, w + ' panel is hidden on a phone at start');
      await p.evaluate(() => document.querySelector('.sidetoggle').click()); await p.waitForTimeout(600);
      ok((await x()) > 100, w + ' panel slides over the calendar');
      await p.screenshot({ path: 'cal-side-phone.png' });
      await p.evaluate(() => [...document.querySelectorAll('#sidepanel [data-act=whoset]')].find(e => e.dataset.v).click()); await p.waitForTimeout(600);
      ok((await x()) <= 0, w + ' panel closes after choosing a person');
    }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
