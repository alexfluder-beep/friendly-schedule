# Friendly Schedule

**Setting it up for your own team: read `START-HERE.md` first.** Android app: `ANDROID-APP.md`. Telegram bot: `bot/SCHEDULE-BOT.md`.

Team scheduling for guides and drivers: tours (private, group, customised), days off, sick days, company holidays, tasks, workload warnings, a back office for the admin, and an import from Setmore. English, Russian and Georgian. Works in the browser on Android and iPhone and can be added to the home screen.

With `config.js` left empty the app runs in **demo mode**: sample data, stored only in that browser, no login.

## What is included
- Calendar (week, month, day on phones), Monday first. Private, group, customised and multi-day tours.
- Tour card: adults and children, guest list, guest marks (wine tasting, private room, front seat, food for bears, pick-up, drop-off elsewhere, your own marks), guide and driver on one card with their phone numbers.
- Client cards with full booking history and guide marks: good, fine, bad, trouble maker.
- Time off with approval, sick days, company holidays, suggested quiet days that keep the team from being off together.
- Season forecast from past tours.
- Salary: standard pay per tour day by role and tour type, with a per-tour override and a monthly total per person.
- Tasks that two people can share.
- Back office: all tours with search and CSV export, clients, team, planning, salary, holidays, rules, reports, Setmore import, backup.
- Photos for team members, help tips on every screen, three languages.

- Payments per guest (prepaid, cash, not paid, amount to collect) and cash to collect per tour.
- Booking source from the booking code (GetYourGuide and Viator are recognised, others are set by hand) and review links to copy or send by WhatsApp.
- Contact buttons next to every phone: WhatsApp, call, email, copy. Google Maps link for the pick-up address.
- Share a tour to WhatsApp or Google Calendar, and a day summary for the whole team or one person.
- Tour score 0-10 by the guide and driver, anonymous like and dislike for clients.
- Pay per tour and number of guests, monthly statement per person, bank details visible only to that person and the admin.
- My month, statistics and badges for every guide and driver.
- Team events, change log, guide languages with a warning when a tour language does not match.
- Tour catalogue with your real tour names, usual start times, durations, group sizes, add-ons and meeting-point map links; choosing a name on a new tour fills the card in.
- Works without signal: the last loaded schedule stays on the phone, and changes made offline are sent when the connection returns.
- Each tour has its own colour and short code. Swipe left or right on a phone to change week or month; the calendar icon jumps to any date.
- Guest check-in during the tour (arrived / no-show), saved to the client card.
- Guides and drivers can suggest a change or ask a colleague to take a tour; nothing changes until the admin approves.
- "My next tour" and "My next day off" at the top of the calendar.
- Pay corrections after month end with a reason, and a standing note on every pay statement.
- Personal working days, hours and special dates per person, with warnings when a tour clashes.
- Built for volume: tested in the demo with about 3,900 tours, 11,500 guest bookings and 6,000 clients. The hosted app loads the last 13 months at start and fetches older years and full client history when needed.

Not built yet: TrekkSoft-format import and export (needs a sample TrekkSoft export file) and two-way Google Calendar sync (needs a Google Cloud project with sign-in approval and server functions).

## Setup (about 20 minutes)

### 1. Database and login (Supabase, free plan)
1. Create a project at supabase.com. Pick a region close to Georgia (for example Frankfurt).
2. Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, press **Run**.
3. Open **Project Settings > API**. Copy the **Project URL** and the **publishable (anon) key** into `config.js`.
   Never put the secret / service_role key in `config.js`.
4. In **Authentication > URL Configuration**, set **Site URL** to the address where the app is hosted (step 2 below).

### 2. Hosting (GitHub Pages, free)
1. Put all files from this folder in a GitHub repository.
2. **Settings > Pages > Deploy from a branch**, choose the main branch and the root folder.
3. The app opens at `https://<account>.github.io/<repository>/`.

### 3. First admin
1. Open the app, choose **Create account**, confirm the email.
2. In Supabase **SQL Editor**, run the last line of `schema.sql` with your email. You are now the admin.

### 4. The team
**Back office > Team > Add person**: enter name, role, phone and the email the person will sign in with. Send them the invitation (WhatsApp or copy). They open the app, choose **Create account** with that email and their own password, and are in at once.
Someone who creates an account without an invitation sees "Waiting for access" until you press **Give access**.
**Edit** changes name, role, phone, languages, working days and the tours a guide leads. **Delete person** closes the sign-in and removes phone, bank details and personal dates; the name stays on past tours and pay reports.
To let people in without an email confirmation step, turn off **Authentication > Sign In / Providers > Email > Confirm email** in Supabase.

### 5. History
**Back office > Setmore import**: upload the `.xls/.xlsx` from Setmore's Basic Reporting. Match each Setmore team member to a person, then import. Importing the same file twice does not create duplicates.

## Notifications
- While the app is open, changes and notifications arrive live.
- For notifications when the app is closed (web push): the public key is already in `config.js`; follow `PUSH-SETUP.md` once in the Supabase website (function, four secrets, one webhook).
- Each person turns notifications on in **Me > Phone notifications**, can send themselves a test and turn them off on that phone.
- iPhone shows web push only after the app is added to the Home Screen (iOS 16.4 or newer).

- Evening reminder for tomorrow's tours: enable the `pg_cron` extension in Supabase and run the `cron.schedule` line near the bottom of `schema.sql`.
- Each person chooses in **Me** which notices they get (new tours, changes, cancellations, evening reminder).

## Free-tour guests and tips
- A guest whose source is **FreeTour** (or whose Setmore name has `+freetour`) gets a dark "Free tour · tips" tag in the guest list, and the tour shows how many such guests it has.
- There is one Keepz tip link for the whole team, set in **Back office > Rules**. The **Tips QR** button on a tour shows it as a QR code for guests to scan.

## Guide and driver home screen
- Guides and drivers open on their own week, one heading per day, one card per tour, "Nothing planned" on free days, a block for days off.
- While a tour is on (from one hour before the start until the end), the home screen starts with that tour's guest list: names, guest counts, WhatsApp and call buttons, and check-in.
- Month view, the whole team's calendar and the day summary are links at the bottom.

## Second car and tour costs (admin)
- When a tour with a driver has more guests than one car takes, the tour card shows **Add a second car**. It makes a copy of the card with the same time and meeting point, moves the extra bookings to it, and opens it so you can pick a driver.
- **Edit tour > Costs**: accommodation, food, tickets, fuel, other. Only admins can see or change these; the month total is under **Back office > All tours**.

## VIP guests
- A guest becomes VIP automatically: at least 2 earlier tours, more good marks than bad, and enough points from tours, years with you and add-ons. No-shows and bad marks take points away.
- VIP shows on the guest in the tour card, on the tour in the day list, on the client card, and as a "VIP only" switch in **Clients**. It updates by itself as tours and marks change.
- Guides and drivers get only the numbers needed for this, never the old bookings.

## Sunday check
- From Sunday 17:00 until Monday night, every guide and driver sees a card with their tours and days off for the coming week and a button "I have checked my week". It is also in their task list.
- To also send a notification on Sunday 18:00 to people who have not opened the app, switch on the `week-check` line at the bottom of `schema.sql` (needs the pg_cron extension).

## Weather
- Tours in the next 16 days show a small forecast line for the destination on the tour day: average temperature, conditions, rain or snow in mm, and wind.
- The forecast comes from Open-Meteo (free, no account). Only the destination's coordinates are sent. It is kept for 3 hours per place.
- The place is guessed from the tour name. Set exact coordinates per tour in **Back office > Tour list > Distance and regions**.

## Pay
- **Me > My pay** shows pay for a month, last month, this year, last year or any two dates, with a total, averages and a bar per month.
- "Ideas to earn more" are worked out from the schedule of the last 12 months: open tours on free days, languages and tours the person does not cover yet, working days, tour types.
- **Pay not right?** next to a tour sends a question to the admin. In **Back office > Salary** the admin accepts it with a new amount for that tour, or declines with an answer.

## Badges
- Badges, levels, records and titles are counted automatically from each person's tours. Nothing is entered by hand.
- Guides, drivers, guides with their own car and Delica drivers each get their own set. Set the vehicle in **Back office > Team > Edit**.
- Titles (for example Mountain eagle, Desert soul) go to the guide and the driver with the most tours of that kind in the last 12 months. No ranking is shown to anyone; a title just moves when a colleague overtakes its holder.
- Secret badges stay hidden until earned.
- An earned badge can be saved as a picture or shared from its sheet (the phone's own share menu).
- Driving and walking distances and regions are rough guesses from the tour name. Correct them per tour in **Back office > Tour list > Distance and regions**.

## Live updates
- With the app open, a change appears on other phones within seconds.
- As a safety net the app re-reads the schedule every 2.5 minutes and each time it comes back to the screen. The round arrow in the header does it by hand and shows the last update time.

## Privacy
- Guides and drivers see guest names and phones only for their own tours, and only until 14 days after the tour (change in **Back office > Privacy**). The database enforces this, not only the screen.
- Guests with no tour for 24 months lose name, phone, email, notes and booking reference automatically; guest counts and pay history stay.
- A guest's data can be downloaded or deleted from the client card (admin).
- Signing out removes the offline copy from that phone.
- These are sensible defaults, not legal advice. Confirm the periods with a lawyer.

## Before release: checklist
1. Run `schema.sql` in a fresh Supabase project (no errors expected).
2. Create the admin account, then add one guide and one driver with **Add person** and sign in as each on a second phone.
3. As admin: create a tour for them, change the time, cancel it with a reason, restore it. Each step should appear on the other phone within seconds.
4. As guide: mark a guest arrived, ask for a day off, report a cancellation; approve both as admin.
5. As guide: check you cannot see guests of another guide's tour.
6. Turn the phone's internet off, open the app, mark a guest; turn it on and check it syncs.
7. Add the app to the Home Screen on one iPhone and one Android phone.

## Things to know
- The free Supabase plan pauses a project after a week with no activity and has no automatic backups. Use **Back office > Backup** regularly.
- Guest names and phone numbers are visible only to admins and to the guide and driver assigned to that tour. Everyone with access sees tour titles, times and guest counts.
- Monday is the first day of the week everywhere.
- The database rules were tested on a local Postgres engine (46 checks). The connection to a live Supabase project has not been tested yet: do the checklist above before inviting the team.

## Files
`index.html`, `styles.css`, `app.js` (screens), `store.js` (data), `i18n.js` (texts in three languages), `config.js` (your keys), `sw.js` (offline and push), `supabase/schema.sql` (database and security rules), `supabase/functions/push` (optional push sender). `preview.html` is only for the Claude preview.

## Version 2.0: guests who stay, Share list, moving tours

- **Stays there after the tour.** A new tick in the guest's notes (next to Pick-up and Drop-off). The tour card shows "2 stay", the tour view shows "2 stay there after the tour. Coming back: 3", and the address field holds the hotel or guest house where the guest stays. In a Setmore import, `+stay` in the name sets it.
- **Share.** The phone's own share sheet opens first. Where the browser blocks it (for example inside a preview window), the app shows its own list: WhatsApp, Telegram, Email, Copy. Copy also has a fallback for browsers that block the clipboard.
- **Move a tour (admin).** Button "Move" in the tour view: pick a new date and start time; the length stays the same, a multi-day tour moves as a whole. Warnings (day off, double booking) show before saving. The guide and driver get a notice. Guests are not told by the app.
- **Drag and drop (admin).** Phone: press and hold a tour card, then pull it onto a day in the week strip, a day in the month grid or another day's heading. Computer: drag a tour in the team grid to another day; dropping it on another person's row also changes the guide or driver. Nothing is saved until "Move tour" is pressed.

## Version 2.1: weak internet, status line, test notice

- **Weak internet.** A request that hangs is stopped after 15 seconds and the change is kept on the phone. The app tries to send again every 30 seconds, when the app is opened again, and when the phone reports the internet is back.
- **Status line** at the top of every screen: "Up to date · 14:32", "Last update 14:10" (older than 10 minutes), "No internet. Schedule from 14:10. Waiting to send: 2." or "Sending 2 saved changes…". A tap tries again. Two short notices: "Saved on this phone. It will be sent when the internet is back." and "All your changes are sent."
- **Test notice.** A small "Test version" chip sits in the pinned top bar next to the status line, so both stay in view while scrolling. A tap opens: "There can be mistakes and glitches… take a screenshot and send it to Alex", three short steps and a "Send to Alex" WhatsApp button (the message already holds the app version, screen and phone type). Each person sees this window once by itself, on the first opening. Settings in `config.js`: `testBanner` (set `false` when testing is over), `reportTo`, `reportWhatsApp`.

## Version 2.4: Telegram username

- Each person can have a Telegram username. The admin types it in **Edit person** (`@nino`, `nino` or a `t.me/nino` link all work), or in the 5th column of **Add several people at once**. Each person can also set or change their own on the **Me** screen.
- Colleagues then get a Telegram button next to WhatsApp and Call: on the tour card, in the tour view and in the contacts list. The team list shows `@username`.
- Database: included in `supabase/update.sql`.

## Versions 2.5 to 2.8 (feedback round of 10 Nov)

Database: run `supabase/update.sql` once in Supabase > SQL Editor (safe to run again). It covers every change from 2.4 to 3.4.

- **Problems log** (Back office > Problems): errors, failed saves, connection drops longer than 30 seconds and "app could not start", from every phone, with person, screen, phone type and version. Phones without internet keep them and send later. People can also type a short report in the "Test version" window.
- **Driver list**: drivers first, then guides who drive (own car or Delica), then others; says so when there are no drivers yet.
- **Badges**: the seen list is saved on the account, so the welcome badge shows once per person, not once per phone. Only the welcome badge and region titles take the full screen; other badges come as a small note at the bottom.
- **Guests**: email and language on each booking and on the guest card (admin can edit name, phone, email, notes). Typing a name, phone, email or booking code shows guests already in the base ("Already in the base") with a Use button. Local Georgian numbers get +995; phones show the country flag.
- **Duplicates**: Back office > Guests lists possible duplicates (same phone, email or name) with Merge; merging is done on the server so old bookings move too.
- **Money**: currency per booking (GEL, USD, EUR, AMD, RUB, GBP); "Cash to collect" adds up per currency.
- **Options** as a checklist; **address** field takes a hotel name, a Google Maps link or coordinates (decimal or degrees) and makes the map link itself; earlier addresses are suggested.
- **Booking history** in the guest sheet: booked, changed (which fields), moved (from/to), tour cancelled or restored, moved to the second car, with who and when.
- **Display** (Me screen): text size small/normal/big and colours like the phone/light/dark, saved per phone.
- **Days off** in a clear blue; holidays have a gold top line; month view on computers lists tours per day like Setmore (time, title, guide colour).
- **Help**: tasks explained, levels explained (points per tour, guest, km, badge), Telegram steps, how day-off dates are suggested. **Busy periods** (Rules): New Year, Chinese New Year, Nowruz, Easter, Eid, Golden Week; suggestions avoid them and requests for them get a warning. Moon-based dates are estimates.
- **Bank details** are shown hidden (•••• 1234) after saving; only the person and admins can read them.
- **Telegram code** card only shows once the admin has set the bot link in Rules (the bot itself still needs the bridge from `bot/`).
- **Paste a booking** (Back office > Booking from email): paste any booking email (GetYourGuide, Viator, Klook, Trip.com, Airbnb, TrekkSoft...). It reads the code, tour, date, time, guest, people, phone, email, language, pick-up and options, finds the matching tour (or a catalogue tour) and opens it for checking; a cancellation email offers to remove the guest. TrekkSoft "New order" emails go to the TrekkSoft reader.
- **Setmore guest contacts** (Back office > Setmore import): upload the Customers export (CSV or Excel); new guests are added, existing ones get missing phone/email/notes. CSV files are read without the online Excel library.

## Versions 2.9 and 3.0

- **Back office** grouped: Every day / Team and money / Numbers / Setup. A banner reminds the admin when the last backup is older than 7 days.
- **Backup page** explains how data is kept (Supabase free plan has no automatic backups; Pro keeps 7 days), and can **restore** from a backup file (adds back and overwrites rows with the same ID; deletes nothing).
- **Maintenance mode** (Rules, or `maintenance` in `config.js` when the database is down): guides and drivers see "We are updating the app" with a button to see their last saved schedule; admins see a banner.
- **Error codes** E1 to E9 on screen and in Back office > Problems, with what each means.
- **Georgian public holidays** (information only, grey line under the date, name in the day header); Orthodox Easter is calculated. Can be switched off in Rules.
- **Tour statistics** (Back office > Tour statistics): tours and guests vs last year, guests month by month for two years, guests per weekday with the most common tour, tours ranked by guests with trend and cancellations, booking sources, private/group, languages.
- **Team achievements** (admin): level, points, badges, titles and closest next badge for everyone; most and least common badges.
- **Salary**: filter guides/drivers, sort by any column, download the table (CSV for Excel).
- **Who fits this tour** in the tour editor: free people only (no day off, no other tour at that time), ranked by experience with this tour, language, tour list, normal working day, tours this week; Delica drivers for 4x4 tours.
- **Week and month figures** above the calendar (admin): tours, guests, what bookings bring in, team pay, tour costs and profit in the pay currency. Exchange rates in Rules. Booking **Price** field; prices come from pasted emails (Airbnb takes your net total), the Setmore Cost column, or by hand.
- **Booking emails**: checked against real Viator, GetYourGuide (new layout), Klook, Trip.com and Airbnb emails. Trip.com names like WANG/XIAOBO become "Xiaobo Wang (王晓波)". A name only in Chinese, Korean or similar letters gets a reminder to add it in Latin letters.

## Version 3.1
- **Options** (wine tasting, front seat, pick-up...) are one drop-down field: it shows what is chosen and a count; tap to open a tick list with search (when there are many options), Clear and Done.
- **Guest contacts import** fixed for big files (the 13,000-row Setmore Customers export): rows of the same guest are joined, "CANCELED", "PACK" and similar words are taken out of names, platform proxy emails are skipped, phone/email from the second columns are used, and a batch never holds the same guest twice (that caused "ON CONFLICT DO UPDATE command cannot affect row a second time"). Importing the same file again only fills in missing details.
- **Phone notifications** card on Me: on/off for this phone, test, turn off, clear help for blocked notifications and iPhone Home Screen.

## Versions 3.2 and 3.3
- **Website orders** pasted from TrekkSoft ("2 x Tour (24 November, 2026, 10:30)" with Guest 1, Guest 2 blocks) are read: lead guest, phone, number of people, other guests in the notes, price added up.
- **Display for each person**: text size Small / Normal / Big / Very big, colours Like the phone / Light / Dark, contrast Normal / Strong (black text, darker lines, bolder). Saved on the account (needs `supabase/update.sql`) and on the phone. The **Aa** button in the top bar opens it from any screen. Grey secondary text is a little darker for everyone.
- Database: included in `supabase/update.sql`.

## 3.4
- **Clearer text sizes**: one type scale for the whole app (11, 12, 14, 16, 18, 22, 28, 34 px, after Material 3 and Apple guidance). Body text is 16 px (was 15), screen and window titles 22 px (20 on phones), tour titles on cards 18 px, labels and tags 12-14 px. Nothing is smaller than 11 px. The Aa sizes still scale all of it.
- **Faster and no more "statement timeout"**: access rules on guests, bookings and the team now run once per request instead of once per row. Test with 13,000 guests: a guide's list went from 53 s to 0.02 s, the admin's from 1 s to 0.3 s. Needs `supabase/update.sql`.
- Problem log ignores "Load failed" / "AbortError" when the phone paused the app or lost signal. Slow reads wait 30 s instead of 15 s.

## 3.5
- **Easier to read, also for 50+**: guest rows on a tour show only the name, the WhatsApp and Call buttons and one plain line (people, money to collect, up to two options). Phone, country, returning guest and VIP are on the guest's own sheet (tap the name). One grey summary box replaces the purple "stay there" line and the cash pill. Guide and driver come before the guests; Share, Calendar, Copy and Tips QR are under "More". Buttons are at least 44 px; Arrived / No-show 48 px; tags 12 px.
- **Calendar cards**: weather shows only when it is rough; the red "!" is now a "Check" label.
- **Guest form**: currency only GEL, USD, EUR (an old booking keeps its currency); language is a drop-down with the language names; the options list has the tick box on the left; "mailto:" is removed from emails.
- **Tour statistics**: the same tour written differently (Kazbegi 4x4 / 4WD, Gareji 4x4 PRIVATE / private) counts as one row and shows the other spellings; booking sources are merged the same way (viator = Viator). New card "No-shows and cancellations": no-shows and their share of past bookings, cancelled tours, guests on them, no-shows by booking source, reasons for cancelling. The month chart works on phones again.
- **Clean-up**: unused functions, translation keys and CSS rules removed; holidays are worked out once per year; the small tables refresh side by side; the offline copy never stores an error page.

## 3.6
- **Pictures**: every tour has a picture that says what it is (mountains, wine glass, church, city walk, buildings, castle, lake, plane, car...), worked out from the name. People can choose a picture with a colour instead of a photo (Me > Choose a picture instead of a photo). Icons: Material Symbols (Apache 2.0), in `icons.js`.
- **Cards look different by type**: tours show "Group" or "Private" with its own icon and colour; day off and sick days have no fill, a dashed outline and a beach / sick icon; public holidays and company holidays are labelled in the day heading.
- **Positions**: a day heading no longer hides under the week strip; the tour window picture sits at the top of a two-line title.
- **Work balance** (Back office > Team > Work balance): per month, for guides and drivers separately: work days, tours, tours where a guide drove himself, longest run of days without a day off, days off, pay, and the difference to the average. Over 25% above average or a run longer than the rule is marked; it says who to give the next tours to. "Who fits this tour" now prefers people with fewer work days that month. A warning shows when a guide without a car has a tour that needs one and no driver.
- **Platform commission** (Back office > Rules, default "GetYourGuide 25"): the price in an OTA email is what the guest paid; the app takes the commission off for revenue, profit and the week figures, and shows the net price on the guest page.
- **Year in a few lines** (Tour statistics): most loyal guest, who spent the most, busiest day and week, biggest group, most profitable tour, most sales as guide, busiest guide and driver, who earned most (guide and driver).

## 3.7
- **Exchange rates**: official daily rates of the National Bank of Georgia (via api.frankfurter.dev, provider nbg) load by themselves in the admin's app and are kept in settings "fx". Every booking is converted with the rate of its tour date. The rates typed in Rules are only a spare.
- **Sick days look different from days off** (rose, solid outline, sick icon; day off blue dashed with a beach icon; half day dotted), also in the week strip and month view.
- **Getting started**: each person sees 3 steps in Tasks and a reminder on the calendar until done: phone and languages (new "My details" on Me), photo or picture, and (guides) "Tours I do": confirm the list or send changes to the office.
- **Day-off plan**: one row per person, one column per week; days off already asked for (waiting) or approved show in their week and count as that week's rest; sick days do not.
- **Personal promo codes**: set per guide in Team > person; added to every tour offer that person sends and shown on their Me page. Offers link to the right tour page on friendly.ge also when the tour name differs from the website name.
- **Review links**: Google Maps, TripAdvisor and Trustindex (Rules), plus GetYourGuide / Viator for guests who booked there; the guest page offers each.
- **Like a native app**: the phone Back button closes the open window first and leaves a Back office page; a thin moving bar at the top while saving or sending; pressed buttons show a spinner and cannot be pressed twice; windows slide up; "A new version is ready – Update now" banner. Text size settings moved from the top bar to Me.

## 3.8
- **Settings apart from Profile** (Me > Settings): text size, colours, contrast, **colour of buttons** (orange, sky, mint, lilac, rose, sun), language, notifications, install, privacy, sign out. Profile keeps photo, details, Telegram, bank, hours, dates, contacts, tours I do.
- **Add to Home Screen** notice on phones in a browser: Android gets an Install button, iPhone the three Safari steps; "Later" hides it for a week.
- iPhone sheets get the grab handle, Android buttons darken when pressed; small phones (320–360 px) get tighter spacing; older browsers without colour mixing keep borders.
- **Tour exchange** (Tasks, and a line on the calendar): tours in the next 30 days that need a guide (or a driver, for tours with a car). "I can do it" sends a request to the office; "Take back" if pressed by mistake. The admin approves in Requests as before. Handing your own tour to a colleague stays in the tour: Suggest a change > Hand over.
- **Working hours for next week**: the Sunday evening task now has the hours for next week; they win over the usual hours and count in "Who fits this tour". Back office > Team > **Who can work** shows next week for everyone, how many filled it in, and sends a reminder to the rest.
- **Personal expenses** (Me > My pay, and "Add a cost of this tour" on a past tour): meal, fuel, car service, accommodation, parking, other. Totals per period in the main currency; the admin sees them in the person's statement and marks them paid back. A friendly nudge when tours have no costs noted. Needs `supabase/update.sql`.
- **Look at the app as…** (Back office): the admin sees exactly what one guide or driver sees; nothing can be saved while looking.
- Time off lists aligned: picture, name and label, date on the right.

## 3.9
- **Setmore Appointments report (.xls/.xlsx/.csv)** reads more: options from the name, service and both Comments columns (+wine, front seat, pick-up, drop-off, non-refundable…), the platform from booking codes (GYG… = GetYourGuide, BR-… = Viator, Klook, Airbnb…), the pick-up address or hotel, the Label ("online" = paid online), and counts the cancelled rows it leaves out. The preview shows what it found.
- **Non-refundable** is a new option for bookings; it is also picked up from booking emails.
- **Guest list check** (Back office > Guests > Check guest list): looks through all guests and bookings and suggests fixes – platform from booking codes, options from names and comments, booking codes from comments, clean names without "X2 +wine", no platform relay emails, phone format. Untick a group you do not want, press Apply; every fix is written in the booking history ("Checked: …").

## 3.11
Design clean-up of **Me > Profile** (method: unslop by @heydamir, CC BY 4.0). No database change.
- "Upload a photo" button instead of the browser's "Choose File / No file chosen".
- Save buttons stay quiet and turn orange only after something in that card changed, so the one thing to press stands out.
- Working hours are typed as 24-hour time (9, 930 or 09:30 all become 09:30), the same on every phone. Special dates are typed day first (24.11 or 24.11.2026); a wrong date is explained and nothing typed is lost.
- On a computer the two columns are balanced: profile, special dates and team contacts on the left; bank details and working hours on the right.
- Team contacts: WhatsApp, call, Telegram and copy always sit in the same columns.
- Me tabs stay on one row on phones (swipe sideways for the rest).
- Bigger taps and text for older phones: 24px check boxes with the whole row tappable, 40px colour dots, 12px labels in the bottom menu.
- Spacing on a 4px grid across cards, fields, tags and lists; card headings a little lighter (600).

## 3.12
- Getting started (Tasks) has a fourth step: **Connect Telegram**. With the bot link set in Back office > Rules it is done once the person links the bot (/link code), otherwise once the Telegram username is saved. Tapping it opens the right place in Me.

## 3.13 – 3.14
Speed and feel (checked on a phone with the CPU slowed 4×, 5,000 guests and 600 tours):
- Changing week is about 30% faster: dates and their names are worked out once and kept, the work-streak check is kept per screen.
- Scrolling never waits for the app: the "hold to drag a tour" listener only switches on while a tour is being dragged.
- The QR library (for tips) loads only the first time a QR code is shown; the other scripts load in parallel (`defer`).
- Screens slide sideways when you change tab (and between Me tabs), like a native app. Off when the phone asks for less motion, and on browsers without the feature.
- Long guest and notice lists draw only what is on screen; pop-up sheets no longer scroll the page behind them.

Fewer sign-outs and a cleaner problem log:
- When the sign-in cannot be renewed because the internet is weak, the app stays signed in and works from the saved copy instead of showing the login screen.
- A computer that went to sleep or a hidden tab no longer adds "No connection" entries.
- Back office > Problems: filter by person, hide connection gaps, and a line "Last 7 days: N problems from N people".
- Login screen: a globe with EN / RU / KA at the top.

Art (tools/art): `make_art.py` makes avatar and badge pictures with Gemini once, on the bot server; see tools/art/README.md.

## 3.15
- Login page: brand on top, the form on one soft card, and under it the account links with the language buttons (globe, EN / RU / KA) right below them. Gentle entrance and a press effect on the button; off when the phone asks for less motion.
- Nightly copy of the database to Google Drive: see tools/backup/README.md.

## 3.16
- "X asks to change their tours" notice: the admin answers on the notice with **Apply** (the person's tour list is updated), **Correct** (opens the person to edit the list by hand) or **Decline**. The person gets "Your request was approved / declined: your tour list". Works for notices sent before this version too.
- Tour card (admin): **Delete tour**. It asks first, says how many guest bookings go with it, and cannot be undone; Cancel tour is still the way to keep a tour in the history.
- Closing a window with typed but unsaved data asks "Keep editing / Close without saving" (close button, tap outside, Esc and the phone Back button).

## 3.17
- Setmore import: the hand-typed "No of participants" column no longer stops the import. Only 1–99 counts as people ("3", "x2", "2+2", "3 (2 adults + 1 child)"); a booking code or long number typed there by mistake is kept as the booking code instead.

## 3.18
- Calendar: the period summary (tours, guests, profit) moved to the bottom of the page.
- The round **+** on phones opens a short menu: Tour (admins), Day off, Sick. Guides and drivers get the + too.
- Tour card buttons in one design with icons: Edit, Move, Copy tour, Cancel tour, Delete tour. **Copy tour** opens a new tour with the same details and no guests.
- Tours that need someone moved off the calendar into **Tasks**; the Tasks tab shows a number. Admins see "Tours without a guide or driver" there, tap to assign.
- Tasks: adding a task is the same round + as on the calendar.
- iPhone: the screen no longer zooms in and stays zoomed when a field is tapped.
- Special dates: the dots are typed for you (24111990 becomes 24.11.1990).

## 3.19 – 3.20
- Tasks has two sections: **Tasks** and **Tours to staff** (for guides and drivers: **Tours to take**). The number on the Tasks tab counts only your own open tasks. The help button sits on the title row; adding a task is a labelled **New task** button.
- Special dates: one-tap suggestions (Birthday, Anniversary, Family day, Private, Doctor, Car service, Trip) and the phone's own date picker.
- Open-tour lists show the language the guests asked for, and the icon sits beside the text.
- Drivers with the Delica are offered only 4x4 rides (4x4 in the name, Kazbegi, Gareji, Tusheti, Truso, Juta, Khevsureti).
- Tour card: a person shows the role and at most one title; people and guests line up.

## 3.21 – 3.22
Phone calendar in the layout the team knows from Setmore:
- Header: the month name opens and closes the full month; arrows, a date jump, and a round **ALL / me** button to switch between the team and your own tours. On computers nothing changed.
- Light day strip (selected day is a dark square, today has a ring) and tour cards as tinted blocks with a colour bar.
- A slim bar above the menu: "This week · 12 tours · 55 guests · profit"; tap it for the full breakdown (admins).
- The round + opens a sheet: Tour, Day off, Sick, Task, Add person.
Special dates (Me): an open list with an icon per kind, edit and delete icon buttons, and "+ Add a date" that opens a sheet with one-tap kinds and rolling day / month / year wheels.

## 3.23
- Delica drivers are offered a tour only when its name says 4x4 or 4WD (or Delica). Place names such as Kazbegi no longer count, because not every Kazbegi tour is a 4x4 ride.

## 3.24
- Badges are drawn as medals: a ribbon, a shaped medal (seal, shield, hexagon or star by kind) and the symbol in the middle. Bronze, silver and gold by the step on the ladder; grey with a progress arc until earned; a short shine when an earned badge is opened. The shared badge picture uses the same medal.
- Getting started: the Telegram step has "I don't use Telegram", which ticks it off.
- Tasks: when tours are waiting, a line at the top says so and opens the second section.

## 3.25
- New app icon (calendar page, mountains, sun) and a small picture on the sign-in page (mountains and trees, no buildings).
- Sounds and vibration: a short tone when something is saved, a lower one on an error, a light tap on Android. Settings > Sounds turns both off.
- A new big badge arrives as a gift box: tap to open, the medal comes out with a shine.
- Each badge keeps the day it was earned ("Earned on 11 November 2026") on its page. Badges earned before 3.25 show no date.
- Links to friendly.ge in the offer text carry Google Analytics tags (source friendly_schedule, medium guide_offer, campaign = the promo code or "team", content = the tour), so visits and bookings from guide messages show in GA4 under Traffic acquisition. Tip QR codes and review links go to other sites and are not tagged.

## 3.26
- Messages for guests link to the tour's own page, never the home page: first the Back office list `rules.tourPages`, then the catalogue, then the group or private tours list. The message ends with "Use my code X at checkout for 15% off" (`rules.promoPct`). Google Analytics tags: campaign = the guide's code, content = the activity id.

## 3.27
- Avatars: 30 painted pictures (Georgia, food, travel things) in Me > Choose a picture instead of a photo. Painted once with Gemini; no churches. The files are in `art/avatars/` (192 px, about 5 KB each).
- Tour pages are also found for short calendar names with nothing set by hand ("Tbilisi walking tour" opens the Old Tbilisi walking tour page; "Gareji 4x4 ENG" the group Gareji page). Same kind only: a group name never opens a private page.
- The Telegram bot has the same messages: /guests.

## 3.28
- Four calmer colour schemes in Me > Settings > Colour of buttons: Forest green, Sea blue, Plum, Terracotta (white text on the colour; lighter versions in the dark theme). Orange stays the default until the owner picks another.
- "1 tour needs a guide or driver" instead of "1 tours need".
- Long task notes keep their line breaks.

## 3.29
- Default colours follow the Friendly.ge brand book: green for structure (selected tabs and chips), one orange for the main button, sand for soft bands. Me > Settings > Colour of buttons keeps the other schemes; the old bright orange is there as "Bright orange".
- Badge page: "Open the box again" replays the gift-box opening of an earned badge.

## 3.30
- Badges are cute round stickers instead of metal medals: a soft colour by group, one simple friendly picture with a little face, one to three small stars for the step on the ladder. Not earned yet: pale, with a ring that fills up. The 38 pictures are drawn by hand in `cute.js` (no picture files, no outside service); `CUTE.map` says which badge gets which picture.

## 3.31
- Header is one line. The dot before "Friendly Schedule" is the connection status (green = up to date, amber = sending or old data, grey = no internet). A status line appears under the header only when something needs attention. The "Test version" chip moved to Me > Settings, next to the version.
- The weekly money bar sits exactly on the bottom menu (no strip of the list between them), on any phone and text size.
- Tour cards: the crew sits on the same line as the kind and guest count; one person who guides and drives is shown once.
- "My next tour" shows how soon it is (Today, Tomorrow, in 3 days) on the right.

## 3.32
- Time off page, for guides and drivers: a "Work and rest" card counted from the schedule. Last 30 days (working days, tours, longest run) with one plain piece of advice; the next 14 days and the next free day; high or low season (Back office rules) and the next busy period (peak dates); the most booked tours now and one the person has not led yet; and "Earn more": how many tours on their free days still need a guide or driver, with a button to the list. No guest names.

## 3.33
- Work and rest is personal. "My wishes": how many tours a week feel right, best days to rest, and more work / as it is / more rest (saved on the person's account, `display.wr`). The advice then compares the real week with the wish, counts tours on the chosen rest days and warns about a coming tour on one.
- New lines from the person's own history: this week against their usual week, busier or calmer than the month before, busiest weekday and usual start time.
- By role: drivers see kilometres and long road days; guides see guests hosted and the languages asked for in the next 30 days next to the ones they speak.
- Forecast: team bookings for the next 30 days against the previous 30, and the same days last year when the data is there.
- The card ends with: "Automatic suggestions, counted from your schedule and your answers. They can be wrong: you and the office decide." Everything is recounted on every open.

## 3.34
- Badges page: region titles and tour mastery have their own pictures (fox for the city, mountain, sun, wine glass, cave, compass, flag; tour mastery by the tour's name) instead of the same trophy and star. Three even columns on phones.
- Sticker: the picture sits inside the circle on every badge, smaller stars. Share picture uses the brand colour.

## 3.35
- **Guest counts are guarded before every save.** A count or capacity must be a whole number from 0 to 999. A long number that slipped into a count (11 Nov: a 16-digit booking number) is taken out, kept as the booking code when there is none, the row is saved with 0 and the admin is told. A booking is no longer lost because of one bad number. The pasted-email reader takes only 1-99 as a head count.
- Old copies update: the "new version" line shows on every page, and the app reloads by itself when the person comes back to it with nothing open.
- A turned or resized screen during a page change is no longer reported as an error.
- Two logins of one person: `rules.sameAs { second account: main account }`. The second login works as the main one (same tours, badges, statistics, pay, settings); the person shows once in lists; the team list marks the second login. The two Boss accounts are joined this way (27 tours moved to the main one; the ids are kept in the settings row `merge_log`).
- Badge page: how many teammates have the same badge. Badges page: "My road", how many times the person crossed the Jvari Pass or the Armenian border, went to Tusheti, Gareji, Kakheti and so on (a pass or border counts twice).

## 3.36
- **Photo of the day.** One photo per person per day, with a few words. The team likes photos with a heart; the most liked one is marked "Photo of the day". Tap a photo to see it large. Older days are in the archive (the best of each day), and "Photographers this month" lists who posted and how many likes they got. Only the team sees the photos: they live in a private storage folder (`photos`), made small on the phone before sending (1280 px and a 420 px preview). Needs internet.
- New badges: First shot, Photographer (10), Team photographer (50), Crowd favourite (25 likes), Good teammate (10 thank-you notes).
- **Thank-you notes** between teammates on the Badges page.
- **Team goal of the month**: the office types a number of guests; everyone sees one shared bar.
- **Challenge of the week**: one small personal goal that changes every Monday (a photo, a thank-you, three tours, a weekend tour, an early start).
- **My year so far**: a short recap to read or share.
- A greeting on the person's own birthday or anniversary (from their special dates) and on holidays from the team calendar.
- Database: tables `photos` and `thanks`, function `photo_like`, storage folder `photos` (in `supabase/update.sql`, already applied).

## 3.37
- Photo of the day looks like a card: taller pictures, the words sit on the photo as a paper label, and the person can put one of their earned badges on it as a sticker (when adding the photo, later with "Save text and sticker", or from a badge page with "Put on my photo of the day").
- Share: the large view makes one picture to send (photo, label, sticker, name and date, Friendly.ge).
- Database: `photos.sticker` (in `supabase/update.sql`, already applied).

## 3.38
- Operations agents: four read-only checks in the database (`agent_board`, `agent_find_refs`, `agent_changes`, `agent_conflicts`), one notice they may write (`agent_notify`, shown as "Assistant (automatic check, can be wrong)") and a run log (`agent_runs`, `agent_run_done`). Only the database owner can run them. In `supabase/update.sql`, already applied.

## 3.39
- Guide's own tour rows: the time ("10:30") and the guest count ("(1/6)") never break in the middle; the long name wraps.
- Time off, for guides and drivers: "Team off soon" shows numbers per day ("guides off: 2, drivers off: 1" and the share of the team), not names. The office still sees names.
- Me: one Save for phone, languages and Telegram username.
- The meeting place of the Brutalist group tour is shown as "Paragraph Hotel" (app, catalogue and bot); the map link is the same.

## 3.40
- **Photo of the day is simpler to add.** One big dashed box "Add my photo of the day", then a preview of the chosen photo with the words, the sticker row and one Post button. Nothing is sent before Post. If sending fails the sheet says why in plain words, and the problem goes to the office's problem log (kind `photo`). Under your own photo: "Words and sticker" and "Another photo".
- The Photo of the day line is near the top of the guide's home page, and it also shows in "Look as" (to look only: no adding, no likes).
- **Badges page, what matters first:** level, Almost there, My badges (earned ones, titles first), team goal and challenge, My road, thanks. Folded away: Badges still to earn, Tour mastery, This month. A section you open stays open.
- **Stars mean a level.** One to three stars only on badges that come in steps and on tour mastery, on a small white label under the sticker. One-off badges and titles have none.
- **Abano Pass:** My road counts crossings ("Crossed the Abano Pass (Tusheti) ×N", twice per trip), and three badges: Over the Abano (2), Abano regular (10), Master of the Abano (30).

## 3.41
- **Week strip is easier to read.** Under each date: a dot with the number of tours (amber when a tour still needs a guide or driver, office only) and a small umbrella for days off (filled when it is your own day off, with a number for how many people are off). A one-line key under the strip says what the marks mean. Marks no longer hide under the dates on narrow phones.
- The day-off icon is an umbrella everywhere (strip, Time off tab), not a sun.
- **Messages do not pile up.** The same message is shown once (tapping Refresh ten times shows one message), and at most two messages are on screen. With no internet, Refresh says "No internet right now. You see the data saved on this phone."
- **A greeting instead of "Loading…".** While the app opens you see a small sun or moon and "Good morning / Good afternoon / Good evening, <first name>" in your language. The first name and language are remembered on the phone only (`fs-hello`), and removed on sign-out.
- A photo that is still loading shows a quiet camera, not an empty square.
- **Photo of the day moved down.** The schedule comes first; the Photo of the day line is now under the week's tours (guides and drivers) and under the calendar (office), not at the top of the first screen.

## 3.42
- **A greeting line on the home page.** On an ordinary day: a small sun or moon, "Good morning / afternoon / evening, <first name>" and one short phrase. Morning: a few warm words for the day. Afternoon: a light joke about guiding or a Georgian saying (Shota Rustaveli, proverbs, the motto of Georgia, one line by Pushkin about the Tbilisi baths). Evening: calm words. Each person gets their own phrase, and it stays the same for the whole day. The phrases are in `phrases.js` in English, Russian and Georgian; adding one is adding a line.
- **Wishes on special days** (a card with a sticker): own birthday or anniversary, a holiday from the team calendar, **a sick day ("Get well soon")** and an approved day off ("Enjoy your day off").
- The screen shown while the app opens uses the same words: the phrase of the day, or the birthday, holiday or get-well wish. The words for the next seven days are kept on the phone only.
- **Bottom bar lines up.** The day-off icon is now a line drawing like the other three, in the same 20px box, so all four labels sit on one line.

## 3.43
- **Opens at once.** A person who used the app on this phone before sees the saved schedule immediately; fresh data is fetched behind it and swapped in (a thin line at the top shows it is loading). Before, the app waited for the server first. A change made in that first second waits and is sent when the fresh data is in. If the person was signed out, the saved copy is removed and the sign-in page shows.
- All tables are asked for at the same time instead of one after another, so the first open and Refresh are faster too.
- **The greeting is not on the first screen any more.** Ordinary days: the phrase of the day sits at the bottom of the calendar page, and on the short opening screen. Special days (birthday, holiday, sick day, day off) keep their card at the top.
- Time off: dates in "Team off soon" stay on one line; "1 day", not "1 days". The "All" chip in the calendar header fits its Georgian word.
- **Back office > Usage:** choose Everyone / Guides / Drivers / Office and an age group (only where the birthday with a year is in the profile). New card "Phones and settings": how many people use iPhone, Android or a computer, have the app installed, a small screen or large text. A device column in the people table. More buttons are counted (badges, photo likes, thanks, refresh, bell, week arrows). Only counts are stored: no phone model, no location.

## 3.44
- **Month view has clear arrows.** Above the grid: "‹ October | November 2026 | December ›". Each arrow names the month it opens. Swiping left and right still works.
- **The greeting phrase is removed everywhere** ("Good evening, name" with the phrase of the day): gone from the calendar page and from the opening screen, and `phrases.js` is deleted. The opening screen shows only a short "Good evening, name" while the app starts. Cards on special days (birthday, holiday, sick day, day off) stay.

## 3.45
- Month arrows are round buttons with the arrow only (the month names did not fit on phones). Screen readers still hear which month each arrow opens.

## 3.46
- **Header:** the app name is one word, "Schedule" (Расписание / განრიგი).
- **Month view:** the month name shows once. On phones the row above the grid is "‹ Today ›"; on a computer the existing header arrows are used.
- **Time off, for guides and drivers: "Team ready, next 4 weeks".** A plain calendar with every date. Each day shows what percent of the team is working. A day marked "!" is not a good day to ask off (you have a tour, a busy period, or several people are already off); tap it to see why. Tap any other day to ask for it. The office still sees the list with names.
- **Company holidays** rows: date on the left, name on the right, like the list above.
- **Work and rest is shorter.** First the animal of the week (from last week: resting cat, wise owl, quick fox, early bird, strong bear), then three numbers (tours this week, working days in 30 days, next free day), one tip, and the wishes. The long text is folded under "More about my schedule".
- **Drivers** are no longer told to learn a tour that has no car (walking tours).
- **Names in the person's language:** well-known holidays and busy periods (New Year, Christmas, Easter, Tbilisoba, Nowruz and others) are shown in Russian and Georgian. A name the office made up stays as typed. The double dot after a Russian date is gone.
- **Badges:** long names break with a hyphen ("Первопрохо-дец"), not in the middle. Folded sections are card rows with the count next to the title and "Show" / "Hide" on the right.
- **Changes made without internet are safer.** A change is written to the device at the moment it is made (before, up to a second later). The browser is asked not to clear the app's saved data. The installed app's icon shows the number of waiting changes. On a computer, closing the tab with unsent changes asks first. On Android and in Chrome or Edge, when the internet returns and the app is closed, one notice says "Changes are waiting" (only if notifications are on); opening the app sends them. The app itself does the sending, because it holds the sign-in.

## 3.47
- **Calendar views on a computer, as in Setmore:** Day, Week, Month and Agenda. Agenda is one long list by date for 30 days: time, coloured dot, tour with places taken, and who leads and drives; days off are listed too; a row opens the tour card. Keys: D, W, M, A switch the view and T switches whole team / mine (not while typing).
- **One person's calendar:** the office can choose a person next to the view buttons; week, month, day and agenda then show only that person. "All team" shows everyone.
- **Print** button: prints the view on screen without the menus.
- Not added from Setmore, on purpose: slot size, slot frequency, default duration, off-hours and double-booking switches (the app works with tours, and already warns about two tours at once). "Hide weekends" is not built yet.
- **Back office > Backup > Offline copy on this computer.** In Chrome or Edge on a computer the owner chooses a folder once (for example inside Google Drive). While changes wait for the internet, the app writes one file there, `friendly-schedule-offline-copy.json`, with the whole schedule and the waiting changes, and again when they are sent. Drive uploads it by itself when the connection is back. "Save a copy now" works in any browser. The file has guest details: the folder must stay private. The app still sends the changes itself; the file is a safety copy.

## 3.48
- **Month view:** each tour row has its own tour colour (before, the guide's colour was used, and the team all had the same grey). A tour can be dragged to another day (office). One frame on the chosen day. The day-off mark sits in the top right corner of the day, on the line of the date.
- **Tour card:** Edit, Move, Copy, Cancel and Delete are smaller and sit in one row.
- **Guest card:** "‹ Back" returns to the card it was opened from, and ✕ closes everything. Each mark (Good, Fine, Bad, Trouble maker) is one small button. Every booking ref of the guest is listed, with the tour date, as text that selects with one click. Fields and section titles start at the same left edge.
- **Why a guest is VIP**, in facts about that person: how many tours and since which year, which tours, which extras and how often, good marks from the team, and whether they ever missed a tour.

## 3.49
- Guest card: the phone and a country flag are on one line (the country name shows on hover); the phone selects with one click.
- Guest card, office only: **Income** from this guest, after the booking site fee, per currency, with what the guest paid. It counts only bookings that have a price saved, and says how many. Guide pay and costs are not taken off, so it is income, not profit.

## 3.50
- Time off: the two lists look the same again. What it is (the guide, the holiday or the event) is on the left, the dates are on the right.

## 3.51
- **Guides and drivers on a computer** get the same switches at the top as the office: Day / Week / Month / Agenda and Team / Mine, with Day summary on the right (the three links at the bottom are for phones only). The home page is one centred column and the week strip uses its full width.
- Week strip: a sick day shows the sick icon, not the umbrella. The chosen day keeps dark text when it is also a day off or sick day (it was white on pink).

## 3.52
- **Tour card on a computer is a small window** next to the tour you clicked (week, month and agenda), not a sheet in the middle. Editing still opens the full form. Phones keep the sheet from the bottom.
- **Facts line on the tour card:** Group or Private, for group tours "Seats 5/6" and how many are free (or "full"), language badges (EN, RU and others from the tour and its bookings), and for the office what the guests paid.
- **Guest card reviewed:** the marks come first under "Mark this guest" (the title is no longer repeated), then the note and earlier marks with a readable date, then Like and Dislike as two small buttons on one line. The Income row is hidden when no prices are saved.
- Tour card buttons on a phone: one compact row, icon above a short label.
- **Updates arrive whole.** The app's files now open from the saved copy of one version (instant start, also on weak internet). A new version is downloaded completely in the background and then replaces the old one; if the app was just opened it reloads by itself, otherwise the "new version" banner shows. Before, on a weak connection a phone could run new styles with an old program file, or stay on an old version for a long time.

## 3.53
- **One set of sizes.** All corners now use five names (small 8, medium 12, large 16, extra 28, pill), where there were 14 different values; two stray text sizes were moved to the scale. The rules are written down in `GUIDEBOOK.md`.
- **Leftovers removed:** the styles and code of the removed greeting phrase, and 26 texts in each language that no screen used any more (old photo flow, old day-off lists and others).
- Fixed: the pay-question tag showed "dp_accepted" / "dp_declined" instead of "Accepted" / "Declined".

## 3.54
- **Guides and drivers see only their own schedule.** The Team / Mine switch, the "Whole team's calendar" link and the T key are for the office only; every view (day, week, month, agenda) shows a guide or driver their own tours. They still see tours that need someone, the team-ready percentages without names, and their partner on their own tours.

## 3.55
- **Time off: your days off are on the Team ready calendar.** Approved days off (umbrella), sick days and requests still waiting (dashed) are marked on the same calendar as the team percentages. Arrows move four weeks back or forward, so past days off can be looked up too. Tapping one of your days says what it is.
- **My requests is short.** It lists only what is coming up or still waiting; everything earlier is folded under "Earlier requests".

## 3.56
- **Time off: "Best time for a rest"** replaces "Suggested days off". It offers up to three whole weeks (seven days in a row) in the next four months when the person has no tours, no busy period or high season falls on them, fewer than two teammates (20% of the team) are off, and the team has the fewest tours. Each week says why ("nobody else is off · team tours that week: 3"), and mentions it when the person worked 30 or more days in the last two months. Tapping a week opens the request with both dates filled. Single quiet days stay below. These are suggestions; the office decides.

## 3.57
- **After a tour, one tap to say how it went.** When a tour of yours has ended (today or in the last two days) the home page asks "How was Kazbegi today?" with four buttons: Great, Good, Normal, Hard day. It saves the tour score the office already sees. "Not now" hides it.
- **How do you feel today?** Asked once a day on the first open: Great, Good, So-so, Tired, Not well, or "Not now". The card says plainly that the office sees the answers. Work and rest shows today's answer with "Change". The office sees "How the team feels, last 14 days" in Back office > What gets used: the team average and each person's last answers as small faces.
- **Totem animal.** "Show me my totem animal" (Me > Badges, and "How it was counted" on Work and rest; the office has it too). It shows the numbers one by one (tours, working days, guests, different tours, early starts, rest days) and then the animal. Counted from the last two full weeks; it changes on Monday. Nine animals, all compliments: resting cat, strong bear, busy bee, bright butterfly, steady turtle, early bird, lucky ladybug, quick fox, wise owl.
- **New badges**, counted from the person's own tours:
  - Guests' countries by phone code: Ten / Twenty-five / Forty flags; Favourite country (50 guests from one country), Second home (200), Honorary consul (1,000). The badge names your top country.
  - Names: Name twins (5 guests with the same first name), Name club (15). Secret: Namesake (a guest with your own first name), Rare letter (a name starting with Q, X or Z).
  - Wine tasting extras: Toast starter (5), Tamada (25), Grand tamada (100). Shoti baker: 25 tours to Kakheti.
  - Mother of Georgia storyteller: 50 and 200 Old Town walks.
  - Places unlocked by the first tour there: Chiatura cable car, Juta valley, Ananuri Fortress, Tskaltubo sanatoriums, Soviet lift rider, Uplistsikhe, Vardzia, Canyons and caves.
  - Volunteer (3) and First hand up (10): offers to take a tour that needed someone.
- **My road** also counts: told the story of Mother of Georgia, rode the Soviet lift, stopped at Ananuri, rode the Chiatura cable car, walked in Juta, visited Tskaltubo.

## 3.58
- **Me > Settings > What I see:** two switches. "Badges, levels, challenges and the totem animal" turns the game side off for that person: no Badges tab, no badge windows, no weekly challenge, no animal on Work and rest. "Photo of the day" hides the photo line. The choice is saved in the person's profile, so it follows them to another phone. Schedule, days off, pay, the after-tour question and the daily feeling question are not affected.
- **Legends:** four goals that are almost impossible on purpose, with real progress shown: The Great Wall (100,000 guests from one country), Two thousand of one name, A whole stadium (100,000 guests), Ten thousand stories (Mother of Georgia told 10,000 times). They do not appear under "Almost there".
- **"Never ask me this again"** on the daily feeling question and on the after-tour question. Each can be turned on again in Me > Settings > What I see, where there are now four switches (badges and animals, photo of the day, daily question, after-tour question).
- **Welcome guide.** On the first open, and on each new phone, a short guide walks through set-up, one step per screen: language and text size, adding the app to the home screen (instructions for iPhone, Android or a computer), turning on notifications and sending a test, phone and languages, a profile picture, the tours you can lead (guides), usual working days, where to send pay, special dates, and Telegram. Every step has "Skip this step"; "Next time" closes the guide. Steps already done are left out, so a person who set up before sees only the two phone steps on a new phone. It opens by itself at most three times per phone; after that a small banner and a button in Me > Settings lead back to it.
- **Time off on the calendar can be opened.** Tap a day off, half day or sick day (agenda, day list, team week) to change its type, dates or note, or remove it. The office can open anyone's; a guide or driver only their own, not past ones. The office can also drag one to another day or, on the team week, to another person; the app asks before moving. A second entry for the same person on the same days is no longer saved.
- **View switch stays put (guides and drivers, computer).** Day / Week / Month / Agenda sit in the same place in every view; the next-tour card moved below them.

## 3.59
- **Leaving a screen.** The title row with the ✕ (or ‹ Back) button now stays in view while a pop-up card scrolls. On phones a card can also be pulled down to close it. The badge screen has a ✕. In Back office the "‹ Back office" row stays in view while the page scrolls.

## 3.60
A tidy-up round after the owner's phone recording of 3.57. Nothing new to learn; the same screens are shorter and calmer.
- **"Looking as" bar.** One line: "Looking as Mariam" and the button "Back to me". It stays under the header on every tab while you scroll, so the way back is always there. Nothing can be changed while looking, as before.
- **One banner at a time.** If several want to show, only the most important one does: looking as someone, then "A new version is ready", then the set-up line.
- **Where the app opens.** Guides and drivers open the calendar at the very top (the week strip marks today, and Today is one tap). The office still opens on today. After the app reloads itself the page opens at the top, not where it was scrolled before.
- **"Hide badges and animals".** A quiet link at the bottom of Me > Badges and in the totem window. It opens Me > Settings > What I see, where the switch is. When badges are hidden, a line there says how to bring them back.
- **People off in the day list.** One short row per day, "Day off:" and then one small name tag per person (a second row "Sick:" when someone is ill), in place of one big card per person. Tap a name to open that entry; the office can still drag it to another day. A person appears once.
- **Week strip.** One row of marks under the dates (a dot for tours, an umbrella for people off). The numbers moved to the day title below: "2 tours · 1 off".
- **Warnings.** An amber warning sign and plain dark text, for example "Nino has another tour at the same time". No "!" and no red text; red is kept for Cancel and Delete.
- **Tour card buttons (office).** Edit, Move, Copy, More. "Cancel tour" and "Delete tour" are inside More, and both still ask first.
- **Guest rows.** Name and number of guests on one line; the message and call buttons are in the same place on every row, also when a guest has no phone.
- **Time off for guides and drivers.** The request button and "My requests" come first, then the three numbers, then the Team ready calendar. Work and rest, My wishes, Best time for a rest, Earlier requests and Company holidays are folded; one you open stays open. The page is about three screens long, not nine.
- **My requests.** Every row has the same shape: type and answer on the left, dates and number of days on the right. The import note "Setmore" is shown to the office only.
- **Number tiles.** Same height, short words ("Days off", "Sick days", "Waiting"); the year is in the small title above. Work and rest tiles show one number and one label; the extra numbers (usual week, most working days in a row, tours in 14 days) are the first lines of "More about my schedule".
- **Best time for a rest.** The reason is said once above the list; each row is only the dates and "Ask". The note about automatic suggestions appears once.
- **Team ready calendar.** A percent is printed only on days below 100. No number means the whole team is working.
- **Tasks.** The "Getting started" card is gone from Tasks. Set-up lives in the welcome guide; the one line on the calendar opens it. The Telegram step, with "Skip this step", is in the guide.
- **Me tabs.** Shorter words (Profile, Settings, Pay, Stats, Badges) so all five fit on most phones. On a narrow phone the row runs off the right edge to show there is more, and the chosen tab is always in view.
- **Telegram bot help.** Three numbered lines and one button: "Get code", then "Open the bot". "New code" is a small link.
- **Empty pages.** A person with no tours yet sees one line ("Your numbers appear after your first tour", "Badges appear after your first tour") in place of zeros, an empty chart and "0.00% of the way to the Moon".
- **Bottom menu.** Labels are one size, never cut; on small phones each tab is as wide as its word needs.
- **Same things, same size.** Buttons and fields are at least 44 px tall on phones; calendar arrows and day cells are bigger; the bell keeps its round shape with the count on its corner; month letters under the statistics bars are no longer cut; small gaps were evened out.
- **Motion.** One short, plain movement for cards and tab changes. Nothing bounces or loops; the gift box shakes twice and then waits. With "reduce motion" on the phone nothing moves.
- **Words.** No exclamation marks in the app's own texts (messages sent to guests are unchanged). Counts are written "4/5". "Happy birthday, Nino" and the greeting while the app loads stay.
- **Fixed.** Two pairs of texts shared one name, so the team-goal card showed the Telegram title and the "Tours I do" card showed "We are updating the app". Each has its own text again.
- **Long press (Android).** Holding a finger on a tour card, a row, a name tag, a tab or a button no longer selects its text or opens "Copy / Select all". Phone numbers, booking references, addresses, notes and form fields can still be selected.
- **Looking as someone is quiet.** While the office looks at the app as another person, that person's "New badge" gift box, confetti and badge notice are never shown, and none of their badges is marked as seen. They still get them when they open the app themselves.
- **"New badge" notice.** It leaves by itself after about 6 seconds, has an ✕, can be swiped away, and goes as soon as you touch anything else. It sits above the bottom menu, one at a time.
- **Round "+" and "New task" buttons.** Pages that have one get more room at the bottom, so the last card or link can always be scrolled clear of the button.
- **Text size "Very big".** The "Looking as" bar stays one line (it shows the name alone when room is short; "Back to me" is always whole). Me tabs and the bottom menu stay readable at every text size.
- **Status bar colour (Android).** The bar above the app takes the header colour, light or dark, not teal.
- **Relay emails.** Guides and drivers no longer see a guest's email when it is only a booking platform's relay address (GetYourGuide, Viator / Tripadvisor, Booking.com, Airbnb, or a very long machine-made address). The office sees every email as before; nothing is changed in the data.
- Not changed, waiting for a check on a real iPhone: the header moving a few pixels after a tab change.

## 3.61
- **Free tour bookings from email.** "Booking from email" now reads Freetour.com confirmations: tour, date and time, guest, number of people, phone, language and booking code, and marks the booking as a free tour. It also reads the message when the whole raw email is pasted.
- **Guest emails from booking emails are saved.** "Booking from email" now keeps the guest's email on the client card also when it is a coded relay address (GetYourGuide, Viator, Airbnb, Apple "Hide my email"): the office can still write to it. Guides and drivers do not see relay addresses.
- **Badges and animals switch is easier to find.** "What I see" is now the first block in Me > Settings.

## 3.62
- **Boss tours are open for exchange.** Every upcoming tour that sits on "Boss" now appears for guides in Tasks > Tours to take, marked "Boss's tour", with the "I can do it" button. The office approves each request as before; on approval the tour moves to the guide who asked. No setting is needed.
- **Not for exchange.** The tour card of a Boss tour has a box "Not for exchange" (office only). Tick it and that tour stays with Boss and is not offered.
- Limit: a Boss tour that also has a driver set is not offered, because the database accepts "I can do it" only for a tour with an empty guide or driver place.
