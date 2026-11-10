# Phone notifications: one-time setup (about 10 minutes, all in the Supabase website)

The app already asks each phone for permission and stores where to send. These three steps let the database send the notice.
You need the private file `push-secrets` that Claude sent you in the chat (it is not in this repository on purpose).

## 1. Add the sending function
Done on 10 Nov 2026: the function `push` is deployed (JWT verification off). Skip to step 2. To update it later, repeat these steps:
1. Supabase > **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Name: `push`.
3. Delete the sample code, paste all of `supabase/functions/push/index.ts` from this repository.
4. Open the function's settings and switch **off** "Enforce JWT verification" (the webhook below uses its own secret instead).
5. Press **Deploy**.

## 2. Add the four secrets
Supabase > **Edge Functions** > **Secrets** > add each name and value from the `push-secrets` file:
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `WEBHOOK_SECRET`. Save.
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already there by default.)

## 3. Send every new notice to the function
1. Supabase > **Database** > **Webhooks** (enable webhooks if it asks) > **Create a new hook**.
2. Name `push_on_notice`; table `notifications`; event **Insert**.
3. Type **Supabase Edge Functions**, function `push`, method POST.
4. HTTP Headers: add `x-webhook-secret` with the `WEBHOOK_SECRET` value from the file.
5. Create.

## 4. Test
In the app: **Me > Phone notifications > Turn on**, then **Send me a test**. The notice should arrive within seconds.
iPhone: first add the app to the Home Screen (Safari > Share > Add to Home Screen) and open it from there (iOS 16.4 or newer).

If nothing arrives: Supabase > Edge Functions > push > **Logs** shows the reason; "forbidden" means the header secret in step 3 does not match step 2.
