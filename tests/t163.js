// Paste e-mail shows the result of the work: after the tour form is saved, a "Done" card says what was added (guest, people, tour, new or
// existing), with an "Open tour" button and a "saved:" log line; closing the form without saving gives a "Not saved" card. Invented data only.
const { chromium } = require('playwright');
const MAIL = (ref, name, pax) => `Booking Reference: ${ref}\nTour Name: Old Tbilisi Walking Tour\nTravel Date: Thu, Dec 10, 2026\nLead Traveler Name: ${name}\nTravelers: ${pax} Adults\nPhone: +995 500 000 009`;
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  const openPm = async () => { await p.evaluate(() => { const e = document.querySelector('[data-act=pastemail]'); if (e) e.click(); }); await p.waitForSelector('#pb-text'); await p.waitForTimeout(200); };
  const paste = async t => { await openPm(); await p.fill('#pb-text', t); await p.click('[data-act=pbread]'); await p.waitForTimeout(300); };
  const text = () => p.evaluate(() => (document.querySelector('.sheet') || document.body).innerText);
  // 1. read, add, save the form → Done card
  await paste(MAIL('BR-2000000001', 'Zed Tester', 2));
  ok(await p.locator('[data-act=pbgo][data-m=add]').count() === 1, 'booking read, Add button shown');
  await p.click('[data-act=pbgo][data-m=add]'); await p.waitForTimeout(500);
  ok(await p.locator('form[data-form=tour]').count() === 1, 'tour form opened with the booking');
  await p.click('form[data-form=tour] > .actions button.primary'); await p.waitForTimeout(900);
  await openPm();
  let v = await text();
  ok(/Done/.test(v) && /Added Zed Tester \(BR-2000000001\), 2 people, to Old Tbilisi Walking Tour/.test(v) && /new tour created/.test(v), 'Done card: added guest, people, tour, new tour: ' + (v.match(/Added[^\n]*/) || [''])[0]);
  ok(await p.locator('.pbres [data-act=tour]').count() === 1, 'Open tour button on the card');
  ok(/saved: Added Zed Tester/.test(v), 'log line says saved');
  await p.click('.pbres [data-act=tour]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('.sheet') && /Old Tbilisi Walking Tour/.test(document.querySelector('.sheet').innerText)), 'Open tour opens the tour sheet');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 2. second guest joins the same tour → "joined the existing tour"
  await paste(MAIL('BR-2000000002', 'Yan Tester', 1));
  await p.click('[data-act=pbgo][data-m=add]'); await p.waitForTimeout(500); await p.click('form[data-form=tour] > .actions button.primary'); await p.waitForTimeout(900);
  await openPm(); v = await text();
  ok(/Added Yan Tester \(BR-2000000002\), 1 people, to Old Tbilisi Walking Tour/.test(v) && /joined the existing tour/.test(v), 'second guest joined the existing tour');
  // 3. open, then close without saving → Not saved card
  await paste(MAIL('BR-2000000003', 'Xi Tester', 3));
  await p.click('[data-act=pbgo][data-m=add]'); await p.waitForTimeout(500);
  await p.click('.sheet [data-act=close]'); await p.waitForTimeout(400);
  const conf = p.locator('.sheet button.primary', { hasText: /Leave|Discard|Close|Yes/ }); if (await conf.count()) { await conf.first().click(); await p.waitForTimeout(400); }
  await openPm(); v = await text();
  ok(/Not saved/.test(v) && /Xi Tester BR-2000000003 is not in the schedule/.test(v), 'closing the form without saving gives a Not saved card');
  ok(!/Xi Tester/.test(await p.evaluate(() => JSON.stringify(window.Store.db.bookings.map(x => x.guest)))), 'and the guest really was not saved');
  // 4. the ✕ on the card clears it
  await p.click('.pbres [data-act=pbclear]'); await p.waitForTimeout(200); ok(await p.locator('.pbres').count() === 0, 'card can be dismissed');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
