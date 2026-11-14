const { chromium } = require('playwright');
const R1 = `5
Guest R
United States
Nov 13, 2026
Old Tbilisi Highlights and Hidden Gems Guided Walking Tour
Great guide, we learned so much about the old town and the food. Highly recommend this tour to anyone visiting.
Guide
5
Language
5
Value for money
5
Pace
5
Accuracy
5
Transportation
5
Show details
Booking reference GYGX7M34VZH5
Travel date Nov 12, 2026
Traveler type Solo`;
const R2 = `4
GetYourGuide traveler
Nov 10, 2026
Kazbegi Day Trip
Nice trip but the road stops were short and we wanted more time at the church for photos.
Pace 3
Guide 5
Value for money 4
Replied on Nov 11, 2026`;
(async () => { const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; }; const errs = [];
  const p = await (await b.newContext({ viewport: { width: 375, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  const go = async t => { await p.click('.tabs [data-v=admin]'); await p.click('[data-act=admintab][data-v=email]'); await p.fill('#pb-text', t); await p.click('[data-act=pbread]'); await p.waitForTimeout(300); return p.evaluate(() => document.body.innerText); };
  let v = await go(R1);
  ok(/Review read/.test(v) && /GYGX7M34VZH5/.test(v) && /Guest R/.test(v) && /Solo/.test(v), 'R1 read: ref, name, type');
  ok(/Guide: 5/.test(v) && /Transport: 5/.test(v) && /Accuracy: 5/.test(v), 'R1 six ratings by label');
  ok(/Great guide/.test(v), 'R1 comment');
  ok(await p.evaluate(() => !!document.querySelector('[data-act=rvsave]') && !!document.querySelector('[data-act=rvwrong]')), 'two buttons');
  await p.click('[data-act=rvsave]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => window.__test && true), 'saved without crash');
  v = await go(R2);
  ok(/Pace: 3/.test(v) && /Guide: 5/.test(v) && /Value: 4/.test(v) && /Stars\s*4/.test(v), 'R2 order differs, labels read');
  ok(/We replied on/.test(v), 'R2 replied');
  await p.click('[data-act=rvwrong]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !document.querySelector('[data-act=rvsave]')), 'wrong closes preview');
  // booking mail still reads
  await p.click('.tabs [data-v=admin]'); await p.click('[data-act=admintab][data-v=email]'); await p.fill('#pb-text', 'Booking Reference: BR-1000000001\nTour Name: Old Tbilisi Walking Tour\nTravel Date: Thu, Nov 12, 2026\nLead Traveler Name: Test Person\nTravelers: 2 Adults'); await p.click('[data-act=pbread]'); await p.waitForTimeout(300);
  ok(/BR-1000000001/.test(await p.evaluate(() => document.body.innerText)) && !/Review read/.test(await p.evaluate(() => document.body.innerText)), 'booking mail not mistaken for review');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
