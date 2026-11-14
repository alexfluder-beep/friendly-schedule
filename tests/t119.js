const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; }; const errs = [];
  const mk = async w => { const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} }); await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); return p; };
  const p = await mk(375);
  const T = async f => p.evaluate(f);
  // as guide
  await p.selectOption('#demo-as', { label: 'Dato (sample) · Guide' }); await p.waitForTimeout(500);
  ok(await T(() => document.querySelectorAll('.daycard').length >= 7), 'guide week: one card per day');
  await p.screenshot({ path: 's119-week.png', fullPage: false });
  await p.click('.tabs [data-v=me]'); await p.click('[data-act=metab][data-v=profile]'); await p.waitForTimeout(300);
  ok(await T(() => !!document.querySelector('[data-form=worksched] .wssum')) && await T(() => !!document.querySelector('.pdsec')), 'profile: summary line and special dates in one card');
  ok(await T(() => !!document.querySelector('.pdsec').closest('.card') && document.querySelector('.pdsec').closest('.card').querySelector('[data-form=worksched]')), 'special dates inside the working schedule card');
  console.log('summary:', await T(() => document.querySelector('.wssum').textContent));
  await p.screenshot({ path: 's119-prof.png', fullPage: true });
  await p.click('[data-act=metab][data-v=settings]'); await p.waitForTimeout(300);
  const order = await T(() => { const c = document.querySelector('main .card'); const t = [...document.querySelectorAll('main b')].map(x => x.textContent); return t.findIndex(x => /Report a problem/.test(x)) - t.findIndex(x => /Display/.test(x)); });
  ok(order > 0, 'report a problem is below Display (' + order + ')');
  ok(/Telegram bot/.test(await T(() => document.body.innerText)), 'telegram line shown');
  await p.click('.tabs [data-v=timeoff]'); await p.waitForTimeout(300);
  console.log(await T(() => [...document.querySelectorAll('main h3, main summary')].map(x => x.textContent.trim().replace(/\s+/g, ' ')).join(' | ')));
  // admin tasks + timeoff
  await p.selectOption('#demo-as', { index: 0 }); await p.waitForTimeout(400);
  const w = await p.evaluate(() => 1); 
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
