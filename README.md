# PawScan

PawScan identifies a dog's breed from a photo and shows the health issues that
breed is prone to. This repository holds all three parts of the system:

| Folder | What it is | Runs on |
|---|---|---|
| `/` (root) | The mobile app (React Native, Expo SDK 57) | Phones, through Expo Go |
| `backend/` | The API (Node.js, Express, MongoDB Atlas): login, scan quota, history, clinics, admin | Render |
| `model-service/` | The AI model service (Python, FastAPI, TensorFlow) | Google Cloud Run |

```
phone app  ->  backend (login, quota, history, clinics, admin)  ->  model service (ConvNeXt-Tiny)
                  |
               MongoDB Atlas
```

## 1. Start the app

```
git clone https://github.com/juzt1n/pawscan
cd pawscan
npm install
npx expo start
```

Scan the QR code with Expo Go on the same Wi-Fi. On Android, scan it inside the
Expo Go app; on iPhone, scan it with the Camera app and tap the banner. If Expo Go
complains about versions, run `npx expo install expo@latest --fix`, then `npx expo start -c`.

### Real mode or offline demo mode

Both settings are in `lib/config.js`:

- `USE_MOCK = true` (default for now): no server needed. A fake AI rotates through
  four test results and all data stays on the phone. Useful for UI work or a demo
  with no internet.
- `USE_MOCK = false`: the app talks to the backend. First set `BACKEND_URL` to
  the Render address, or to your laptop's Wi-Fi address (for example
  `http://192.168.1.23:3001`) when the backend runs locally. Never use `localhost`:
  on the phone that means the phone itself.

The screens never need to change between the two modes. `api.js` (scans) and
`lib/storage.js` (everything else) pick the right version at call time.

## 2. Run the backend

See `backend/README.md` for the full guide. In short:

```
cd backend
npm install
cp .env.example .env      # then fill in MongoDB, JWT secret, model URL and key, admin login
npm run seed              # breeds, conditions, demo clinics and the admin account
npm start                 # check http://localhost:3001/health
```

`npm run seed` reads the breed and condition data from the app's `data/` folder,
so there is only one copy of it.

## 3. Run the model service

See `model-service/README.md`. The trained model file `pawscan_dog_model.keras`
(107 MB) is **not** in this repository, because GitHub refuses files over 100 MB.
Download it from the team's Google Drive (or the Colab notebook) and put it in
`model-service/` before running or deploying.

## Accounts

- **Owners and clinics** register in the app. Passwords must be 8 to 72 characters.
- **Admin**: created by `npm run seed` from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in
  `backend/.env`. There is no hard-coded admin any more.
- In offline demo mode (`USE_MOCK = true`), any email and password work, and
  `admin@pawscan.demo` opens the admin console.

## Read the code in this order

1. `README.md`: you are here
2. `lib/config.js`: the two settings
3. `mock.js`: the fake AI and the response "contract"
4. `api.js`: scans go through here (mock or real)
5. `lib/storage.js`: picks `storageLocal.js` (phone only) or `storageRemote.js` (backend)
6. `lib/http.js`: every backend request, with the login token from secure storage
7. `App.js`: onboarding, login gate and routing by account type
8. `screens/ScanScreen.js`: photo, analyse, save, show
9. `backend/server.js` and `backend/src/routes/`: one file per area of the API

## Security measures

bcrypt password hashing, JWT login stored in the phone's secure storage, lockout
after 5 failed logins, server-side scan quota and rate limit, server-side image
checks (real file bytes, 5 MB cap), model service protected by a private key,
scan images deleted with the record, account deletion removes all the user's data,
append-only audit log, helmet security headers, secrets kept in `.env` (never committed).

## Honest limits (state these in the report)

- One 7-day JWT instead of short-lived access tokens with refresh-token rotation.
- Password-reset emails are not sent yet (no email service connected). The reset
  endpoints work, and in development the reset token is printed in the backend log.
- Upgrading to Premium has no real payment, and the rewarded-ad bonus is trusted from the app.
- UEN and AVS licence checks are a manual admin decision against the ACRA and NParks registers.
- Clinics registered through the app have no map coordinates yet, so they are
  listed after the nearby demo clinics rather than by distance.
- Free hosting sleeps when idle: open `/health` on the backend and send one scan a
  few minutes before a demo to wake both services.

## Use case coverage

| ID | Use case | Where |
|----|----------|-------|
| #01/#03/#04 | Register, login, logout | AuthScreen, ProfileScreen; backend `routes/auth.js` |
| #02/#29 | Business registration and admin approval | AuthScreen, PendingScreen, admin/AdminBusinessReview; backend `routes/clinics.js` |
| #05 | Forgot password | ForgotPasswordScreen; backend `/auth/forgot`, `/auth/reset` |
| #06 | Update profile | ProfileScreen; backend `PATCH /me` |
| #07/#08 | Scan via camera or gallery, with photo tips | ScanScreen; backend `/analyze`; model-service `/predict` |
| #09/#10 | Result, breed profile | components/ResultCard.js |
| #11/#12 | View and delete scan history | HistoryScreen; backend `/scans` |
| #13/#14 | Encyclopedia and bookmarks | BreedsScreen; backend `/bookmarks` |
| #15/#16/#18 | Daily quota (3/day), ad bonus, Premium unlimited | ScanScreen; backend `/quota` |
| #17 | Upgrade to Premium (payment simulated) | UpgradeScreen; backend `/me/upgrade` |
| #19–#21 | Health watchlist (Premium), disclaimer, condition articles | ResultCard, ConditionArticle |
| #22 | Vet locator with directions and call | VetLocatorScreen; backend `/clinics/nearby` |
| #23 | Dog profiles (Premium) | ProfileScreen; backend `/dogs` |
| #24/#25 | Clinic listing and referral statistics | BusinessDashboard; backend `/businesses/me`, `/businesses/me/stats` |
| #26 | Admin breed encyclopedia editing | admin/AdminEncyclopedia; backend `routes/breeds.js` |
| #27/#28 | Admin user management | admin/AdminUsers; backend `/admin/users` |
| #30 | Analytics and audit log | admin/AdminAnalytics; backend `/admin/analytics`, `/admin/audit` |
