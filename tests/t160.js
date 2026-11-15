// Duplicate guests: same booking code, and names with operational tags (PACK, PICK UP, time) match. List only, nothing merged. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const db = window.Store.db; const t = db.tours[0];
    db.clients.push({ id: 'zz1', name: 'Zorro Tester', phone: '', email: '' }, { id: 'zz2', name: 'Z. Tester Other', phone: '', email: '' }, { id: 'zz3', name: '10:30 Quentin Sample PACK', phone: '', email: '' }, { id: 'zz4', name: 'Quentin Sample PICK UP', phone: '', email: '' });
    db.bookings.push({ id: 'zb1', tour_id: t.id, client_id: 'zz1', ref: 'ZZREF12345', guest: 'x', pax: 1 }, { id: 'zb2', tour_id: t.id, client_id: 'zz2', ref: 'zzref12345', guest: 'y', pax: 1 });
    return 1; });
  ok(r === 1, 'test data added');
  const g = await p.evaluate(() => window.__test.dupClients().map(x => ({ n: x.members.map(m => m.id).sort().join(','), w: x.why })));
  const byRef = g.find(x => x.n === 'zz1,zz2'); ok(byRef && byRef.w.includes('dup_ref'), 'same booking code groups two guests ' + JSON.stringify(g.slice(0, 3)));
  const byTag = g.find(x => x.n === 'zz3,zz4'); ok(!!byTag && byTag.w.includes('dup_name'), 'names with PACK / PICK UP / time match');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
