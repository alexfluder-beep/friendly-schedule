// Hover card on a team name in the admin calendar side panel. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(500);
  const n = await p.locator('.sidepanel .cpp[data-act=whoset]').count(); ok(n >= 1, 'team rows in side panel: ' + n);
  if (n) {
    await p.locator('.sidepanel .cpp[data-act=whoset]').last().hover(); await p.waitForTimeout(300);
    ok(await p.locator('.pcard').count() === 1, 'hover card shows');
    const txt = await p.locator('.pcard').innerText(); console.log(txt.replace(/\n+/g, ' | '));
    ok(/\d/.test(txt), 'card has numbers');
    await p.mouse.move(5, 5); await p.waitForTimeout(300);
    ok(await p.locator('.pcard').count() === 0, 'card hides');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
