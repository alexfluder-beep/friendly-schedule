// Home screen: a button opens the e-mail reader as a popup and the log lists what was read. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [1280, 375]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('.nav [data-v=calendar]').click()); await p.waitForTimeout(400);
    ok(await p.evaluate(() => !!document.querySelector('.mailbtn')), w + ' e-mail button on the home screen');
    await p.evaluate(() => document.querySelector('.mailbtn').click()); await p.waitForTimeout(400);
    ok(await p.evaluate(() => !!document.querySelector('#modal #pb-text')), w + ' popup has the paste box');
    const mail = 'Booking reference: GYGTEST123\nTour: Tbilisi walking tour\nDate: 2030-05-04 10:00\nMain customer: Test Guest\nNumber of participants: 2 Adults\nPhone: +995555000111\nNew booking';
    await p.fill('#pb-text', mail); await p.click('#modal [data-act=pbread]'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => !!document.querySelector('#modal') && /GYGTEST123/.test(document.querySelector('#modal').innerText)), w + ' result shows inside the popup');
    ok(await p.evaluate(() => /Email read|GYGTEST123/.test(document.querySelector('#modal').innerText) && document.querySelector('#modal').innerText.includes('E-mails read recently')), w + ' log block is shown');
    await p.waitForTimeout(500); await p.evaluate(() => document.querySelector('#modal [data-act=close]').click()); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !document.querySelector('#modal #pb-text')), w + ' popup closes');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
