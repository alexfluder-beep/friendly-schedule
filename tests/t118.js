const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction(() => window.__test);
  const h = await p.evaluate(() => { const ids = window.__test.rrTours(); return ids.length ? window.__test.rrHtml(ids[0]) : 'NONE'; });
  ok(h !== 'NONE', 'demo tour with guests'); ok(/Ask for a review/.test(h) && /data-act="copy"/.test(h) && /review/i.test(h), 'draft with copy button'); ok(!/Hello undefined|\$\{/.test(h), 'no template leftovers');
  console.log(h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
