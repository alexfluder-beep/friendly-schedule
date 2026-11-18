// Edit tour: a walking tour never gets driver suggestions in "Who fits this tour"; a day trip does. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  await p.getByRole('button', { name: '+ Tour' }).first().click(); await p.waitForSelector('#t-title'); /* 18 Nov: a date two months ahead, so the sample drivers are free (on some days both are already busy and the check failed by chance) */ const fut = await p.evaluate(() => { const d = new Date(window.__test.today() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 60); return d.toISOString().slice(0, 10); }); await p.fill('#t-date', fut); await p.dispatchEvent('#t-date', 'change'); await p.waitForTimeout(200);
  const fits = async title => { await p.fill('#t-title', title); await p.dispatchEvent('#t-title', 'change'); await p.waitForTimeout(500); return await p.locator('.sheet details.sect:has-text("Who fits")').innerText().catch(() => ''); };
  const w = await fits('Tbilisi walking tour'); ok(!/\bDriver\b/.test(w), 'walking tour: no driver suggestions');
  const k = await fits('Kazbegi 4x4 group'); ok(/\bDriver\b/.test(k), 'day trip: drivers are still suggested');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
