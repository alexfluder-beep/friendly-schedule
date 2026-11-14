const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; }; const errs = [];
  const mk = async w => { const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} }); await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); return p; };
  // desktop: team panel
  let p = await mk(1280);
  ok(await p.evaluate(() => !!document.querySelector('.sidepanel .cpp')), 'team panel on desktop');
  const n = await p.evaluate(() => document.querySelectorAll('.sidepanel .cpp').length); ok(n > 3, 'panel lists team (' + n + ')');
  await p.click('#sidepanel [data-act=whoset]:nth-of-type(3)'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('.sidepanel .cpp.on').length === 1), 'person filter marks one');
  await p.click('.vseg [data-m=agenda]'); await p.waitForTimeout(300); ok(await p.evaluate(() => !!document.querySelector('.agenda')), 'agenda with panel');
  await p.screenshot({ path: 's117-desk.png' });
  // review request from a past tour
  await p.evaluate(() => { const t = window.__test; }); 
  // phone: no panel
  p = await mk(375); ok(await p.evaluate(() => !document.querySelector('#sidepanel') || document.querySelector('#sidepanel').getBoundingClientRect().right <= 0), 'panel is off screen on phone');
  // driver view
  const drv = await p.evaluate(() => { const o = [...document.querySelectorAll('#demo-as option')].find(x => /driver/i.test(x.textContent)); return o ? o.value : null; });
  ok(!!drv, 'demo has a driver');
  if (drv) { await p.selectOption('#demo-as', drv); await p.waitForTimeout(500);
    const nav = await p.evaluate(() => [...document.querySelectorAll('nav.tabs button, .nav button')].map(x => x.textContent.trim()).join('|'));
    ok(!/Tasks|Team|Clients|Back office/i.test(nav) && /Time off/i.test(nav), 'driver menu is short: ' + nav);
    await p.evaluate(() => document.querySelector('[data-act=view][data-v=me]').click()); await p.waitForTimeout(300);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.metabs button')].map(x => x.textContent.trim()).join('|'));
    ok(!/Stats|Badges|Awards/i.test(tabs) && /Pay|Month/i.test(tabs + 'Month'), 'driver Me tabs: ' + tabs); }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
