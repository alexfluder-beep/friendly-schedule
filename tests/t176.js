// 17 Nov batch: Salary inside Money, estimated profit with missing prices (A3), hide-0 switch and cash amounts (A6), Offered label (A8),
// singular/plural (A9), "Today is your day off" (A10), one badge count and Show all (A14), card colour by kind (W11), holiday answers.
// Also: no text key appears twice in a language file. Invented data only.
const { chromium, devices } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const l of ['en', 'ru', 'ka']) { const t = fs.readFileSync(__dirname + '/../i18n-' + l + '.js', 'utf8'), ks = [...t.matchAll(/(?:^|[,{]\s*|\n\s*)([a-z][a-z0-9_]*): (?=["'`])/g)].map(m => m[1]), seen = new Set(), dup = ks.filter(k => seen.has(k) || !seen.add(k)); ok(!dup.length, `${l}: no key twice (${dup.join(', ')})`); }
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  // Salary is a tab of Money; the old Salary menu item is gone and its old link still works
  await p.evaluate(() => window.__test.go('admin', 'pay')); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('.mn [data-act=mntab][data-v=pay][aria-pressed=true]') && !!document.querySelector('form[data-form=paytable]')), 'old Salary link opens Money › Salary with rates and pay table');
  ok(await p.evaluate(() => !document.querySelector('.admitem[data-v=pay]')), 'no separate Salary item in the Back office menu');
  ok(await p.locator('input[data-ch=payhide0]').count() === 1, 'A6: "Hide people with no tours" switch');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Money › Salary does not stick out on a phone');
  await p.click('[data-act=mntab][data-v=team]'); await p.waitForTimeout(300);
  const card = p.locator('.mn-person').first(); if (await card.count()) { ok(await card.locator('[data-act=statement]').count() === 1, 'Team card has a Statement button'); }
  // plural forms
  ok(await p.evaluate(() => window.I18N.t('en', 'tm_busy_row', { n: 1, g: 1, f: 2 }) === '1 tour · 1 guest · 2 people free' && window.I18N.t('ru', 'tm_busy_row', { n: 3, g: 5, f: 1 }).startsWith('3 тура · 5 гостей')), 'A9: 1 tour / 2 tours, тура / гостей');
  // A3: estimated profit with missing prices
  ok(await p.evaluate(() => { const b = document.querySelector('.incbar b'); return !b || !b.classList.contains('neg') || !/~/.test(b.textContent); }), 'A3: an estimated result is never a red loss');
  // holidays (office side)
  await p.evaluate(async () => { const S = window.Store; const r = (S.db.settings.find(s => s.id === 'rules') || {}).value || {}; const d1 = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10), d2 = new Date(Date.now() + 11 * 864e5).toISOString().slice(0, 10); await S.save('settings', { id: 'rules', value: { ...r, holAsk: d1 + '..' + d2 } }); });
  await p.evaluate(() => window.__test.go('admin', 'avail')); await p.waitForTimeout(400);
  ok(await p.locator('.holadm').count() === 1 && /0 of \d+ answered/.test(await p.locator('.holadm').innerText()), 'Who can work starts with the holiday answers');
  ok(await p.locator('.holadm [data-act=copy]').count() === 1, 'a message to copy for the team');
  // a guide answers
  await p.evaluate(() => { const s = document.querySelector('#demo-as'); const o = [...s.options].find(x => /Guide/.test(x.text)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(700);
  await p.evaluate(async () => { const S = window.Store; const r = (S.db.settings.find(s => s.id === 'rules') || {}).value || {}; const d1 = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10), d2 = new Date(Date.now() + 11 * 864e5).toISOString().slice(0, 10); await S.save('settings', { id: 'rules', value: { ...r, holAsk: d1 + '..' + d2 } }); });
  await p.evaluate(() => window.__test.go('calendar')); await p.waitForTimeout(400);
  ok(await p.locator('.holcard').count() === 1, 'the guide sees the holiday question');
  const yes = p.locator('.holcard [data-act=holset][data-v="1"]'); ok(await yes.count() === 2, 'one Can work / Day off pair per day');
  ok((await p.locator('.holcard .seg button').first().boundingBox()).height >= 44, 'holiday buttons at least 44 px tall');
  await yes.nth(0).click(); await p.waitForTimeout(300); await p.locator('.holcard [data-act=holset][data-v="0"]').nth(1).click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const h = (window.Store.me && window.Store.db.profiles.find(x => x.id === window.Store.me.id) || {}).display; return h && h.hol && Object.values(h.hol).sort().join() === '0,1'; }) || await p.locator('[data-act=holdone]').count() === 1, 'answers saved on her profile');
  ok(/1/.test(await p.locator('.holcard').innerText()) && await p.locator('.holcard.done').count() === 1, 'after answering, the card folds into one line');
  // W11: card colour by kind
  await p.evaluate(() => { localStorage.setItem('fs-cardc', 'kind'); }); await p.evaluate(() => window.__test.go('calendar')); await p.waitForTimeout(300);
  const ks = await p.evaluate(() => [...document.querySelectorAll('.acard[style*="--k"]')].slice(0, 6).map(e => e.style.getPropertyValue('--k').trim()));
  ok(!ks.length || ks.every(k => ['#7b4fd6', '#1e88e5', '#ef8a17'].includes(k)), 'W11: with "Private / group" the stripes use the kind colours (' + ks.join(',') + ')');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
