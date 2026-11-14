// Cancel a tour: quick reasons (weather, not enough guests, no staff...), the cancelled card is red-tinted. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(500);
  await p.click('.acard >> nth=0'); await p.waitForSelector('[data-act=tmore]'); await p.click('[data-act=tmore]'); await p.click('[data-act=cancelask]'); await p.waitForSelector('#cx-reason');
  ok(await p.locator('[data-act=cxpreset]').count() === 7, 'seven quick reasons');
  await p.click('[data-act=cxpreset][data-k=cxr_weather]'); ok(await p.inputValue('#cx-reason') === 'Bad weather', 'weather fills the reason');
  await p.click('[data-act=cxpreset][data-k=cxr_min]'); ok((await p.inputValue('#cx-reason')).startsWith('Not enough guests'), 'minimum fills the reason');
  await p.click('.sheet button.danger'); await p.waitForTimeout(900);
  const r = await p.evaluate(() => window.Store.db.tours.filter(t => t.status === 'cancelled' && /Not enough/.test(t.cancel_reason || '')).length); ok(r === 1, 'tour cancelled with that reason');
  await p.evaluate(() => { document.querySelector('[data-act=close]') && document.querySelector('[data-act=close]').click(); }); await p.waitForTimeout(500);
  const bg = await p.evaluate(() => { const c = document.querySelector('.acard.cancelled'); return c ? getComputedStyle(c).backgroundColor : ''; });
  const m = (bg.replace(/^[a-z]+\(?(srgb)?/i, '').match(/[\d.]+/g) || []).map(Number); ok(m.length >= 3 && m[0] > m[2], 'cancelled card is red-tinted (' + bg + ')');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
