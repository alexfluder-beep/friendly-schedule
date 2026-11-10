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
- For notifications when the app is closed (web push), extra one-time setup is needed:
  1. Generate keys: `npx web-push generate-vapid-keys`. Put the public key in `config.js` (`vapidPublicKey`).
  2. Deploy the function: `supabase functions deploy push --no-verify-jwt` and set secrets
     `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@example.com`), `WEBHOOK_SECRET` (any long random text).
  3. In Supabase **Database > Webhooks**, create a webhook on table `notifications`, event **Insert**, to the function URL, with HTTP header `x-webhook-secret` set to the same secret.
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
- Database: run `supabase/update-2.4.sql` once (safe to run again).
