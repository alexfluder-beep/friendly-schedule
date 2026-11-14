# Friendly Schedule: instructions for Claude

A plain JavaScript PWA for Friendly.ge guides and drivers (replaces Setmore). Live: https://alexfluder-beep.github.io/friendly-schedule/ . Data: Supabase project `scqqmnwzglbgnvgzqifu`. Languages: English, Russian, Georgian.

## Owner rules (always)
- The owner (Aleksi, Tbilisi) is not a developer: explain in plain words, say what changed and what he must do by hand.
- Publish only when he writes "release". Until then work in the working copy only.
- Database changes only with his approval; keep the backup tables. No secrets in commits. Guest data is private (no real names, phones or emails in tests or commits).
- Guest messages are drafts he sends himself; the app sends nothing.
- Accounting and RS.ge belong to a separate project.
- Keep the Telegram bot schedule functions (`bot/`) in step with app changes.
- Screens must work for users over 50 on small old phones: plain HTML, CSS and SVG, no chart libraries, big text and buttons.

## Where things are
- `app.js` screens and logic (about 690 KB; sections start with `// ----------`), `store.js` data and Supabase, `i18n.js` texts (en, ru, ka: every new text needs all three), `styles.css`, `sw.js` cache list, `cute.js` badge art, `catalog.js` tour catalogue, `supabase/` SQL and functions, `bot/` Telegram bot.
- Patterns: `acts` (data-act), `changes` (data-ch), `forms` (data-form), `T(key, vars)` for texts, `render()`.
- `parseBooking`, `parseReview` read pasted platform e-mails (10 platforms). Test file `t120` style: anonymised layouts only.

## Release checklist (only on "release")
1. Bump `APP_VERSION` in app.js and `CACHE` in sw.js; add a README bullet.
2. Run all tests (Playwright against the demo server; need `window.__noCelebrate = true` and localStorage `fs-test-seen`).
3. Secret scan, copy files into the release clone, commit, push.
4. Ask the owner to confirm the version shows on the live site.

## Cleaning rules
- Before deleting code, search every file (app, store, cute, catalog, index, sw) and long template lines; a dead-code scan once missed a real use (`titlesOf`). Delete, then run all tests.
