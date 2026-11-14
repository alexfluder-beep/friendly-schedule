# Plan: faster work and fewer tokens (made 14 Nov 2026, not started)

Goal: the same app, but edits read less code and sessions stay short. Nothing here changes how the app looks or behaves.

## Step 0: leftovers (done 14 Nov, unreleased)
- Removed 42 unused texts in all 3 languages, 26 unused style selectors and 5 unused functions. All tests pass.
- Not in the release folder, safe to ignore: `preview.html`.
- Still to check: README sections that describe features that no longer exist.

## Step 1: CLAUDE.md in the repo (done)
Standing rules, file map and release checklist, so no session has to rebuild them.

## Step 2: split `app.js` (about 690 KB, 61 sections) into files
Order, smallest risk first. Each step: move code, run all tests, nothing else.
1. `parse.js`: parseBooking, parseReview, matching (self-contained).
2. `stats.js`: Me statistics, team highlights, analytics cards.
3. `calendar.js`: month, week, agenda, tour card.
4. `admin.js`: back office tabs, tour names, clients.
5. `me.js`: profile, settings, pay, badges.
Add the new files to the `sw.js` list and bump the cache. Plain `<script>` files that share one global object, no build tool.

## Step 3: texts
`i18n.js` is 410 KB. Split into `i18n-en.js`, `i18n-ru.js`, `i18n-ka.js`, loaded by the chosen language only (smaller first load, and edits read one language).

## Step 4: tests
Put the Playwright tests in a `tests/` folder in the repo with one `run-all` script, so one command checks everything.

## Step 5: working habits
- One short session per feature; start each with CLAUDE.md.
- Release in its own short session.
- Paste screenshots with one request each.

## Risks
Splitting files can break load order or the offline cache. Do one file at a time and release only after all tests pass on phone and desktop width.
