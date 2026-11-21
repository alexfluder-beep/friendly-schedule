// 3.95 batch A: only completed tours are owed (upcoming shown apart), version chip for guides, Tours I do grouped. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Mariam (sample) · Guide' }); await p.waitForTimeout(700);
  /* 21 Nov (owner): the version label is for admins only */ ok(await p.locator('.verchip').count() === 0, 'no version chip for a guide');
  const mo = await p.evaluate(() => { const db = window.Store.db, pid = db.profiles.find(x => /Mariam/.test(x.name)).id, base = db.tours.find(t => t.guide_id === pid), td = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10), up = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), mo = td.slice(0, 7);
    db.tours = db.tours.filter(t => !(t.guide_id === pid && t.date.slice(0, 7) === mo)); const mk = (id, date, pay) => db.tours.push({ ...base, id, date, date_to: null, guide_pay: pay, driver_id: null, status: 'confirmed', title: 'Owed test ' + id }); mk('zpast', td, 500); mk('zfut', up > td && up.slice(0, 7) === mo ? up : td, 300); db.pay_adjustments = db.pay_adjustments.filter(x => !(x.user_id === pid && x.month === mo)); db.bookings.forEach(x => { if (x.tour_id === 'zpast' || x.tour_id === 'zfut') x.payment = null; }); window.__fut = up.slice(0, 7) === mo; return mo; });
  const fut = await p.evaluate(() => window.__fut);
  await p.evaluate(() => { const t = document.querySelector('[data-v=me]'); if (t) t.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { const e = document.createElement('button'); e.dataset.act = 'metab'; e.dataset.v = 'month'; e.hidden = true; document.querySelector('main').appendChild(e); e.click(); }); await p.waitForTimeout(200);
  await p.evaluate(m => { const e = document.createElement('button'); e.dataset.act = 'paymonth'; e.dataset.m = m; e.hidden = true; document.querySelector('main').appendChild(e); e.click(); }, mo); await p.waitForTimeout(400);
  const t = await p.locator('.stmt').innerText();
  if (fut) { ok(/Upcoming this month/.test(t) && /300/.test(t), 'upcoming tour shown apart: ' + t.replace(/\s+/g, ' ').slice(0, 160)); const hero = await p.locator('.stmt .earnhero').innerText(); ok(/500/.test(hero) && !/800/.test(hero), 'You earn counts only the completed tour: ' + hero.replace(/\s+/g, ' ')); }
  else ok(true, 'end of month: no upcoming day inside this month, skipped');
  await p.evaluate(() => { const t = document.querySelector('[data-v=me]'); if (t) t.click(); }); await p.waitForTimeout(200);
  await p.evaluate(() => { const e = document.createElement('button'); e.dataset.act = 'metab'; e.dataset.v = 'profile'; e.hidden = true; document.querySelector('main').appendChild(e); e.click(); }); await p.waitForTimeout(300);
  ok(await p.locator('#me-tours .mtk').count() >= 2, 'Tours I do is grouped (Group, Private, Transfers)');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
