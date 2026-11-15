// Office: "Needs review" card on the calendar, and one-tap Assign for an open tour on Tasks. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(700);
  const tid = await p.evaluate(async () => { const db = window.Store.db, base = db.tours.find(t => t.guide_id && t.kind === 'private'), tomorrow = new Date(Date.now() + 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10), id = 'znr1'; db.tours.push({ ...base, id, title: base.title, date: tomorrow, date_to: null, start_time: '09:00', end_time: '12:00', guide_id: null, driver_id: null, status: 'confirmed' }); db.bookings.push({ id: 'znrb1', tour_id: id, guest: 'Nina Sample', adults: 2, children: 0, pax: 2, price: 0, payment: 'prepaid', marks: [], currency: 'USD' }); return id; });
  await p.evaluate(() => { const t = document.querySelector('.tabs [data-v=calendar], [data-v=calendar]'); if (t) t.click(); }); await p.waitForTimeout(600);
  ok(await p.locator('.nrcard').count() === 1, 'Needs review card is on the calendar');
  await p.locator('.nrcard summary').click(); await p.waitForTimeout(200);
  const t = await p.locator('.nrcard').innerText(); ok(/within 24 hours/.test(t) && /without a price/.test(t), 'lists the tour without staff and the guest without a price: ' + t.replace(/\s+/g, ' ').slice(0, 200));
  await p.evaluate(() => { const e = document.createElement('button'); e.dataset.act = 'tasktab'; e.hidden = true; });
  await p.evaluate(() => { const t = document.querySelector('.tabs [data-v=tasks], [data-v=tasks]'); if (t) t.click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const e = [...document.querySelectorAll('[data-act]')].find(x => /xtab|tab/.test(x.dataset.act) && /staff/i.test(x.textContent)); if (e) e.click(); }); await p.waitForTimeout(400);
  const n = await p.locator('.qfit').count(); ok(n > 0, 'one-tap suggestion shown on Tasks: ' + n);
  if (n) { const mine = p.locator('.qfit').filter({ has: p.locator('[data-x]') }); const first = p.locator('.qfit[data-id="znr1"]').first(); const has = await first.count(); ok(has > 0, 'suggestion for the new open tour'); if (has) { await first.click(); await p.waitForTimeout(600); const st = await p.evaluate(id => { const t = window.Store.db.tours.find(x => x.id === id); return !!(t.guide_id || t.driver_id); }, tid); ok(st, 'tapping Assign staffs the tour'); } }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
