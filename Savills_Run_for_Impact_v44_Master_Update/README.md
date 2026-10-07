> **V37 PILOT:** Tài liệu này thuộc phiên bản cũ; xem `DEPLOY_TUNG_BUOC_VI.md` để triển khai bản v37. Không dùng quy tắc mục tiêu tuần / 5.000 VND / KM từ tài liệu cũ.

# Savills Run for Impact 2026 — FREE Firebase + Netlify build

This build intentionally uses **Firebase Spark-compatible services only**:

- Firebase Authentication — Email/Password
- Cloud Firestore
- Netlify static hosting
- No Cloud Functions
- No Firebase Storage

Proof is submitted as a Strava URL only instead of uploading an image to Firebase Storage.

## 1) Publish the FREE Firestore Rules

Firebase Console → Firestore → Rules.
Replace the current rules with the content of `firestore.rules`, then click **Publish**.

These rules use `admins/{uid}` as the admin gate. Normal users cannot create or modify admin records from the website.

## 2) Deploy this folder to Netlify

Drag the entire unzipped folder into Netlify Drop.
The Firebase Web config for project `run-for-impact` is already filled into `firebase-config.js`.

## 3) Create the first Admin account

1. Open the Netlify website.
2. Choose **Create account** and create the account you will use as HR/Admin.
3. In Firebase Console → Authentication → Users, copy that account's **User UID**.
4. Firebase Console → Firestore → Data → **Start collection**.
5. Collection ID: `admins`
6. Document ID: paste the exact Admin UID.
7. Add fields (optional but recommended):
   - `name` (string): your name
   - `email` (string): your admin email
8. Save.
9. Return to the website and refresh or log out/in once.

The **HR Admin** tab will then appear only for that UID.

> Important: adding the `admins/{uid}` document through Firebase Console is privileged and bypasses client Security Rules. Website users cannot create this record themselves.

## 4) Employee flow

First time:

Create account → Employee verification form → Pending → HR manually approves → Dashboard unlocks.

Returning on the same browser/device:

Firebase uses local auth persistence → opens directly to the user's state/dashboard.

Different device/browser:

User logs into the same Firebase account → same UID → same Firestore data → no employee verification or HR approval again.

## 5) HR access approval

HR Admin → Employee access requests → Approve.

Approval performs a Firestore batch:
- creates `members/{uid}`
- marks `joinRequests/{uid}` as `approved`

The `members/{uid}` document is the permanent campaign membership gate.

## 6) Run proof review

Employees submit:
- KM
- run date
- proof URL
- optional note

HR Admin approves/rejects manually.

On approval:
- submission becomes approved
- member's `totalApprovedKm` increases
- weekly challenge is updated
- leaderboard / department ranking / donation heart update from realtime Firestore listeners
- cube moves along the road based on approved KM

## 7) Important limitation of the FREE build

Because this version intentionally avoids Cloud Functions and Firebase Storage:

- proof files are links, not direct file uploads;
- aggregate campaign totals are calculated live from `members` rather than maintained by a server function;
- admin privileges are controlled by an immutable `admins/{uid}` Firestore document created manually in Firebase Console.

For this manual internal campaign workflow, Security Rules still prevent a normal employee from approving themselves or modifying admin/member data.


## v2 login fix
Admin login now checks `/admins/{uid}` first and routes immediately after successful Firebase Authentication. This removes the prior login-screen stall caused by unnecessary Firestore reads during admin login.


## v3 changes
- Journey now begins at the supplied road's true START = 0 KM and ends at the supplied road's true END = 30 KM.
- 5 / 10 / 15 / 20 / 25 KM checkpoints are positioned along the actual road centreline.
- Create Account includes Full name, Department, Office, and Employee ID / Mã số nhân viên.
- Create Account also creates `joinRequests/{uid}` with `status: pending`.
- Successful signup immediately shows the waiting-for-HR-approval screen.
- Explicit signup/login no longer races the persistent Firebase auth listener.


## v4 changes
- Moved the journey map to the top of the employee dashboard, directly beside the donation heart.
- Fixed HR/Admin live queues: `joinRequests` and `submissions` are now listened to in real time.
- A newly created employee request with `status: pending` appears automatically under Employee access requests.
- Approval also carries employee ID and email into the approved member profile.


## v5 changes
- HR/Admin dashboard now clearly separates:
  1. Account approval
  2. KM/proof verification
- Pending run submissions do not change any employee or campaign metrics.
- Only HR-approved KM increments `members/{uid}.totalApprovedKm`, which drives cube position, rank, leaderboard and donation.
- Enlarged the Savills cube character significantly for better visibility.


## v6 fixes
- Account approval now uses the Firestore join request document ID as the canonical employee UID.
- Approve account performs an atomic batch:
  - creates `/members/{uid}`
  - changes `/joinRequests/{uid}.status` from `pending` to `approved`
- Because the admin queue filters only `pending`, approved requests disappear automatically in real time.
- Waiting employees listen to both their join request and their member profile; once Admin approves, the open page unlocks automatically.
- Approved employees can log in later/on another device and enter the employee dashboard from `/members/{uid}`.
- Admin approval failures are now shown directly on the request card instead of failing silently.


## v7 regression fix
- Restored **Admin-first routing**. Admin login checks `/admins/{uid}` before any employee/member reads.
- Create Account / Log in tabs are now explicit `type="button"` controls with `addEventListener`, preventing form/navigation interference.
- Authentication state routing was simplified so a returning signed-in user is always routed correctly after reload.
- Added clearer transition text: `Opening campaign…`.


## v32 changes
- Donation conversion updated to 1 KM = 5,000 VND.
- Organization 50,000,000 VND target now corresponds to 10,000 approved KM.
- Removed internal Community Journey implementation note from participant-facing UI.


## v33 updates
- 1 KM = 5,000 VND.
- Community Journey internal explanatory copy removed.
- How it works moved to the top of the participant dashboard.
- Department/property selection replaced with the supplied searchable list.
- Location is HCMC or Hanoi and is shown on the leaderboard.
- Proof submission accepts Strava URLs only.
