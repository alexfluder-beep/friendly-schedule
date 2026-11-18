// Holiday answers are real (owner, 18 Nov): "Day off" makes the same pending day-off request as Time off, "Can work" takes it back
// while it waits, the card shows the request state, and answers saved earlier get their request when the app opens. Invented data only.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  const gname = await p.$$eval('#demo-as option', o => o.map(x => x.textContent).find(t => /Guide/.test(t)));
  await p.selectOption('#demo-as', { label: gname }); await p.waitForTimeout(600);
  const days = await p.evaluate(async () => { const S = window.Store, td = window.__test.today(), add = n => { const d = new Date(td + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const r = (S.db.settings.find(x => x.id === 'rules') || { value: {} }).value; await S.save('settings', { id: 'rules', value: { ...r, holAsk: add(20) + '..' + add(22) } });
    return [add(20), add(21), add(22)]; });
  await p.evaluate(() => window.__test.go('calendar')); await p.waitForTimeout(500);
  ok(await p.$('.holcard') !== null, 'the holiday card shows for a guide');
  const me = await p.evaluate(() => window.Store.me.id);
  const offs = d => p.evaluate(([uid, d]) => window.Store.db.time_off.filter(o => o.user_id === uid && o.date_from <= d && o.date_to >= d).map(o => o.status + ':' + o.type), [me, d]);
  await p.click(`.holcard [data-act=holset][data-d="${days[0]}"][data-v="0"]`); await p.waitForTimeout(500);
  ok(JSON.stringify(await offs(days[0])) === '["pending:dayoff"]', 'Day off makes a pending day-off request');
  ok(await p.evaluate(() => window.Store.db.notifications ? window.Store.db.notifications.some(n => n.kind === 'off_requested') : true), 'the office is told');
  ok(await p.$eval(`.holcard [data-act=holset][data-d="${days[0]}"]`, b => b.closest('.holday').textContent.includes('Pending')), 'the card shows Pending next to the day');
  await p.click(`.holcard [data-act=holset][data-d="${days[0]}"][data-v="0"]`); await p.waitForTimeout(400);
  ok((await offs(days[0])).length === 1, 'tapping Day off again does not make a second request');
  await p.click(`.holcard [data-act=holset][data-d="${days[0]}"][data-v="1"]`); await p.waitForTimeout(400);
  ok((await offs(days[0])).length === 0, 'Can work takes the waiting request back');
  // an answer saved earlier without a request gets one when the app opens
  await p.evaluate(async ([uid, d]) => { const S = window.Store, m = S.db.profiles.find(x => x.id === uid), disp = m.display || {}; await S.save('profiles', { ...m, display: { ...disp, hol: { ...(disp.hol || {}), [d]: 0 } } }); }, [me, days[1]]);
  ok((await offs(days[1])).length === 0, 'old answer: no request yet');
  await p.evaluate(() => { const b = document.querySelector('[data-act=refresh]'); if (b) b.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => window.__test.holSync && window.__test.holSync()); await p.waitForTimeout(600);
  ok(JSON.stringify(await offs(days[1])) === '["pending:dayoff"]', 'old Day off answer gets its request');
  // an approved day off stays when the person changes the answer
  await p.evaluate(async ([uid, d]) => { const S = window.Store, o = S.db.time_off.find(x => x.user_id === uid && x.date_from === d); await S.save('time_off', { ...o, status: 'approved' }); }, [me, days[1]]);
  await p.click(`.holcard [data-act=holset][data-d="${days[1]}"][data-v="1"]`); await p.waitForTimeout(400);
  ok(JSON.stringify(await offs(days[1])) === '["approved:dayoff"]', 'an approved day off is kept (only the office changes it)');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'nothing sticks out');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
