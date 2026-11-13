# Schedule in the crew Telegram bot

These three files add the schedule to the existing bot (branch `telegram-bot`). Nothing is live until they are copied into the bot folder and the bot is restarted.

## What guides and drivers get
- `/link 123456`: connect Telegram to their person in the schedule. The code is shown in the app: **Me > Telegram bot**. It works once.
- `/week`: their tours and days off for the next 7 days.
- `/tomorrow`: their tours tomorrow.
- `/bug text`: report a problem. A photo or a short video can be sent with the same text as its caption. A video is never stored: `ffmpeg` (if installed on the bot server) keeps up to 4 still pictures from it; photos are kept small (under 450 KB). The admin sees the report in the app (Back office > Problem reports) and the answer comes back to the person here.
- Notices in Telegram: new tour, time change, cancellation with the reason, the evening reminder for tomorrow, the Sunday "check your week".
- Every message has an **Open schedule** button that opens the app.

No guest names or phones go through Telegram. Messages carry only the tour, time, meeting point, number of guests and the colleague on the tour. Guest lists stay in the app.

## Install (10 minutes)
1. Copy `schedule.py`, `schedule_handlers.py`, `tickets_handlers.py` and the two test files into the bot folder, next to `bot.py`. For `/bug` run the 3.72 block of `supabase/update.sql` once in the Supabase SQL editor first.
2. In `bot.py` add three lines:
   - at the top with the other imports: `import schedule_handlers`
   - in `build_app()`, after the other handlers: `schedule_handlers.register(app)`
   - in `post_init(app)`: `app.bot_data["schedule_task"] = asyncio.create_task(schedule_handlers.notice_loop(app))`
3. In the bot's `.env` add:
   ```
   SCHEDULE_URL=https://<project>.supabase.co
   SCHEDULE_SERVICE_KEY=<service_role key from Supabase: Project Settings > API>
   SCHEDULE_APP_URL=https://<account>.github.io/<repository>/
   ```
   The service key gives full access to the schedule database. It belongs only in this `.env` on the bot server: never in the web app, never in GitHub, never in a chat.
4. Check: `python -m unittest test_schedule` (4 tests, no network needed).
5. Restart the bot. In the app set the bot link in **Back office > Rules > Telegram bot link**, so people see an "Open the bot" button.

While `SCHEDULE_URL` or `SCHEDULE_SERVICE_KEY` is empty the bot works exactly as before.

## Ideas for a next step
- Open the app inside Telegram (a "mini app" button), so guides never leave the chat.
- "I am sick today" and "ask for a day off" as bot buttons.
- One shared set of badges: the bot already has achievements; they can read the same numbers as the app.
