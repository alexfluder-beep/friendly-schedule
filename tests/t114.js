const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const w of [375, 1280]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test); await p.waitForTimeout(800);
  const click = s => p.evaluate(s => document.querySelector(s).click(), s);
  await click('.nav [data-v=clients]'); await p.waitForTimeout(300); await click('[data-act=admintab][data-v=guests]'); await p.waitForTimeout(400);
  const ids = () => p.evaluate(() => [...document.querySelectorAll('.gicard')].map(x => x.id));
  const a0 = await ids(); ok(a0.length === 9, w + ' 9 cards');
  await click('#gi-gi_cty [data-act=gimove][data-d="1"]'); await p.waitForTimeout(300);
  const a1 = await ids(); ok(a1[1] === a0[2] && a1[2] === a0[1], w + ' card moved down');
  await click('#gi-gi_cty [data-act=gimove][data-d="-1"]'); await p.waitForTimeout(300); ok((await ids()).join() === a0.join(), w + ' moved back');
  ok(await p.locator('#gi-gi_mon .bars .barcol').count() === 12, w + ' 12 vertical month bars');
  const th = p.locator('#gi-gi_src .thsort'); const cnt = await th.count(); ok(cnt === 8, w + ' sortable headers ' + cnt);
  const col = i => p.evaluate(i => [...document.querySelectorAll('#gi-gi_src tr')].slice(1).map(r => r.children[i].innerText), i);
  await click('#gi-gi_src .thsort[data-c="2"]'); await p.waitForTimeout(200); const d = (await col(2)).map(x => parseFloat(x.replace(/,/g, '')));
  ok(d.every((v, i) => !i || d[i - 1] >= v), w + ' sorted desc ' + d.join());
  await click('#gi-gi_src .thsort[data-c="2"]'); await p.waitForTimeout(200); const e2 = (await col(2)).map(x => parseFloat(x.replace(/,/g, '')));
  ok(e2.every((v, i) => !i || e2[i - 1] <= v), w + ' sorted asc');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), w + ' no sideways');
  await p.locator('#gi-gi_mon').scrollIntoViewIfNeeded(); await p.screenshot({ path: `s114-${w}.png` });
  await click('.nav [data-v=team]'); await p.waitForTimeout(300); await click('[data-act=teamedit]'); await p.waitForTimeout(300);
  const t0 = await p.evaluate(() => [...document.querySelectorAll('.teamblk')].map(x => x.id)); await click('[data-act=tmmove][data-k=today][data-d="1"]'); await p.waitForTimeout(300);
  const t1 = await p.evaluate(() => [...document.querySelectorAll('.teamblk')].map(x => x.id)); ok(t1.join() !== t0.join(), w + ' team block moved');
  }
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
