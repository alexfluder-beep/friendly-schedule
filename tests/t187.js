// Time-off notice (owner, 19 Nov): Decline / Approve right in the notice, Open goes to the person's profile,
// and a waiting request shows at the top of that profile. Invented people and dates only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 400, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  const g = await p.evaluate(async () => { const S = window.Store, me = window.__test.meId(), td = window.__test.today(); const d = new Date(td + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 4); const day = d.toISOString().slice(0, 10);
    const guide = S.db.profiles.find(x => x.role === 'guide' && x.id !== me);
    await S.save('time_off', { id: 'zoff1', user_id: guide.id, date_from: day, date_to: day, type: 'dayoff', status: 'pending', note: null, created_at: new Date().toISOString(), decided_by: null });
    await S.save('notifications', { id: 'zn1', user_id: me, kind: 'off_requested', params: { name: guide.name, from: day, to: day }, read: false, created_at: new Date().toISOString() });
    return { id: guide.id, name: guide.name }; });
  await p.evaluate(() => document.querySelector('[data-act=bell]').click()); await p.waitForTimeout(400);
  const btns = await p.$$eval('#modal .nitem .nacts button', x => x.map(e => e.textContent.trim()));
  ok(btns.some(t => /Approve/.test(t)) && btns.some(t => /Decline/.test(t)) && btns.some(t => /Open/.test(t)), 'notice has Decline, Approve, Open: ' + JSON.stringify(btns));
  await p.click('#modal .nitem [data-act=offprof]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => { const m = window.__test.modal(); return m && m.type === 'person' && m.step === 3; }), 'Open shows the person, Time off step');
  ok(await p.evaluate(() => !!document.querySelector('#modal .offwait [data-act=offdecide][data-s=approved]')), 'waiting request at the top of the profile, with buttons');
  await p.click('#modal .offwait [data-act=offdecide][data-s=approved]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.Store.db.time_off.find(o => o.id === 'zoff1').status === 'approved'), 'approved from the profile');
  ok(await p.evaluate(() => !document.querySelector('#modal .offwait [data-id="zoff1"]')), 'that request is gone from the waiting block');
  await p.evaluate(() => { window.__test.go('calendar'); document.querySelector('[data-act=bell]').click(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.querySelector('#modal .nitem [data-act=offdecide][data-id="zoff1"]') && [...document.querySelectorAll('#modal .nitem .nacts .tag')].some(t => /Approved/i.test(t.textContent))), 'notice now shows Approved, no buttons');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
