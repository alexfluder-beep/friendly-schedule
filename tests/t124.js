// Guides and drivers: a line says how fresh the screen is; my own tours show "New" / "Changed" until I open them. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    const gid = await p.evaluate(() => window.Store.db.profiles.find(x => x.role === 'guide').id);
    await p.selectOption('#demo-as', gid); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(400);
    ok(await p.locator('.syncrow .sage').count() === 1, w + ' guide sees the "updated" line');
    ok(/updated|just now|min/i.test(await p.locator('.syncrow .sage').innerText()), w + ' line text: ' + await p.locator('.syncrow .sage').innerText());
    // a new tour for this guide, then a time change
    const tid = await p.evaluate(async gid => { const S = window.Store, d = new Date().toISOString().slice(0, 10), t = { id: S.uid(), date: d, date_to: null, start_time: '10:00', title: 'Change mark test', kind: 'private', capacity: 0, pax: 2, status: 'confirmed', guide_id: gid }; await S.save('tours', t); return t.id; }, gid);
    await p.evaluate(() => document.querySelector('.nav [data-v=tasks]').click()); await p.waitForTimeout(200); await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(500);
    const tag = () => p.evaluate(() => { const c = [...document.querySelectorAll('.acard, .nxt')].filter(x => x.innerText.includes('Change mark test') || x.dataset.id); const t = document.querySelector('.tag.t-chg'); return t ? t.innerText.trim() : ''; });
    ok(/new/i.test(await tag()), w + ' new tour is marked New: ' + await tag());
    await p.evaluate(id => { const c = document.querySelector('[data-act=tour][data-id="' + id + '"]'); c && c.click(); }, tid); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('.sheet [data-act=close]') && document.querySelector('.sheet [data-act=close]').click()); await p.waitForTimeout(300);
    ok(await p.locator('.tag.t-chg').count() === 0, w + ' mark gone after opening');
    await p.evaluate(async id => { const S = window.Store, t = S.db.tours.find(x => x.id === id); await S.save('tours', { ...t, start_time: '11:30' }); }, tid);
    await p.evaluate(() => document.querySelector('.nav [data-v=tasks]').click()); await p.waitForTimeout(200); await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(500);
    const t2 = await tag(); ok(/changed/i.test(t2) && /10:00/.test(t2), w + ' changed tour shows what it was: ' + t2);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways scroll');
    // admin sees no marks and no extra line
    await p.selectOption('#demo-as', { index: 0 }); await p.waitForTimeout(500);
    ok(await p.locator('.syncrow .sage').count() === 0, w + ' admin has no extra line');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
