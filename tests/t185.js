// One standard look per tour (owner, 19 Nov): names linked to a catalogue tour show its short name and the same colour everywhere;
// the name it was booked under stays inside the tour. Invented tours with typical name spellings only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 400, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  await p.evaluate(async () => { const S = window.Store, td = window.__test.today();
    await S.save('tours', { id: 'zsn1', date: td, start_time: '06:10', title: 'Gareji 4x4 ENG', kind: 'group', status: 'confirmed', adults: 2, children: 0, pax: 2, capacity: 6 });
    await S.save('tours', { id: 'zsn2', date: td, start_time: '06:20', title: 'David Gareji & Rainbow Mountains 4x4 Small-Group Tour', kind: 'group', status: 'confirmed', adults: 1, children: 0, pax: 1, capacity: 6 });
    await S.save('tours', { id: 'zsn3', date: td, start_time: '06:30', title: 'Test unlinked walk', kind: 'group', status: 'confirmed', adults: 1, children: 0, pax: 1, capacity: 6 });
    window.__test.go('calendar'); });
  await p.waitForTimeout(600);
  const names = () => p.evaluate(() => [...document.querySelectorAll('.tname')].map(e => e.textContent.trim()));
  let n = await names();
  ok(n.includes('Gareji & Rainbow 4x4') && !n.includes('David Gareji & Rainbow Mountains 4x4 Small-Group Tour'), 'exact catalogue name shows the short name');
  ok(n.includes('Gareji 4x4 ENG') && n.includes('Test unlinked walk'), 'names not linked yet stay as they are');
  // link "Gareji 4x4 ENG" in Back office > Tour names linked to catalogue
  await p.evaluate(async () => { await window.Store.save('settings', { id: 'tour_links', value: { map: { 'gareji 4x4 eng': '307280' } } }); window.__test.resetMemo && window.__test.resetMemo(); window.__test.go('calendar'); });
  await p.waitForTimeout(600); n = await names();
  ok(n.filter(x => x === 'Gareji & Rainbow 4x4').length === 2 && !n.includes('Gareji 4x4 ENG'), 'linked name now shows the same short name: ' + JSON.stringify(n.slice(0, 4)));
  const col = await p.evaluate(() => { const c = id => { const e = document.querySelector(`[data-act=tour][data-id="${id}"] .emb, [data-id="${id}"] .emblem`); return e ? getComputedStyle(e).backgroundColor : 'none'; }; return [c('zsn1'), c('zsn2')]; });
  ok(col[0] === col[1] && col[0] !== 'none', 'same colour for both names: ' + col.join(' / '));
  await p.evaluate(() => window.__test.openTour('zsn1')); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const h = document.querySelector('#modal .thdr'); return /Gareji & Rainbow 4x4/.test(h.innerText) && /Booked as: Gareji 4x4 ENG/.test(h.innerText); }), 'tour sheet: short name and "Booked as" with the original name');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
