// Tasks on the calendar are short (owner, 19 Nov): only the reader's language, the how-to text behind "Details", and for the office
// the same task for several people is one line with the names. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 400, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip');
  const td = await p.evaluate(async () => { const S = window.Store, td = window.__test.today(), drv = S.db.profiles.filter(x => x.role === 'driver').slice(0, 2).map(x => x.id);
    const title = 'Fill in the test card / Заполните тестовую карточку / შეავსეთ სატესტო ბარათი', notes = 'Open the test screen and press Save.\nОткройте тестовый экран и нажмите Сохранить.\nგახსენით სატესტო ეკრანი და დააჭირეთ შენახვას.';
    for (const [i, id] of drv.entries()) await S.save('tasks', { id: 'ztk' + i, title, notes, assignees: [id], due_date: td, status: 'open', kind: 'task' });
    await S.save('tasks', { id: 'ztk9', title: 'Single test task', notes: 'Call the test office.', assignees: [drv[0]], due_date: td, status: 'open', kind: 'task' });
    window.__test.go('calendar'); return td; });
  await p.waitForTimeout(600);
  const view = () => p.evaluate(() => [...document.querySelectorAll('.tkline')].map(e => ({ grp: e.classList.contains('tkgrp'), text: e.innerText, open: !!e.querySelector('details[open]'), det: !!e.querySelector('details.tkmore') })));
  let v = await view();
  const grp = v.find(x => /Fill in the test card/.test(x.text));
  ok(grp && grp.grp && /2 people/.test(grp.text) && /Open in Tasks/.test(grp.text), 'office: one line for the same task of two people');
  ok(v.filter(x => /test card/.test(x.text)).length === 1, 'not one card per person');
  ok(grp && !/Заполните|შეავსეთ/.test(grp.text), 'English reader sees only the English title');
  const one = v.find(x => /Single test task/.test(x.text));
  ok(one && one.det && !one.open && !/Call the test office/.test(one.text), 'how-to text is hidden behind Details');
  await p.evaluate(() => [...document.querySelectorAll('.tkline')].find(e => /Single test task/.test(e.innerText)).querySelector('details.tkmore summary').click()); await p.waitForTimeout(200);
  ok(/Call the test office/.test((await view()).find(x => /Single test task/.test(x.text)).text), 'Details opens it');
  await p.evaluate(() => [...document.querySelectorAll('.tkgrp')].find(e => /test card/.test(e.innerText)).querySelector('[data-act=tkopen]').click()); await p.waitForTimeout(600);
  ok(await p.evaluate(() => /Fill in the test card/.test(document.querySelector('main').innerText) && !/Заполните тестовую/.test(document.querySelector('main').innerText)), 'Open in Tasks shows the tasks, English only');
  // a Russian reader gets the Russian part
  await p.evaluate(async () => { const S = window.Store; await S.save('profiles', { ...S.me, lang: 'ru' }); window.__test.go('calendar'); }); await p.waitForTimeout(600);
  v = await view(); ok(v.some(x => /Заполните тестовую карточку/.test(x.text) && !/Fill in the test card/.test(x.text)), 'Russian reader sees the Russian title');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
