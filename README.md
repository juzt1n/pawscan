# PawScan v4

## Start the app

git clone https://github.com/juzt1n/pawscan pawscan-v4
cd pawscan-v4
npm install
npx expo start

Scan the QR with Expo Go on the same Wi-Fi. On Android, scan it inside the Expo
Go app; on iOS, scan it with the Camera app and tap the banner. The app loads on
your phone over Wi-Fi. If versions complain, run `npx expo install --fix`.

## Demo accounts

Registering:
- Personal account: any email, any password.
- Business account: pick the Vet Clinic option. UEN is 9–10 letters and digits;
  AVS licence looks like AVS-XXXX-XXX.

Logging in:
- Any email logs you into a personal account (auth is mocked — see the honest
  limits below).
- `admin@pawscan.demo` with any password opens the admin console.
- To see the business side end to end: register a Vet Clinic, log out, log in as
  the admin, approve it, then log back in as the clinic to see the verified
  dashboard.

## Read the code in this order

1. `README.md` — you are here
2. `mock.js` — the fake AI and the "contract" (the agreed answer format)
3. `api.js` — the one door: fake AI today, real server later (the USE_MOCK flag)
4. `lib/storage.js` — everything the app remembers, plus quota, business, and admin logic
5. `App.js` — first-launch onboarding, login gate, and role-based routing
6. `screens/ScanScreen.js` — the main flow: photo, analyze, save, show
7. The other screens and `components/` — each one explains itself at the top

## How it fits together

The mock seam. The app never talks to the real AI directly. Everything goes
through `api.js`, which today returns fake answers shaped exactly like the real
AI's will be. On integration day we flip `USE_MOCK` to false, point
`BACKEND_URL` at our Express server, and nothing else changes.

The storage seam. Screens never touch the phone's storage directly. They go
through `lib/storage.js`. When accounts move to Express and MongoDB, we rewrite
the insides of that one file and no screen changes.

Tiers and roles. The app routes people by account type and status. A personal
user gets the tabs. A business user sees a pending screen until an admin
approves them, then a clinic dashboard. The admin email goes straight to the
admin console. Free users get breed identification only — the health report is
locked behind Premium, with an upgrade prompt in its place.

## Honest limits

- Login is mocked. There's no server yet, so nothing checks the password. Any
  email gets you in. Real auth is a backend job (JWT + bcrypt) and comes with
  integration.
- The AI is mocked. Results rotate through a few test scenarios rather than real
  predictions.
- Payment is mocked. Upgrading to Premium just flips a flag — no real billing.
- Business verification is a manual admin decision. The app shows the submitted
  UEN and AVS licence with links to the ACRA and NParks registers, but doesn't
  call those registers itself.
- The admin user list, analytics, and the vet clinics are demo data. The
  workflows are real (suspend a user, approve a clinic, and it sticks), but the
  underlying records are seeded, not a real database.
- Storage is unencrypted. Fine for bookmarks, not for real tokens — those move to
  the phone's secure storage once real auth arrives.

## Use case coverage

| ID | Use case | File |
|----|----------|------|
| #01/#03 | Register / Login (mocked, with error flows 7a/7b) | screens/AuthScreen.js |
| #02/#29 | Business registration and admin approval | AuthScreen, PendingScreen, AdminScreen |
| #04 | Logout | screens/ProfileScreen.js |
| #05 | Forgot password | screens/ForgotPasswordScreen.js |
| #07/#08 | Scan via camera / gallery, with photo tips | screens/ScanScreen.js |
| #09 | View identification result (free tier) | components/ResultCard.js |
| #10 | Health report + condition articles (premium), high-risk highlighted | ResultCard, ConditionArticle |
| #13/#14 | Encyclopedia / bookmarks | screens/BreedsScreen.js |
| #11/#12 | View / delete scan history | screens/HistoryScreen.js |
| #15/#16/#18 | Daily quota (3/day) / ad bonus / premium unlimited | ScanScreen + lib/storage.js |
| #17 | Upgrade to premium (tiers screen, mocked payment) | screens/UpgradeScreen.js |
| #19–#21 | Health watchlist + non-dismissable disclaimer | ResultCard + components/shared.js |
| #22 | Vet locator (verified clinics, directions, call) | screens/VetLocatorScreen.js |
| #23 | Dog profiles (premium) | screens/ProfileScreen.js |
| #24/#25 | Clinic listing management and referral stats | screens/BusinessDashboard.js |
| #27 | Admin user management (search, suspend, reinstate) | screens/admin/AdminUsers.js |
| #30 | Admin analytics + audit log | screens/admin/AdminAnalytics.js |
| Onboarding | First-launch welcome flow | screens/OnboardingScreen.js |
| Premium export | CSV + PDF vet report | lib/storage.js + ProfileScreen |

Not in this build yet: the moderator role and encyclopedia management (#28),
real JWT auth, the real backend, and the live camera framing overlay (photo
tips are in; the live overlay is scoped for the camera sprint).

## Next steps

1. Verify the draft breed_health.json entries against cited vet sources
2. Build the Express backend (its API is what `lib/storage.js` and `api.js` do,
   now over HTTP) with MongoDB Atlas
3. Wrap the trained ConvNeXt model in FastAPI
4. Integration day: flip `USE_MOCK`, set