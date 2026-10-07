> **V37 PILOT:** Tài liệu này thuộc phiên bản cũ; xem `DEPLOY_TUNG_BUOC_VI.md` để triển khai bản v37. Không dùng quy tắc mục tiêu tuần / 5.000 VND / KM từ tài liệu cũ.

# Savills Run for Impact v35 — Netlify new-site setup

## Why the button failed
The prior ZIP contains **Netlify Functions**, not Firebase Cloud Functions, for Strava OAuth. Drag-and-drop/static-only deployment or missing Netlify environment variables can cause `Could not start connection`. Check the function health URL after deploying.

## Fastest path for a boss demo
1. Keep existing Firebase `run-for-impact` for the demo, using a separate test user. A new Firebase project is optional and adds significant setup work. If cloning, create a new project, enable Email/Password auth, Firestore, deploy Firestore rules, create a new service account, update `firebase-config.js` and create test members/admins. Never reuse the old service-account key with the new project.
2. On new Netlify site, deploy this *unpacked folder* using Git or Netlify CLI so `netlify/functions` is deployed and `firebase-admin` is installed. **Do not use a static drag-and-drop deploy** for OAuth.
3. Add Netlify environment variables: `STRAVA_CLIENT_ID=281726`, `STRAVA_CLIENT_SECRET` (from Strava settings, keep secret), `SITE_URL=https://savillsrunforimpact2026.netlify.app`, `FIREBASE_SERVICE_ACCOUNT_JSON` (service-account JSON for the Firebase project configured in firebase-config.js), `STRAVA_VERIFY_TOKEN` (random private string), `AUTO_SYNC_ENABLED=false`, `CAMPAIGN_START=2026-10-01T00:00:00+07:00`, `CAMPAIGN_END=2026-10-31T23:59:59+07:00`. Use Netlify Functions scope. Do not place secrets in code, screenshots or chat.
4. Trigger a new deploy. Visit `https://savillsrunforimpact2026.netlify.app/.netlify/functions/strava-health`. It should return JSON with `functionsDeployed:true`, `ready:true` and all `configured` flags true. This health check exposes only yes/no configuration, never secret values.
5. Strava Settings > Edit: Authorization Callback Domain = `savillsrunforimpact2026.netlify.app`. The callback URL used by the code is `https://savillsrunforimpact2026.netlify.app/.netlify/functions/strava-callback`.
6. In Firebase Authentication > Settings > Authorized domains, add the new Netlify domain. Publish the bundled Firestore rules after reviewing their effect on the existing project. Ensure the test account has an approved `members/{uid}` document; OAuth start rejects unapproved accounts.
7. Log in as an approved test member; accept consent; click Connect with Strava. Check Netlify > Logs > Functions > `strava-start` if it fails. Never send access/refresh tokens or service-account JSON.
8. The Club link is deliberately generic until you create an actual Savills Strava Club. Create the Club on Strava and replace `https://www.strava.com/clubs` in index.html with its actual club URL. Club membership is separate from OAuth and does not grant access to activities.

## Important approval boundary
Keep `AUTO_SYNC_ENABLED=false` until Strava confirms in writing whether this virtual charity competition, cross-user leaderboards, department rankings and cube map are allowed. The OAuth test itself does not authorize production use or 1,000 athletes. Submit screenshots of all data displays and the Connect with Strava button with the developer review request.

## Limitations
This package cannot be deployed by an assistant without your Netlify/Firebase account access and the private credentials. It has been prepared and syntax checked locally; a live OAuth handshake and webhook test require deployment and user action.
