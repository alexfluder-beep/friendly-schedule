# agent-api

Read-only HTTPS door to Friendly Schedule for Claude's scheduled checks
(friendly-schedule-check, friendly-daily-ops). The Supabase connector stays as the fallback.

- URL: `https://scqqmnwzglbgnvgzqifu.supabase.co/functions/v1/agent-api`
- Every call needs the header `x-agent-key: <KEY>`. The key lives only in the Edge Function
  secret `AGENT_API_KEY` and in the agents' private setup. Never in the app, this repo, a page,
  a chat or a doc.
- Deployed with `verify_jwt = false` (the key replaces the login check). No CORS: browsers can't call it.
- Answers: `{"ok":true,"data":[...]}` or `{"ok":false,"error":"code"}`.
  401 `unauthorized`, 400 `bad_input`, 404 `not_found`, 429 `rate_limited` (over 60 calls a minute),
  500 `db_error` / `not_configured` (secret missing or shorter than 32 characters).
- No phone or e-mail ever leaves it (fields dropped, and anything that looks like one in free text is masked).
- Logs hold only route, status and milliseconds.
- The only writes are `/notify` and `/run-done`. No route takes SQL, a table name or a column name.

## Routes

```sh
A=https://scqqmnwzglbgnvgzqifu.supabase.co/functions/v1/agent-api

# Is it up? (200 with the key, 401 without)
curl -s "$A/health" -H "x-agent-key: <KEY>"

# Tours, crews, seats: same as  select * from agent_board(0,1)   (from/to = days from today, 0..14)
curl -s "$A/board" -H "x-agent-key: <KEY>" -H "Content-Type: application/json" -d '{"from":0,"to":1}'

# Are these booking codes in the app? (1-50 codes, 4-40 characters each)
curl -s "$A/refs" -H "x-agent-key: <KEY>" -H "Content-Type: application/json" -d '{"codes":["ABC12345","BR-1234567"]}'

# What changed since a time (leave "since" out = last run minus 10 minutes, or 6 hours ago)
curl -s "$A/changes" -H "x-agent-key: <KEY>" -H "Content-Type: application/json" -d '{"since":"2026-11-18T06:00:00Z"}'

# Double bookings and missing crews in the next N days (1..30, default 7)
curl -s "$A/conflicts" -H "x-agent-key: <KEY>" -H "Content-Type: application/json" -d '{"days":7}'

# Guests on one tour: name, pax, marks, source, language, pickup (max 40, never phone or e-mail)
curl -s "$A/guests" -H "x-agent-key: <KEY>" -H "Content-Type: application/json" -d '{"date":"2026-11-19","title":"Old Tbilisi"}'

# One "Assistant" notice for the office (1-500 characters)
curl -s "$A/notify" -H "x-agent-key: <KEY>" -H "Content-Type: application/json" -d '{"text":"Booking ABC12345 is not in the app yet."}'

# Mark a scheduled run as done (run: early | 10:15 | 14:00 | evening; summary up to 1000 characters)
curl -s "$A/run-done" -H "x-agent-key: <KEY>" -H "Content-Type: application/json" -d '{"run":"evening","summary":"All bookings match."}'
```

## Tests

`deno test handler_test.ts` (15 tests, invented data only). Checked live on 18 Nov 2026 with a
throw-away key that was removed afterwards: every route answered as the brief asks, `/board`,
`/changes` and `/conflicts` matched their SQL calls exactly, `/guests` had no contact details,
and the test notice and test run row were deleted again.
