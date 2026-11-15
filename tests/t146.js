// Tour card (computer view): no wine-style titles on staff rows, clear people count, icon-only kind chip, equal bottom buttons, no scrollbar, draggable. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__noCelebrate = true; try { localStorage.setItem('fs-test-seen', '1'); } catch (e) {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.strip'); await p.selectOption('#demo-as', { label: 'Sample Admin · Admin' }); await p.waitForTimeout(600);
  const els = p.locator('[data-act=tour]:visible'); await els.first().waitFor({ timeout: 8000 }); const cnt = Math.min(await els.count(), 25); let found = false;
  for (let i = 0; i < cnt && !found; i++) { await els.nth(i).click(); await p.waitForSelector('.sheet.pop', { timeout: 5000 }); if (await p.locator('.sheet.pop .gtot').count() && await p.locator('.sheet.pop .glist.crew .grow .avatar').count()) found = true; else { await p.keyboard.press('Escape'); await p.waitForTimeout(250); if (await p.locator('.sheet.pop').count()) await p.locator('.sheet.pop [data-act=close]').first().click(); await p.waitForTimeout(250); } }
  ok(found, 'found a tour card with guests and a guide');
  const sh = p.locator('.sheet.pop');
  ok(await sh.evaluate(e => e.classList.contains('tview') && (getComputedStyle(e).scrollbarWidth === 'none')), 'scrollbar hidden on the tour card');
  const k = p.locator('.sheet.pop .tag.kindic'), ed = p.locator('.sheet.pop .hedit');
  ok(await k.count() === 1 && (await k.innerText()).trim() === '' && await k.locator('svg').count() === 1, 'kind chip is icon only');
  const kb = await k.boundingBox(), eb = await ed.boundingBox(); ok(kb && eb && Math.abs(kb.height - eb.height) <= 1, 'kind chip as tall as Edit: ' + (kb && Math.round(kb.height)) + ' vs ' + (eb && Math.round(eb.height)));
  const h = await p.locator('.sheet.pop h3.gh').first().innerText(); ok(!/\(\d+\)/.test(h) && /(person|people)/.test(h), 'guest heading shows people, not a booking count: ' + h.replace(/\n/g, ' '));
  const roles = await p.locator('.sheet.pop .glist.crew .grow-l .muted.small').allInnerTexts(); ok(roles.every(t => !t.includes('·')), 'staff rows show only the role: ' + roles.join('|'));
  const bt = await p.locator('.sheet.pop .tacts > .btn').evaluateAll(a => a.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  ok(bt.length >= 3 && bt.every(x => Math.abs(x[0] - bt[0][0]) <= 1 && Math.abs(x[1] - bt[0][1]) <= 1), 'bottom buttons equal size ' + JSON.stringify(bt));
  const before = await sh.boundingBox(), hb = await p.locator('.sheet.pop > .hdr .ttlwrap').boundingBox();
  await p.mouse.move(hb.x + 20, hb.y + 10); await p.mouse.down(); await p.mouse.move(hb.x - 120, hb.y + 90, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  const after = await sh.boundingBox(); ok(Math.abs(after.x - before.x) > 60 && Math.abs(after.y - before.y) > 40, 'card moved by drag ' + Math.round(after.x - before.x) + ',' + Math.round(after.y - before.y));
  await p.locator('.sheet.pop [data-act=tmore]').click(); await p.waitForTimeout(300); const aft2 = await sh.boundingBox(); ok(Math.abs(aft2.x - after.x) <= 1, 'place kept after the card redraws');
  ok(!errs.length, 'errors ' + errs.join('|')); await b.close(); process.exit(bad); })();
