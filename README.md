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
