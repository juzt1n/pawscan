# PawScan v4 — Beginner-Friendly Edition
## Start the app

git clone <https://github.com/juzt1n/pawscan> pawscan-v4
cd pawscan-v4
npm install
npx expo start

Scan the QR with Expo Go (same Wi-Fi). On Android, scan it inside the Expo Go
app; on iOS, scan it with the Camera app and tap the banner. The app loads on
your phone over Wi-Fi. If versions complain, run `npx expo install --fix`.

Demo logins:
- Any email registers a normal personal account.
- `admin@pawscan.demo` (any password) opens the admin business-review queue.
- Register with the Vet Clinic option to create a business account, then approve
  it as the admin to see the verified dashboard.

## Read the code in this order

1. `README.md` — you are here
2. `mock.js` — the fake AI and the "contract" (the agreed answer format)
3. `api.js` — the one door: fake AI today, real server later (the USE_MOCK flag)
4. `lib/storage.js` — everything the app remembers, plus quota and business logic
5. `App.js` — first-launch onboarding, login gate, and role-based routing
6. `screens/ScanScreen.js` — the main flow: photo, analyze, save, show
7. The other screens and `components/` — each one explains itself at the top

## The big ideas (worth understanding for the report and viva)

The mock seam. The app never talks to the real AI directly. Everything goes
through `api.js`, which today returns fake answers shaped exactly like the real
AI's answers will be. On integration day we flip `USE_MOCK` to false, point
`BACKEND_URL` at our Express server, and nothing else changes.

The storage seam. Screens never touch the phone's storage directly. They call
functions in `lib/storage.js`. When accounts move to the Express server and
MongoDB, we rewrite the internals of that one file and no screen changes.

Tiers and roles. The app routes users by account type and status. A personal
user gets the tabs; a business user sees a pending screen until an admin
approves them, then a clinic dashboard; the admin email goes straight to the
review queue. Free users get breed identification only — the health report is
locked behind Premium, with an upgrade prompt in its place.

Honest limits (say these proudly, don't hide them):

- Login is mocked. No server, no password checking yet.
- The AI is mocked. Four rotating scenarios, not real predictions.
- Payment is mocked. Upgrading to Premium flips a flag, no real billing.
- Business verification is a manual admin decision. The app shows the submitted
  UEN and AVS licence with links to the ACRA and NParks registers, but doesn't
  call those registers itself.
- Storage is unencrypted. Fine for bookmarks, but not for real tokens — those go
  in the phone's secure storage once real auth arrives.

## Use case coverage

| ID | Use case | File |
|----|----------|------|
| #01/#03 | Register / Login (mocked, with error flows 7a/7b) | screens/AuthScreen.js |
| #02/#29 | Business registration and admin approval | AuthScreen, PendingScreen, AdminScreen |
| #04 | Logout | screens/ProfileScreen.js |
| #05 | Forgot password | screens/ForgotPasswordScreen.js |
| #07/#08 | Scan via camera / gallery | screens/ScanScreen.js |
| #09 | View identification result (free tier) | components/ResultCard.js |
| #10 | Health report and condition articles (premium) | ResultCard, ConditionArticle |
| #13/#14 | Encyclopedia / bookmarks | screens/BreedsScreen.js |
| #11/#12 | View / delete scan history | screens/HistoryScreen.js |
| #15/#16/#18 | Daily quota (3/day) / ad bonus / premium unlimited | ScanScreen + lib/storage.js |
| #17 | Upgrade to premium (tiers screen, mocked payment) | screens/UpgradeScreen.js |
| #19–#21 | Health watchlist + non-dismissable disclaimer | ResultCard + components/shared.js |
| #23 | Dog profiles (premium) | screens/ProfileScreen.js |
| #24/#25 | Clinic listing management and referral stats | screens/BusinessDashboard.js |
| Onboarding | First-launch welcome flow | screens/OnboardingScreen.js |
| Premium export | CSV + PDF vet report | lib/storage.js + ProfileScreen |
| #22 | Vet locator | placeholder (later sprint) |

Not in this build: the moderator role and encyclopedia management (#28),
admin user management and analytics (#27, #30), real JWT auth, the real backend,
and live camera framing.

## Next steps (the plan)

1. Verify the draft breed_health.json entries against cited vet sources
2. Build the Express backend (its API is what `lib/storage.js` and `api.js` do,
   now over HTTP) with MongoDB Atlas
3. Teammate wraps the trained model in FastAPI
4. Integration day: flip `USE_MOCK`, set `BACKEND_URL`, test with real dogs