# DB-NOTES (database agent, Supabase project scqqmnwzglbgnvgzqifu)

Owner rule: no live change (DDL, DELETE, UPDATE of real data) without Aleksi's explicit "OK <item>" relayed by the app agent. Backup first, change, then check numbers. No guest names or phones in this file.

## Tables (public) and what they hold (rows on 2026-11-13)
- profiles (12): one row per person (guide, driver, admin). id = login id.
- tours (1852): one row per tour day/slot. bookings (2165): guests booked on a tour. clients (14390): guest records.
  bookings has booked_at, moves, move_log (filled from emails: 695 of 2165 dated).
- client_ratings, tour_ratings: scores. time_off, holidays, tasks, change_requests, offers, expenses, pay_adjustments, pay_disputes, tour_costs: team admin.
- payout_details (1): bank details per person (id = profile id). Sensitive.
- notifications, push_subscriptions, usage, log, app_errors, settings, photos, thanks, invites, personal_dates, agent_runs, backup_config: app support.
- mail_stage (2528): TEMPORARY staging of email data. Can be dropped on OK.
- tours_dup_backup_20261112 (3): copy of 3 exact-duplicate tours, taken before the delete.
- Helper functions: app_role() (text) and is_admin() (boolean), both SECURITY DEFINER, exist.

## Review of update.sql section 3.69 (read-only, 2026-11-13) - NOT applied
Result: safe to apply, no clash. Details:
- profiles(id) is uuid primary key: the new foreign keys (entered_by, badge_likes.user_id) work.
- payout_details has columns id, bank_name, holder, account only. entered_by and confirmed_at are new, no clash.
- Live policies on payout_details: payout_admin (SELECT only, is_admin) and payout_own (ALL, own row). 3.69 drops payout_admin and recreates it as ALL for admins. Intended: admin may now insert/update/delete anyone's bank details. Replacement happens in one statement batch; run as ONE migration so there is no gap.
- badge_likes does not exist yet; create-if-not-exists is fine. Policies use (select ...) wrapping, good for speed. Any signed-in person with a role can read all likes; only the owner of a like can add or remove it.
- Notes: (a) payout_admin ALL + payout_own ALL on the same table will show up in the "multiple permissive policies" performance note (harmless on 1 row). (b) badge_likes has no update policy: likes are add/remove only (fine). (c) Bank account numbers are readable and writable by every admin; confirm that is wanted.

## Advisors (2026-11-13)
Security:
- Leaked password protection is OFF. Owner must switch it on in the Supabase dashboard (Authentication > password security). I cannot do it.
- 17 functions are callable by signed-in users and run with full rights (SECURITY DEFINER). Needed: app_role, is_admin, can_see_*, on_tour, my_*, guest_*, photo_like etc. (used in policies/app). Worth a check that each does its own admin/role test inside: admin_remove_person, erase_guests, merge_clients, purge_old_guests, stale_guests. Not changed.
- 3 tables have security switched on but no rules (backup_config, mail_stage, tours_dup_backup_20261112): that means nobody from the app can read them, which is what we want for backups. Info only.
Performance:
- 33 "multiple permissive policies" (admin rule + own rule on the same action) on bookings, change_requests, client_ratings, clients, expenses, holidays, pay_adjustments, pay_disputes, payout_details, personal_dates, profiles, settings, tasks, time_off, tour_ratings, tours. Small slowdown only; merging into one policy each is possible later, low priority.
- 15 never-used indexes (mostly on small tables). Leave for now; they are cheap and may be used later.
- mail_stage and tours_dup_backup_20261112 have no primary key (temporary tables, ignore).

## Duplicate tours (read-only check)
- tours = 1852. Backup table has 3 rows, 3 distinct ids, all 3 are STILL in tours. 0 bookings point at them, so removing them loses no guests.
- Every table that points at tours has an index on tour_id and tours has no triggers, so the delete should be quick; the earlier timeout is probably a lock or tool time limit. When OK is given: delete by id list in a single short statement, then check tours = 1849.

## Open items (waiting for owner OK, nothing done)
1. Apply 3.69 (one migration).
2. Delete the 3 exact-duplicate tours (backup exists).
3. 79 empty twin tours with a different guide: owner decides in the app's Duplicates page.
4. Drop mail_stage.
5. Server-side timed notice job.
6. Owner: turn on leaked password protection in the dashboard.

## Change log
- 2026-11-13: read-only review only. No changes made.

## Requests from the app agent
(none yet)
