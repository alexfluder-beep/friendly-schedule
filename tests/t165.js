// Task 11: the office types what the agent really pays ("We get") next to the price the client paid. The commission tile then shows the
// real difference and %; empty keeps the fixed % (shown as the placeholder); the typed amount is saved and used by netOf (profit). Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.querySelector('[data-act=newtour]'); if (e) e.click(); }); await p.waitForSelector('#t-title');
  await p.fill('#t-title', 'We get test tour'); await p.fill('#t-date', '2026-12-05'); await p.fill('#t-start', '10:00');
  await p.click('[data-act=badd]'); await p.waitForTimeout(200);
  await p.fill('[data-bi="0"][data-bf=guest]', 'Zed Tester'); await p.fill('[data-bi="0"][data-bf=ref]', 'GYGZZZZTEST1'); await p.waitForTimeout(150);
  await p.selectOption('[data-bi="0"][data-bf=source]', 'GetYourGuide').catch(() => {}); await p.fill('[data-bi="0"][data-bf=price]', '198'); await p.waitForTimeout(300);
  const tiles = () => p.evaluate(() => { const g = document.querySelector('#gm-0'); const inp = g && g.querySelector('[data-bf=net_amount]'); return { txt: g ? g.innerText.replace(/\s+/g, ' ') : '', ph: inp ? inp.placeholder : null, val: inp ? inp.value : null }; });
  let t = await tiles();
  ok(t.ph === '148.5' && t.val === '' && /49\.5 USD · 25%/.test(t.txt) && /fixed %/.test(t.txt), 'empty: placeholder shows the fixed-% amount, commission 25%: ' + JSON.stringify(t));
  await p.fill('[data-bi="0"][data-bf=net_amount]', '160'); await p.waitForTimeout(250); t = await tiles();
  ok(/38 USD · 19\.2%/.test(t.txt) && /Commission \(real\)/.test(t.txt) && /We get \(typed\)/.test(t.txt), 'typed 160: commission shows the real 38 USD · 19.2%: ' + t.txt);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.bf === 'net_amount'), 'typing keeps the cursor in the box');
  await p.click('form[data-form=tour] > .actions button.primary'); await p.waitForTimeout(900);
  const saved = await p.evaluate(() => { const db = window.Store.db, t = db.tours.find(x => x.title === 'We get test tour'), b = db.bookings.find(x => x.tour_id === t.id); return { net: b.net_amount, price: b.price, netOf: window.__test.netOf(b) }; });
  ok(saved.net === 160 && saved.price === 198 && saved.netOf === 160, 'saved: price 198, net_amount 160, profit uses 160: ' + JSON.stringify(saved));
  const fix = await p.evaluate(() => window.__test.netOf({ price: 198, source: 'GetYourGuide', ref: 'GYGX', net_amount: null }));
  ok(Math.abs(fix - 148.5) < 0.01, 'no typed amount: profit uses price minus the fixed 25% (148.5)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.evaluate(() => { const t = window.Store.db.tours.find(x => x.title === 'We get test tour'); window.__test.openTour(t.id); }); await p.waitForTimeout(400);
  const v = await p.evaluate(() => (document.querySelector('.sheet') || document.body).innerText);
  ok(/Guests paid 198 USD · we get 160 USD/.test(v), 'tour sheet: Guests paid 198 USD · we get 160 USD');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
