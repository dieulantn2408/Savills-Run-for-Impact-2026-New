# v44 Master Website Update

Implemented from the supplied Master Website Update specification.

- Simplified participant Strava controls to Connect / Connected / Disconnect.
- Added confirmation modal and real server-side Strava OAuth revocation via `/oauth/revoke`.
- Deletes stored Strava tokens, athlete mapping and cached activity records on disconnect; preserves Savills account/profile data.
- Adds minimal disconnect audit record without tokens or raw activity data.
- Removed personal Character Progression map.
- Community Journey now uses 0/25/50/75/100 KM with deterministic UID-based offsets and up to 1,000 cube elements.
- Added responsive mobile horizontal map viewport.
- Added public `/support` Netlify rewrite and footer Support/Privacy/Contact links.
- Preserved Firebase project/configuration and existing production environment variable names.

Important: cross-user display of Strava-derived data must be reviewed against the current Strava API Policy before API compliance submission.
