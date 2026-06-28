# Orbit reminders & push notifications — setup

The app, badge, reminder settings and per-item reminders all work without this.
This is only needed to actually **deliver** push notifications. ~10 minutes.

> iOS note: Web Push only works for the **installed** PWA (Add to Home Screen),
> iOS 16.4+. Test on a real iPhone with Orbit installed, after tapping
> "Enable notifications" in Settings.

## 1. Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
You'll get a **Public Key** and a **Private Key**.

## 2. Add the public key to the app
In `js/config.js`, set:
```js
window.ORBIT_PUSH = { vapidPublic: "PASTE_PUBLIC_KEY" };
```
Commit & deploy (the private key never goes here).

## 3. Create tables + cron
In the Supabase dashboard → **SQL Editor**, open `supabase/reminders-setup.sql`,
replace `YOUR-PROJECT` and `YOUR-SERVICE-ROLE-KEY` (Project Settings → API →
service_role) in the cron section, and run it.

## 4. Set the function secrets
```bash
supabase secrets set VAPID_PUBLIC=...  VAPID_PRIVATE=...  VAPID_SUBJECT=mailto:you@example.com
```
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

## 5. Deploy the function
```bash
supabase functions deploy send-reminders
```

## 6. Try it
- Open the installed PWA, sign in (Settings → Cloud sync), then **Enable notifications**.
- Set a task with a deadline + a "1h before" reminder, or turn on the daily reminder
  for a minute from now.
- The cron runs every minute, reads your synced state, and pushes when something is due.

### How it works
`pg_cron` calls the `send-reminders` Edge Function every minute. It reads each
user's `orbit_state`, computes which reminders land on the current minute **in the
user's timezone**, dedupes via `reminders_sent`, and sends Web Push (VAPID) to the
rows in `push_subscriptions`. Dead subscriptions (404/410) are pruned automatically.
