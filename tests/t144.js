// The opening greeting follows the hour: 00:26 is night, not afternoon. Invented data only.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) bad = 1; };
  for (const [hh, want] of [['00:26', 'Good night'], ['03:10', 'Good night'], ['07:00', 'Good morning'], ['12:30', 'Good afternoon'], ['19:00', 'Good evening'], ['23:30', 'Good night']]) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage();
    await p.addInitScript(h => { const R = Date, fixed = new R(`2026-11-15T${h}:00`).getTime(); window.__hello = ''; new MutationObserver(() => { const e = document.getElementById('hello-t'); if (e && /^Good/.test(e.textContent) && !window.__hello) window.__hello = e.textContent; }).observe(document, { childList: true, subtree: true, characterData: true }); window.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }; }, hh);
    await p.goto('http://localhost:8765/index.html'); const t = await p.evaluate(() => window.__hello); ok(t.startsWith(want), hh + ' → ' + t); await p.close(); }
  await b.close(); process.exit(bad); })();
