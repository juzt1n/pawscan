# PawScan

PawScan is our final year project (FYP-26-S3-04). You take a photo of a dog, the
app tells you its breed, and it shows the health problems that breed tends to have.

Everything lives in this one repository, in three parts:

| Folder | What it is | Where it runs |
|---|---|---|
| `/` (root) | The mobile app, built with React Native and Expo SDK 57 | Phones, through Expo Go |
| `backend/` | The API: Node.js, Express and MongoDB Atlas. It handles logins, the daily scan limit, scan history, clinics, payments and the admin tools. | Render |
| `model-service/` | The AI model (ConvNeXt-Tiny) behind a small Python FastAPI service | Google Cloud Run |

```
phone app  ->  backend  ->  model service (ConvNeXt-Tiny)
                  |
            MongoDB Atlas
```

The app never talks to the model directly. It sends the photo to the backend, the
backend checks the user and their scan limit, asks the model, adds the breed's
health information and sends back the finished result.

## 1. Running the app

You need Node.js 20 or later, and Expo Go on your phone.

```
git clone https://github.com/juzt1n/pawscan
cd pawscan
npm install
npx expo start
```

Your phone and laptop must be on the same Wi-Fi. On Android, open Expo Go and scan
the QR code from inside it. On iPhone, scan it with the Camera app and tap the
banner. If Expo Go complains about the SDK version, run
`npx expo install expo@latest --fix` and then `npx expo start -c`.

If the QR code won't load (school Wi-Fi often blocks it), use
`npx expo start -c --tunnel` instead.

### Live mode and offline demo mode

There are two settings in `lib/config.js`:

- `USE_MOCK = false` is the normal setting. The app uses the live backend at
  `BACKEND_URL`, which is `https://pawscan-pred.onrender.com`.
- `USE_MOCK = true` needs no server at all. A fake AI cycles through four test
  results and everything is saved on the phone. It's handy for working on screens,
  or for a demo with no internet.

If you run the backend on your own laptop, set `BACKEND_URL` to your laptop's Wi-Fi
address, for example `http://192.168.1.23:3001`. Don't use `localhost`, because on
the phone that means the phone itself. Please change it back before you commit, or
everyone else's app will try to reach your laptop.

The screens don't change between the two modes. `api.js` (scans) and
`lib/storage.js` (everything else) decide which version to call each time.

## 2. Running the backend

`backend/README.md` has the full guide. The short version:

```
cd backend
npm install
cp .env.example .env      # then fill it in, see below
npm run seed              # loads breeds, conditions, demo clinics and the admin account
npm start                 # then open http://localhost:3001/health
```

What goes in `backend/.env`:

| Setting | What it is |
|---|---|
| `MONGODB_URI`, `DB_NAME` | Your MongoDB Atlas connection string and database name |
| `JWT_SECRET` | At least 32 random characters, used to sign logins |
| `MODEL_URL` | The model service's Cloud Run address, with no slash at the end |
| `HF_TOKEN` | The model service's private key, the same value as its `MODEL_API_KEY`. The name is left over from when we planned to use Hugging Face. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used once by `npm run seed` to create the admin account |
| `STRIPE_SECRET_KEY` | A Stripe test-mode secret key (`sk_test_...`) |
| `PREMIUM_PRICE_CENTS`, `PREMIUM_CURRENCY` | The Premium price, `490` and `sgd` |
| `PUBLIC_BASE_URL` | Where Stripe sends people back after paying. On Render this is the Render address. |

On Render, the same settings go in the service's **Environment** tab, and the
**Root Directory** is `backend`. The backend won't start without
`STRIPE_SECRET_KEY`, so set it before deploying.

`npm run seed` reads the breed and condition data from the app's `data/` folder, so
there's only one copy of it. If MongoDB gives a `querySrv ECONNREFUSED` error on
your laptop, the backend retries with public DNS by itself.

Never commit `.env`. It's in `.gitignore`.

## 3. Running the model service

See `model-service/README.md`. The trained model, `pawscan_dog_model.keras`, is not in
this repository because it's 107 MB and GitHub won't take files over 100 MB. Get it
from the team's Google Drive (or the Colab notebook) and put it in `model-service/`
before you run or deploy it.

We host it on Google Cloud Run, which needs a billing account even though a project
this size stays in the free tier.

## Accounts

- Dog owners and vet clinics sign up in the app. Passwords must be 8 to 72
  characters.
- The admin account is created by `npm run seed`, using `ADMIN_EMAIL` and
  `ADMIN_PASSWORD` from `backend/.env`. If the admin already exists, run
  `node reset-admin.mjs` in `backend/` to set its password to the one in `.env`.
- In offline demo mode, any email and password will log you in, and
  `admin@pawscan.demo` opens the admin console.
- To test Premium payments, use Stripe's test card `4242 4242 4242 4242` with any
  future expiry date and any CVC.

## Where to start reading the code

1. `lib/config.js`: the two settings
2. `mock.js`: the fake AI, and the shape every scan result follows
3. `api.js`: every scan goes through here
4. `lib/storage.js`: picks `storageLocal.js` (phone only) or `storageRemote.js` (backend)
5. `lib/http.js`: sends every backend request, with the login token from secure storage
6. `App.js`: the welcome tour, login and which screens each account type sees
7. `screens/ScanScreen.js`: picking a photo, analysing it, saving and showing the result
8. `lib/location.js` and `screens/VetLocatorScreen.js`: finding nearby vets
9. `backend/server.js` and `backend/src/routes/`: one file for each part of the API

## Security

- Passwords are hashed with bcrypt, and the login token is kept in the phone's
  secure storage.
- An account locks after 5 wrong passwords in a row.
- The server enforces the daily scan limit and limits how fast anyone can scan.
- Uploaded images are checked by their actual file contents and capped at 5 MB.
- The model service only answers requests that carry its private key.
- Deleting a scan deletes its photo, and deleting an account removes all of that
  user's data.
- Admin actions go into an audit log that can't be edited.
- Helmet sets the security headers, and secrets stay in `.env`.
- Location is only used while the vet locator is open, and is never saved.

## Known limits

We'd rather list these ourselves than have them found:

- Logins use one token that lasts 7 days. A production app would use short-lived
  tokens with refresh-token rotation.
- Password reset emails aren't sent, because no email service is connected. The
  reset endpoints work, and in development the reset token is printed in the
  backend log.
- Premium is paid through Stripe Checkout in test mode, as a one-off payment
  rather than a real monthly subscription. The rewarded-ad bonus scan is trusted
  from the app.
- Checking a clinic's UEN and AVS licence is a manual decision by an admin, using
  the ACRA and NParks registers.
- Clinic addresses are turned into map positions with OneMap, so a clinic with a
  wrong or made-up postal code may show without a distance.
- Distances are in a straight line, not by road.
- The free hosting goes to sleep when nobody is using it. A few minutes before a
  demo, open the backend's `/health` page and do one scan to wake everything up.

## Use cases and where they're built

| ID | Use case | Where |
|----|----------|-------|
| #01/#03/#04 | Register, log in, log out | AuthScreen, ProfileScreen; backend `routes/auth.js` |
| #02/#29 | Clinic registration and admin approval | AuthScreen, PendingScreen, admin/AdminBusinessReview; backend `routes/clinics.js` |
| #05 | Forgot password | ForgotPasswordScreen; backend `/auth/forgot`, `/auth/reset` |
| #06 | Update profile | ProfileScreen; backend `PATCH /me` |
| #07/#08 | Scan with the camera or gallery, with photo tips | ScanScreen; backend `/analyze`; model-service `/predict` |
| #09/#10 | Result and breed profile | components/ResultCard.js |
| #11/#12 | View and delete scan history | HistoryScreen; backend `/scans` |
| #13/#14 | Breed encyclopedia and bookmarks | BreedsScreen; backend `/bookmarks` |
| #15/#16/#18 | 3 scans a day, ad bonus, unlimited on Premium | ScanScreen; backend `/quota` |
| #17 | Upgrade to Premium (Stripe test mode) | UpgradeScreen, CheckoutScreen; backend `routes/stripe.js` |
| #19–#21 | Health watchlist (Premium), disclaimer, condition articles | ResultCard, ConditionArticle |
| #22 | Nearby vets sorted by distance, with directions and call | VetLocatorScreen, lib/location.js; backend `/clinics/nearby` |
| #23 | Dog profiles (Premium) | ProfileScreen; backend `/dogs` |
| #24/#25 | Clinic listing and referral statistics | BusinessDashboard; backend `/businesses/me`, `/businesses/me/stats` |
| #26 | Editing the breed encyclopedia (admin) | admin/AdminEncyclopedia; backend `routes/breeds.js` |
| #27/#28 | Managing users (admin) | admin/AdminUsers; backend `/admin/users` |
| #30 | Analytics and audit log | admin/AdminAnalytics; backend `/admin/analytics`, `/admin/audit` |
