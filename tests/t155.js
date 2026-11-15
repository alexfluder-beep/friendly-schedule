// Pay statement "PDF": opens a printable payment list (tours, corrections, cash, to pay out, signature). Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} window.__pdf = ''; window.open = () => ({ document: { open() {}, write(h) { window.__pdf += h; }, close() {} }, focus() {}, print() { window.__printed = 1; } }); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  await p.evaluate(() => { const t = document.querySelector('.tabs [data-v=admin], [data-act=viewNow][data-v=admin], [data-v=admin]'); if (t) t.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'admintab'; el.dataset.v = 'pay'; el.hidden = true; document.querySelector('main').appendChild(el); el.click(); }); await p.waitForTimeout(300);
  const btn = p.locator('[data-act=prange], [data-act=statement]'); const n = await btn.count(); let found = false;
  for (let i = 0; i < n && !found; i++) { await btn.nth(i).click(); await p.waitForTimeout(300); if (await p.locator('#modal [data-act=paymonth]').count()) await p.locator('#modal [data-act=paymonth]').first().click(); await p.waitForTimeout(300); if (await p.locator('#modal .prow').count()) found = true; else await p.evaluate(() => { const c = document.querySelector('#modal [data-act=close]'); if (c) c.click(); }); }
  ok(found, 'statement opened'); if (!found) process.exit(1);
  await p.locator('#modal [data-act=paypdf]').click(); await p.waitForTimeout(800);
  const h = await p.evaluate(() => window.__pdf); ok(/Payment list/.test(h) && /<table>/.test(h) && /Signature/.test(h) && !/NaN|undefined/.test(h), 'printable list built: ' + h.length + ' chars');
  ok(await p.evaluate(() => window.__printed === 1), 'print dialog asked for');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
