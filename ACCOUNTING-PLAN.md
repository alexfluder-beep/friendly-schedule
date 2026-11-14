# Accounting inside the app (draft, nothing created in the database yet)

Admin only. Reuses what exists: bookings already hold price, payment, amount_due, currency and source (platform);
tours hold guide_pay and driver_pay; pay_adjustments hold bonuses/cuts per month.

## New tables (need owner approval)
1. commission_rules: id, platform, tour_key (empty = every tour of that platform), percent, valid_from, note.
   A rule with a tour_key beats the platform rule. The newest valid_from before the tour date wins.
2. payments (money coming in): id, booking_id, tour_id, kind (tour / addon / tip / refund), amount, currency, gel_rate, gel_amount,
   method (cash / card / online / platform payout), bank, tx_code (transaction code), received_by (guide or office), paid_at, note, created_by, created_at.
3. staff_payments (money paid out): id, user_id, amount, currency, gel_rate, gel_amount, method (cash / card / bank), bank, tx_code,
   paid_at, for_month, note, created_by, created_at.
No file storage: the proof is the bank name and the transaction code typed in. Every amount also keeps its GEL value (rate entered or filled in at save time).

Both payment tables and commission_rules: row security so only admins read or write (same admin check the app already uses). Backup copy before any change.

## Screens (computed in the app, no extra tables)
- Tour money: guests x price, minus platform commission, minus guide and driver pay, minus expenses = profit; cash vs online.
- Missing payments: past tours where price is set but payments are less than due, or payment is "unpaid".
- Staff balance: earned (tour pay + adjustments) minus staff_payments, per month and currency.
- Commission rules editor (platform and per-tour).
