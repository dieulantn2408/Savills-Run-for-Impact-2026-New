# Savills Run for Impact 2026 — New Site v47

This package is intentionally prepared as a separate web version. Deploy it to a NEW Netlify site, not over the old production site.

## Campaign
15 Oct 2026 — 16 Nov 2026

## Main experience
- Mobile-first Dashboard with Community Journey as the hero section.
- Public Activity Guide & Rules and FAQs.
- Proof submission by activity link OR screenshot; no Strava API connection required.
- Exact duplicate proof protection uses SHA-256 and a unique Firestore proofHashes document.
- Screenshot similarity hash is visible only to BTC/Admin as a possible-duplicate flag.
- Approved activity drives Community Journey, leaderboard and Collective Impact.
- PWA manifest/service worker + Add to Home Screen guidance on the login screen.

## New Netlify link
In Netlify: Add new project / Import an existing project -> choose the NEW repository or a new branch/repository containing this folder -> publish directory `.`. Do not connect this package to the old Netlify site if you want a separate URL.

## Required Firebase step
Deploy the included `firestore.rules` to the Firebase project before testing proof submission. The app reuses the existing `firebase-config.js`, member profiles, join requests, admins and cube/avatar data.

## Important QA
Before public launch, test: sign-up approval, login, link proof, screenshot proof, exact duplicate blocking, BTC approval/rejection, leaderboard week filters, Community Journey on real phones, and 1,000-participant rendering.
