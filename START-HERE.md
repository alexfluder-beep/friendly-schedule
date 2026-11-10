# Start here: Friendly Schedule with only your own team

These steps turn the demo into the real app: no sample people, only your guides and drivers, working offline on their phones.
Time: about one hour. You need a computer, your email, and nothing paid.

## What you get at the end
- One web address your team opens on iPhone and Android and adds to the Home Screen.
- Each person signs in with their own email and password.
- The app keeps working without internet after the first sign-in.

## Step 1. Create the database (10 minutes)
1. Go to supabase.com and create a free account and a new project. Region: Frankfurt (closest to Georgia).
2. Open **SQL Editor > New query**. Open the file `supabase/schema.sql` from this folder, copy all of it, paste, press **Run**. It should finish with no errors.
3. Open **Authentication > Sign In / Providers > Email** and turn **Confirm email** off. Then people get in at once after creating a password.
4. Open **Project Settings > API**. Copy two things: the **Project URL** and the **publishable (anon) key**.
   Never copy the secret / service_role key anywhere.

## Step 2. Connect the app (2 minutes)
1. Open `config.js` in a text editor.
2. Paste the Project URL into `supabaseUrl` and the publishable key into `supabaseKey`. Save.
   From this moment the sample team is gone: the app shows only what is in your database.

## Step 3. Put the app online (10 minutes)
1. Create a free GitHub account and a new repository (private is fine with GitHub Pro; public is fine too, the files hold no team or guest data).
2. Upload every file from this folder.
3. **Settings > Pages > Deploy from a branch**, branch `main`, folder `/ (root)`. After a minute the app is at `https://<account>.github.io/<repository>/`.
4. Back in Supabase: **Authentication > URL Configuration > Site URL** = that address.

## Step 4. Make yourself the admin (3 minutes)
1. Open the app address, choose **Create account**, use your email.
2. In Supabase **SQL Editor** run the last line of `schema.sql` (remove the two dashes at the start, put your email in it).
3. Reload the app. You now see **Back office**.

## Step 5. Add your guides and drivers (10 minutes)
1. **Back office > Team > Add several people at once**.
2. Paste one line per person: `name, guide or driver, email, phone`. Press **Add all**.
3. Open each person with **Edit** if you want to set their languages, working days, vehicle (own car or Delica) and the tours they lead.
4. Send each invitation (WhatsApp or Copy). The person opens the link, taps **Create account**, uses the same email, picks a password. They are in.

## Step 6. Your tours and settings (10 minutes)
- **Back office > Tour list**: check names, start times, duration, group size, meeting points.
- **Back office > Salary**: pay rates.
- **Back office > Rules**: review links, Keepz tip link, guest currency.
- **Back office > Privacy**: how long guides see guest details (default 14 days) and when old guest contacts are removed (default 24 months).
- **Back office > Setmore import**: upload the Setmore report to bring the history in.

## Step 7. Phones and offline
1. Each person opens the app address in Safari (iPhone) or Chrome (Android).
2. iPhone: Share button > **Add to Home Screen**. Android: menu > **Install app** / **Add to Home screen**.
3. Open it once with internet and sign in. After that:
   - the last loaded schedule, guest lists and contacts open without internet;
   - marking a guest arrived or no-show, ticking a task and asking for a day off work offline and are sent when the connection returns (a banner shows how many changes are waiting);
   - weather and new changes from the office need internet.
4. Signing out removes the offline copy from that phone.

## Step 8. Test before you tell everyone
Do the 7-point checklist in `README.md` ("Before release") with two phones: one admin, one guide.

## Optional
- Phone notifications when the app is closed, and the evening reminder: see "Notifications" in `README.md`.
- Backups: **Back office > Backup** once a week (the free database plan has no automatic backups and pauses after a week with no use).
