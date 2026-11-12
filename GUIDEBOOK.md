# Friendly Schedule: look and build guidebook

Rules for anyone (person or agent) who changes the app. Version 3.60, 12 Nov 2026. If a rule here and the code disagree, fix the code or change the rule here in the same release.

## 1. One set of sizes

Everything in `styles.css` uses these names (they are defined once, at the top of the file, in `:root`). Do not write raw pixel numbers for corners or text.

| What | Name | Value | Used for |
|---|---|---|---|
| Corner, small | `--r-s` | 8px | tags inside rows, small inner boxes, calendar rows |
| Corner, medium | `--r-m` | 12px | inputs, day cells, list rows |
| Corner, large | `--r-l` (also `--r`) | 16px | cards, sheets, the popup |
| Corner, extra | `--r-xl` | 28px | sign-in card, question card, wide round button |
| Pill | `--r-pill` | 999px | buttons, tags, chips, segmented switches |
| Circle | `50%` | | avatars, icon buttons, dots |
| Text, tiny | `--t-micro` | 11px | marks under dates, uppercase weekday names, bottom bar labels on phones 360px and narrower |
| Text, caption | `--t-cap` | 12px | secondary numbers, bottom bar labels |
| Text, small | `--t-sm` | 14px | notes, tags, compact buttons |
| Text, body | `--t-body` | 16px | everything else; inputs are never smaller (iPhone zooms in below 16px) |
| Heading 3 | `--t-h3` | 18px | card titles |
| Heading 2 | `--t-h2` | 22px | page and sheet titles (20px on phones) |
| Heading 1 | `--t-h1` | 28px | month name on phones |

Touch sizes: a thing people tap is at least 44px tall on phones (40px inside dense rows, 36px only in the computer popup). Icon buttons are 40 or 44px circles. Gaps and padding are steps of 4px.

Motion (3.60): one curve and one length for cards, tab changes and week changes (`--ease`, `--dur` = 0.18s). Nothing bouncy, nothing that loops except loading spinners; the gift box shakes twice. With the phone's "reduce motion" setting nothing moves.

Font: the phone's own system font (`--font`). No web fonts are downloaded, so text shows at once and works on phones without Google services.

## 2. Colours

- Default scheme: Friendly brand. Structure green `#314b3c`, action red-brown `#b94a2f` for the one main button on a screen, soft green-grey `#e6e8dd` for quiet panels. Other schemes are in Me > Settings.
- No red unless something is wrong or is being deleted or cancelled.
- Amber means "check this" (a tour needs someone, a day is not good for a day off).
- Each tour has its own colour from the tour catalogue. People do not have colours in the calendar.
- Tints made with `color-mix()` are decoration only. Old browsers ignore them, so a tint is never the only sign of anything: there is always an icon, a word or a number as well.

## 3. Elements

Use the existing ones before making a new one. Names are in `APP-CHANGE-LOG-AND-CATALOG` (project doc), section 3.

- **Button**: pill. One primary (action colour) per screen; the rest are outlined. Danger buttons are outlined red.
- **Tag**: small pill with a word. A tag that can be tapped has the class `tagbtn` (one element, never a tag inside a button).
- **Card**: white, 1px line, large corner, no shadow. The popup on a computer is the only element with a shadow.
- **Folded section**: a card row with the count by the title and Show / Hide on the right.
- **List row**: what it is on the left (person, holiday, tour), the date or number on the right.
- **Icons**: one set of line icons (24 box, 2px stroke) for navigation and buttons, Material Symbols for facts inside cards, hand-drawn stickers only for badges, greetings and the animal of the week.
- **Action row** (3.60): one filled button (the main action), up to two quiet outlined ones, then **More**. Anything red (cancel, delete) is inside More and still asks first.
- **One banner at a time** (3.60): looking as someone > new version > set-up line. The maintenance notice, the demo line and the test-version line are not counted. A banner is one line and has no full stop.
- **Bar that must not be lost** (3.60): the "looking as" bar is pinned under the header (`--toph`, then `--vabar-h` for anything pinned below it).
- **People row** (3.60): several people with the same state on one day are one row: icon, word with a colon, then one small tag per person. Not one card per person.
- **Warning line** (3.60): the amber warning icon and ink text. No "!" prefix and no red text.
- **Empty state** (3.60): one plain line in a dashed box (`.empty`) that says when something will appear. No zeros, no empty charts, no empty bars.
- **Number tiles** (3.60): one number and one short label per tile, equal heights; extra numbers go into a fold.
- **Tappable things are not selectable** (3.60): anything with a tap action has `user-select:none` (a long press on Android must not open "Copy / Select all"). Text worth copying (phone, booking reference, address, note, form fields) stays selectable.
- **Floating round button** (3.60): a page that has one gives `main` the class `hasfab` (extra bottom room), so the last item scrolls clear of it.
- **Notice over the page** (3.60): one at a time, above the bottom menu, with an X; it leaves after about 6 seconds or as soon as the person touches something else.
- **Looking as someone** (3.60): shows, never acts: no badge windows, no notices, nothing marked as seen, nothing saved.
- **Guest email for guides and drivers** (3.60): always through `shownEmail()`; platform relay addresses (`relayEmail()`) are for the office only.
- **Words on buttons**: verbs, short. A button keeps its word unless the icon is one everybody knows (phone, message, map pin, refresh, close, back).

## 4. Writing

Plain, short, warm. "You" form. No exclamation marks in the app's own texts (since 3.60 also not in greetings; messages sent to guests are the owner's voice and are left alone). No full stop at the end of a button, tag, banner, tile or empty-state line. Part of a whole is written `4/5`, without spaces. Every text name is used once per language (two texts with one name silently replace each other). Every text exists in English, Russian and Georgian (`i18n.js`); a new text is added to all three in the same release. Numbers that can go out of date are counted, never typed.

## 5. Phones and browsers

The app must work on: iPhone (Safari and the installed app), Android (Chrome and the installed app), Xiaomi, Huawei, Honor, Oppo and similar phones with their own browsers and without Google services, and computers (Chrome, Edge, Safari, Firefox).

- JavaScript: nothing newer than what Chrome 80 and Safari 13.1 understand (optional chaining and `??` are fine; `??=`, `.at()`, `replaceAll`, `structuredClone`, `Object.groupBy` are not used).
- Every newer browser feature is optional and checked first: view transitions, app icon badge, background wake-up, folder access, persistent storage, notifications. Without them the app still does its job.
- Nothing is loaded from Google. Outside addresses: the database (Supabase), weather (open-meteo), exchange rates (frankfurter), and the spreadsheet reader from cdnjs only when the office imports a file. Maps and WhatsApp are links the person taps.
- Phone notifications (push) need Google services on Android or the installed app on iPhone. On phones without them, Telegram carries the notices.
- Text must survive the phone's "large text" setting and 320px wide screens: nothing is cut, long words wrap with a hyphen.

## 6. Speed and data use

- The app's own files are saved on the phone as one version and open from there at once. A new version is downloaded whole in the background, then replaces the old one.
- First download of a version is about 350 KB (the hosting compresses files). After that, opening the app downloads only data.
- Data: the saved copy shows first; fresh data is fetched in the background, all tables at once.
- No build step: files are published as written. Do not add a framework or a bundler.

## 7. Before a release

1. Run all automatic checks (t1 to t84: phone and computer, three languages, pretend database, offline copy).
2. Look at a phone-size picture of every screen you changed.
3. Add the version to `README.md` in plain words.
4. Bump `APP_VERSION` in `app.js` and the cache name in `sw.js` together.
5. Another Claude session may publish to the same repository: fetch and build on the newest version first.
