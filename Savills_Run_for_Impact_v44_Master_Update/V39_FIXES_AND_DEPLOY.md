# v39 UI fixes and deployment checklist

This build fixes green branding, removes guide illustration images, hides account-registration panels when authenticated, removes oversized page background, normalizes the two leaderboard layouts, and defaults both independent week-tab sets to Total. The original v33 map assets and movement logic are retained.

**Important:** Strava OAuth is not fixed by a CSS/UI change. The screenshot explicitly reports missing `FIREBASE_SERVICE_ACCOUNT_JSON` in the new Netlify site. Configure secrets in the NEW Netlify project before testing. Never commit credentials to GitHub.

Netlify > savills-run-impact-v38-test > Environment variables: configure FIREBASE_SERVICE_ACCOUNT_JSON, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_VERIFY_TOKEN, SITE_URL=https://savills-run-impact-v38-test.netlify.app. Leave AUTO_SYNC_ENABLED=false until webhook is verified. Confirm the correct Strava authorization callback domain and webhook subscription. Redeploy after setting variables. Test /netlify/functions/strava-health (actual path: /.netlify/functions/strava-health) and then a genuine OAuth connect and Run/Walk. Do not claim automatic KM works until end-to-end test.

Upload extracted ZIP contents to the currently deployed GitHub branch dieulant2408-patch-1, not the main branch. Commit, then confirm Netlify published the new commit. Hard refresh browser.
