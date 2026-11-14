// My details: languages are ticked from a list (and an extra field for other codes), saved as "EN, RU". Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    await p.evaluate(() => { document.querySelector('.nav [data-v=me]').click(); }); await p.waitForTimeout(500);
    await p.evaluate(() => { const t = document.querySelector('[data-act=metab][data-v=profile], [data-v=profile]'); if (t) t.click(); }); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.querySelectorAll('#me-details .langpick input[type=checkbox]').length >= 10), w + ' languages are ticks');
    await p.evaluate(() => { document.querySelectorAll('#me-details .langpick input[type=checkbox]').forEach(x => { x.checked = ['DE', 'FR'].includes(x.value); }); });
    await p.click('#me-details .langpick > summary'); await p.fill('#me-details [name=languages_other]', 'sv'); await p.click('#me-details .qsave'); await p.waitForTimeout(800);
    const v = await p.evaluate(() => (window.Store.db.profiles.find(x => x.id === window.Store.me.id) || {}).languages);
    ok(v === 'DE, FR, SV', w + ' saved as a list (' + v + ')');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
