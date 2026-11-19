// A booking moved to another tour takes its guests with it: the old tour's count is redone (19 Nov: a GetYourGuide date change
// moved a guest from 20 to 18 Nov and 20 Nov still showed "1 guest" with no booking). Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext()).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  await p.evaluate(async () => { const S = window.Store, td = window.__test.today(), add = n => { const d = new Date(td + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    await S.save('tours', { id: 'zmA', date: add(9), start_time: '08:30', title: 'Test Gareji move', kind: 'group', status: 'confirmed', adults: 3, children: 0, pax: 3, capacity: 6 });
    await S.save('tours', { id: 'zmB', date: add(7), start_time: '08:30', title: 'Test Gareji move', kind: 'group', status: 'confirmed', adults: 0, children: 0, pax: 0, capacity: 6 });
    await S.save('bookings', { id: 'zbm1', tour_id: 'zmA', guest: 'Test Mover', adults: 1, children: 0, pax: 1, ref: 'TESTMOVE1', source: 'GetYourGuide', marks: [] });
    await S.save('bookings', { id: 'zbm2', tour_id: 'zmA', guest: 'Test Stayer', adults: 2, children: 0, pax: 2, ref: 'TESTSTAY1', source: 'GetYourGuide', marks: [] }); });
  // move one booking: open the other day's tour, put the booking in it (as the pasted-email change does), save
  const move = async (id, to) => { await p.evaluate(([id, to]) => { window.__test.openTour(to); }, [id, to]); await p.waitForTimeout(300);
    await p.evaluate(id => { const m = window.__test.modal(); m.edit = true; const bk = { ...window.Store.db.bookings.find(x => x.id === id) }; m.draft.bookings = m.draft.bookings.filter(x => x.id !== id); m.draft.bookings.push(bk); window.__test.renderModal(); }, id); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('form[data-form="tour"]').requestSubmit()); await p.waitForTimeout(700); };
  const pax = id => p.evaluate(id => { const t = window.Store.db.tours.find(x => x.id === id); return [t.adults, t.children, t.pax]; }, id);
  await move('zbm1', 'zmB');
  ok(JSON.stringify(await pax('zmB')) === '[1,0,1]', 'new day counts the moved guest: ' + JSON.stringify(await pax('zmB')));
  ok(JSON.stringify(await pax('zmA')) === '[2,0,2]', 'old day keeps only the staying booking: ' + JSON.stringify(await pax('zmA')));
  await move('zbm2', 'zmB');
  ok(JSON.stringify(await pax('zmA')) === '[0,0,0]', 'old day with no booking left shows 0 guests: ' + JSON.stringify(await pax('zmA')));
  ok(JSON.stringify(await pax('zmB')) === '[3,0,3]', 'new day has both: ' + JSON.stringify(await pax('zmB')));
  ok(await p.evaluate(() => window.Store.db.tours.find(x => x.id === 'zmA').status === 'confirmed'), 'the emptied tour is not cancelled by itself (the office decides)');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
