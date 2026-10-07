> **V37 PILOT:** Tài liệu này thuộc phiên bản cũ; xem `DEPLOY_TUNG_BUOC_VI.md` để triển khai bản v37. Không dùng quy tắc mục tiêu tuần / 5.000 VND / KM từ tài liệu cũ.

# Savills Run for Impact — Strava integration setup

This ZIP includes the existing v33 UI and a real Strava OAuth integration with Netlify Functions, Firebase Admin, a webhook inbox and a scheduled sync worker. It is **not plug-and-play**: obtain Strava approval and configure the backend before inviting employees.

## IMPORTANT: Strava approval and data use
Strava explicitly reserves the right to revoke API access for virtual races/competitions and limits how athlete data may be shown to other people. Submit the actual Savills leaderboard, department ranking, cube map and donation screens for written Strava review before enabling automatic sync or inviting 1,000 athletes. Default `AUTO_SYNC_ENABLED=false`. Do not treat a Club membership as OAuth permission.

## 1. Strava application
Create an app at https://www.strava.com/settings/api (Strava subscription may be required). Set Authorization Callback Domain to your Netlify site's domain, without https://. Request approval to increase athlete capacity from 10 to 1,000 and rate limits adequate for your expected activity volume. Default rate limits are NOT enough for a burst of 1,000 users with 2 runs/day. A single webhook subscription covers connected athletes. Create a Savills Strava Club separately and replace the generic Club link in index.html with its actual URL.

## 2. Netlify environment variables (Site configuration → Environment variables)
- `STRAVA_CLIENT_ID`: from Strava dashboard
- `STRAVA_CLIENT_SECRET`: keep secret, NEVER in firebase-config.js or frontend
- `STRAVA_VERIFY_TOKEN`: long random secret for webhook setup
- `SITE_URL`: https://your-site.netlify.app (exact production URL)
- `FIREBASE_SERVICE_ACCOUNT_JSON`: entire service-account JSON from Firebase Project settings → Service accounts; store only in Netlify environment, never ZIP, never Git.
- `CAMPAIGN_START`: ISO 8601 with +07:00 offset, e.g. 2026-10-01T00:00:00+07:00
- `CAMPAIGN_END`: ISO 8601 with +07:00 offset, e.g. 2026-10-31T23:59:59+07:00
- `AUTO_SYNC_ENABLED`: false until written API/data-use approval and testing; then true

Netlify must build/install package.json dependencies and deploy functions; a bare drag-and-drop of ZIP to Netlify Drop may NOT build npm dependencies or deploy functions. Use a connected Git repository or Netlify CLI (`npm install && netlify deploy --build --prod`) with your configured site. Firebase Blaze is required for expected production use.

## 3. Firestore Rules
Publish the included `firestore.rules` in Firebase Console. This adds `stravaConnections/{uid}` read-only status for its owner. All OAuth tokens, event queues, athlete mapping and activities are server-only, blocked from client reads and writes. Firebase Admin uses its own privileged credentials. Existing members, admin, goals, and manual submissions rules are retained.

## 4. Webhook
After Netlify functions are deployed, create the Strava subscription by POSTing form data to https://www.strava.com/api/v3/push_subscriptions with `client_id`, `client_secret`, `callback_url=https://your-site.netlify.app/.netlify/functions/strava-webhook`, `verify_token`. Strava verifies the callback via GET challenge. The webhook queues events; scheduled worker checks at most five every five minutes. This rate-limited starter implementation is not sufficient for 2,000 activities/day without an approved Strava rate-limit increase and capacity testing.

## 5. User flow
HR approves Firebase signup as before. Participant selects weekly goal, consents, connects Strava once, and separately joins the Club. OAuth tokens are exchanged/stored only on the server. A new GPS Run within campaign dates and an active seven-day goal can be automatically credited up to 30 KM/week, max two runs per running day, if AUTO_SYNC_ENABLED=true. Each Strava activity ID is credited at most once. The 1 KM = 5,000 VND impact calculation and existing personal/community visuals are preserved.

## 6. Important limitations before production
- Edited/deleted activities are flagged for HR reconciliation, not automatically reversed. Review `stravaEvents` documents with status `review` and adjust data carefully. Build an admin review UI before launch.
- The existing manual Strava-link submission remains as a fallback and still requires HR approval. If enabled alongside automatic sync, HR must check the Strava activity ID against `stravaActivities` to prevent double credit across the two pathways. Prefer disabling manual submission after API approval.
- Club participation is separate from OAuth and cannot be auto-verified by this integration.
- New accounts do not automatically import historical runs. Activity syncing starts when the webhook receives new activities after connection.
- The app displays existing cross-user leaderboards and Community Journey from v33. Do not publish Strava-derived athlete data there until Strava authorizes this specific use.
- Use a staging Netlify site and a handful of test accounts first. Verify webhook delivery, token refresh, connection/disconnection, duplicates, two-runs/day, 7-day expiry, timezone, and load before inviting all employees.
