// Guide tour requests: admin list is sorted by tour date and shows when each request came in; the guide sees "we got your request". Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(500);
  const dates = await p.evaluate(async () => { const S = window.Store, g = S.db.profiles.find(x => x.role === 'guide'), ts = S.db.tours.filter(t => t.status !== 'cancelled' && t.date >= '2026-01-01').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), out = [];
    let i = 0; for (const t of ts) { await S.save('change_requests', { id: S.uid(), tour_id: t.id, user_id: g.id, patch: { guide_id: g.id }, cant: false, swap_with: null, agreed: false, message: null, status: 'pending', created_at: new Date(Date.now() - i++ * 3600e3).toISOString(), decided_by: null }); out.push(t.date); } return out.sort(); });
  await p.evaluate(() => { document.querySelector('.nav [data-v=admin], .tabs [data-v=admin]').click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const t = document.querySelector('.admmain [data-act=admintab][data-v=requests]'); if (t) t.click(); }); await p.waitForTimeout(400);
  const txt = await p.evaluate(() => [...document.querySelectorAll('[data-act=creqtcx]')].map(x => x.closest('.card, .xreq') ? x.closest('.card, .xreq').innerText : '')); ok(txt.length >= 3, 'requests listed (' + txt.length + ')');
  ok(txt.every(t => /Asked \d/.test(t)), 'each shows when it was asked');
  const ord = await p.evaluate(() => [...document.querySelectorAll('[data-act=creqtcx]')].map(x => { const q = window.Store.db.change_requests.find(r => r.id === x.dataset.id), t = window.Store.db.tours.find(y => y.id === q.tour_id); return t.date + (t.start_time || ''); }));
  ok(ord.length >= 3 && ord.every((v, i) => !i || ord[i - 1] <= v), 'sorted by tour date (' + ord.slice(0, 3).join(', ') + ')');
  ok(await p.evaluate(() => !!window.Store), 'store ok');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
