// Review items A1, A2, A4, A7: no pay chip when nobody is paid on a tour; a tour without a start time (or 00:00) says "time not set";
// cash collected shows cents with the same separator; placeholder guest names (Guest, Test) are never VIP and rank after real people;
// client counts get thousands separators. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  const r = await p.evaluate(async () => { const S = window.Store, db = S.db, td = new Date().toISOString().slice(0, 10), g = db.profiles.find(x => x.role === 'guide');
    await S.save('tours', { id: 'zt9', title: 'Zz Unlisted Test Tour', kind: 'private', date: td, start_time: '00:00', end_time: '', pickup: '', guide_id: g.id, driver_id: null, status: 'confirmed', capacity: 0, pax: 0, adults: 0, children: 0, guide_pay: 0, driver_pay: 0 });
    await S.save('clients', { id: 'zc8', name: 'Guest', phone: '', email: '' }); await S.save('clients', { id: 'zc9', name: 'Zed Realperson', phone: '', email: '' });
    for (let i = 0; i < 3; i++) { await S.save('bookings', { id: 'zb8' + i, tour_id: 'zt9', client_id: 'zc8', guest: 'Guest', adults: 1, children: 0, pax: 1, marks: [] }); await S.save('bookings', { id: 'zb9' + i, tour_id: 'zt9', client_id: 'zc9', guest: 'Zed Realperson', adults: 1, children: 0, pax: 1, marks: [] }); }
    const T = window.__test;
    return { ph: ['Guest', 'guest 2', 'TEST', 'Walk-in', '', '-', 'Zed Realperson', 'John Pack'].map(T.placeholderName), vipG: T.isVip('zc8'), list: T.clientHits('', 500), nf2: [T.nf2(177.38), T.nf2(177), T.nf2(1234.5)], tm: [T.tmTxt({ start_time: '00:00' }), T.tmTxt({ start_time: '' }), T.tmTxt({ start_time: '10:30' })] }; });
  ok(JSON.stringify(r.ph) === JSON.stringify([true, true, true, true, true, true, false, false]), 'placeholder names detected, real names not: ' + JSON.stringify(r.ph));
  ok(r.vipG === false, '"Guest" is never VIP');
  ok(r.list.indexOf('Zed Realperson') < r.list.indexOf('Guest'), 'real person ranked before "Guest" with the same bookings');
  ok(r.nf2[0] === '177.38' && r.nf2[1] === '177' && r.nf2[2] === '1,234.5', 'cash with cents, whole numbers plain, same separator: ' + r.nf2.join(' | '));
  ok(/time not set/.test(r.tm[0]) && /time not set/.test(r.tm[1]) && r.tm[2] === '10:30', '00:00 and empty show "time not set"');
  // the card on the calendar: no pay chip, "time not set" in the time slot
  await p.click('.tabs [data-v=calendar]').catch(() => {}); await p.evaluate(() => { const e = document.querySelector('[data-act=refresh], [data-act=reload]'); if (e) e.click(); }); await p.waitForTimeout(500);
  const card = await p.evaluate(() => { const el = [...document.querySelectorAll('.acard')].find(x => /Zz Unlisted Test Tour/.test(x.textContent)); return el ? { pay: !!el.querySelector('.mchip.pay'), txt: el.textContent.replace(/\s+/g, ' ') } : null; });
  ok(card && !card.pay, 'no pay chip on a tour where nobody is paid');
  ok(card && /time not set/.test(card.txt), 'card says "time not set": ' + (card || {}).txt.slice(0, 80));
  await p.evaluate(() => { const e = document.querySelector('.tabs [data-v=clients]'); if (e) e.click(); }); await p.waitForTimeout(600);
  const cnt = await p.evaluate(() => (document.body.innerText.match(/([0-9,]+)\s*\n?\s*clients/i) || ['', ''])[1]);
  ok(/^\d{1,3}(,\d{3})*$/.test(cnt), 'client count has thousands separators: ' + cnt);
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
