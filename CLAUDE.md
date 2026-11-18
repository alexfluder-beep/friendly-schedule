# Friendly Schedule: instructions for Claude

A plain JavaScript PWA for Friendly.ge guides and drivers (replaces Setmore). Live: https://alexfluder-beep.github.io/friendly-schedule/ . Data: Supabase project `scqqmnwzglbgnvgzqifu`. Languages: English, Russian, Georgian.

## Owner rules (always)
- The owner (Aleksi, Tbilisi) is not a developer: explain in plain words, say what changed and what he must do by hand.
- Publish only when he writes "release". Until then work in the working copy only.
- Database changes only with his approval; keep the backup tables. No secrets in commits. Guest data is private (no real names, phones or emails in tests or commits).
- Guest messages are drafts he sends himself; the app sends nothing.
- Accounting and RS.ge belong to a separate project.
- Keep the Telegram bot schedule functions (`bot/`) in step with app changes. The live bot is run by a separate bot agent from its own `telegram-bot` branch (newer, larger copies; the server resets to that branch every 5 minutes). Never tell the owner to copy bot files to the server: hand new bot code to the bot agent (commit and file names on `main`) and it merges, tests and pushes.
- Look (18 Nov, owner): Setmore-style colours, never the Sava demo's (no green/orange/teal from it). Default blue `#2f6fdf`, navy text `#142640`, light grey page `#f5f8fa`, pastel tints `--p-blue/--p-mint/--p-peach/--p-rose/--p-grey` with darker edges `--p-*-e`, round pastel icon circles. Take ideas from other products, never copy their look. No orange anywhere (saved orange colours are shown through `calm()`), no emoji (countries as two-letter codes), light 1px frames with `--shadow-s`, small calm animations only under `prefers-reduced-motion: no-preference`.
- Screens must work for users over 50 on small old phones: plain HTML, CSS and SVG, no chart libraries, big text and buttons.

## Where things are
- `app.js` screens and logic (about 630 KB; sections start with `// ----------`), `parse.js` reads pasted booking and review e-mails (`window.FSParse`), `game.js` badges, medals, the new-badge screen, Photo of the day, the daily mood question and the after-tour question (`window.FSGame`; app.js hands it its helpers right after `gameOn`), `money.js` the Money module (`window.FSMoney`: Back office › Money Overview/Team/Guests/Setup, running balances per person and currency, the bank-style balance in Me › Pay; app.js only passes helpers), `store.js` data and Supabase, `i18n-en.js`, `i18n-ru.js`, `i18n-ka.js` texts (every new text needs all three; `i18n.js` only joins them), `styles.css`, `sw.js` cache list, `cute.js` badge art, `catalog.js` tour catalogue, `supabase/` SQL and functions, `bot/` Telegram bot.
- Patterns: `acts` (data-act), `changes` (data-ch), `forms` (data-form), `T(key, vars)` for texts, `render()`.
- `parseBooking`, `parseReview` read pasted platform e-mails (10 platforms). Test file `t120` style: anonymised layouts only.

## Release checklist (only on "release")
1. Set `APP_VERSION` in app.js to the release date, year.month.day (`'26.11.18'`; a second release the same day adds b, c; owner 18 Nov) and bump `CACHE` in sw.js; add a README bullet. A new file must be added to `index.html` and to the `SHELL` list in sw.js.
2. Run `sh tests/run-all.sh` (all tests, a throw-away demo copy, sample data). New tests go in `tests/` with invented data only; they need `window.__noCelebrate = true` and localStorage `fs-test-seen`.
3. Secret scan, copy files into the release clone, commit, push.
4. Ask the owner to confirm the version shows on the live site.

## Test rules
- Sample data lies around today, so a test must not assume a demo person already has a finished tour: save one with `S.save('tours', …)` first (t82 failed every Monday until this was done).
- Data added in a test goes through `S.save(...)`, not `db.x.push(...)`: the lookup index (`idx()`) is a memo and does not see a plain push.
- Since 3.98 the day row (`.strip.sroll`) holds 70 days (2 weeks back, 8 ahead). Tests must count or target the days on screen (`.strip button.inwk` = the shown week), never "all buttons" or `.last()`.
- Choosing a person in the demo "View as" list rebuilds the sample data: save test data after choosing.
- Scrolling to a day goes through `dayJump()` (keeps the page still during the redraw, then one move that ends under the sticky day row). Do not use `scrollIntoView` there: on iPhone Safari it made the page jump to the top and slide back (17 Nov). Test t175.
- Class names: check `styles.css` before inventing one (`.crow` was already the commission row; the guest contact row is `.ccrow`).
- Never put `overflow` (hidden or clip) on `html` or `body`, and do not give `.top` / `.tabs` a `view-transition-name`: on iPhone Safari the fixed bottom bar drifted up the page and the sticky day row shook (3.99–3.101). The width guard lives on `main`, `#modal`, `.sheet`. Server updates are drawn only when `busyScroll()` is false. Test t177.
- `tests/run-all.sh` runs with `TZ=UTC`: tests build dates with `toISOString()` (UTC) while the app uses the browser's local date; without it tests failed between 00:00 and 04:00 Tbilisi time. A single test run by hand needs `TZ=UTC` too; `window.__test.today()` gives the app's own date.
- When editing a long one-line test, never insert a `//` comment mid-line (it hides the rest of the line); use `/* */`.

## Cleaning rules
- Before deleting code, search every file (app, store, cute, catalog, index, sw) and long template lines; a dead-code scan once missed a real use (`titlesOf`). Delete, then run all tests.

## Splitting code out of app.js
- Pattern: the new file exports a factory on `window`; app.js calls it once and destructures what it needs. Find the helpers the new file needs with eslint `no-undef` (npm i eslint@8), not by eye. Call the factory only after every helper it receives is defined (a `const` used earlier fails with "before initialization").
- Values that app.js reassigns (like `memo`) are handed over as a getter function.
