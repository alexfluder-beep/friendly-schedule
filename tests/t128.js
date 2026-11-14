// Back office: on a computer a left panel lists every section and the section opens on the right; on a phone the tiles stay. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('.nav [data-v=admin]').click()); await p.waitForTimeout(400);
    const vis = sel => p.evaluate(s => [...document.querySelectorAll(s)].some(e => e.offsetParent !== null), sel);
    if (w >= 900) {
      ok(await vis('.admnav'), w + ' left panel is shown');
      ok(!(await vis('.admmain .tiles')), w + ' tiles are hidden');
      const n = await p.evaluate(() => document.querySelectorAll('.admnav .admitem').length); ok(n >= 24, w + ' panel lists the sections (' + n + ')');
      await p.evaluate(() => [...document.querySelectorAll('.admnav .admitem')].find(x => x.dataset.v === 'money').click()); await p.waitForTimeout(500);
      ok(await p.evaluate(() => document.querySelector('.admnav [aria-current=page]').dataset.v) === 'money', w + ' chosen section is marked');
      ok(/Money/i.test(await p.evaluate(() => document.querySelector('.admmain h2') ? document.querySelector('.admmain h2').innerText : '')), w + ' section opens on the right');
      ok(!(await vis('.admmain .backbar>.btn[data-act=admintab]')), w + ' no back button needed');
      await p.evaluate(() => [...document.querySelectorAll('.admnav .admitem')].find(x => x.dataset.v === 'catalog').click()); await p.waitForTimeout(400);
      ok(await p.evaluate(() => document.querySelector('.admnav [aria-current=page]').dataset.v) === 'catalog', w + ' switching sections works without going back');
      ok(await p.evaluate(() => { const a = document.querySelector('.admnav').getBoundingClientRect(), m = document.querySelector('.admmain').getBoundingClientRect(); return a.right <= m.left + 1; }), w + ' panel is left of the content');
    } else {
      ok(!(await vis('.admnav')), w + ' no left panel on a phone');
      ok(await vis('.admmain .tiles'), w + ' tiles stay on a phone');
    }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
    if (w >= 900) await p.screenshot({ path: 'admin-left-panel.png' });
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
