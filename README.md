# PawScan v3 — Beginner-Friendly Edition

The same app as v2, with every file rewritten so that someone with no coding
background can read it top to bottom and follow what's happening. All the
fixes we discovered along the way are already baked in:

- Expo SDK 54 (matches current Expo Go on your phone)
- Android safe-area fix (header no longer covers the clock; tabs are tappable)
- New image picker API (`mediaTypes: ["images"]`)
- `expo-file-system/legacy` import (the SDK 54 gotcha)
- Photos copied to permanent storage so they survive for reports
- CSV export (spreadsheet) + PDF vet report export (photo + health watchlist)

## Run it

```
cd pawscan-v3
npm install
npx expo start
```

Scan the QR with Expo Go (same Wi-Fi). If versions complain: `npx expo install --fix`

## Read the code in this order

1. `README.md` — you are here
2. `mock.js` — the fake AI and the "contract" (the agreed answer format)
3. `api.js` — the one door: fake AI today, real server later (USE_MOCK flag)
4. `lib/storage.js` — everything the app remembers, and the two exports
5. `App.js` — login gate + tabs
6. `screens/ScanScreen.js` — the main flow: photo → analyze → save → show
7. The other screens + `components/` — each explains itself at the top

## The big ideas (worth understanding for the report/viva)

**The mock seam.** The app never talks to the real AI directly — everything
goes through `api.js`. Today that returns fake answers shaped exactly like
the real AI's answers. On integration day we flip `USE_MOCK = false`, point
`BACKEND_URL` at our Express server, and nothing else changes.

**The storage seam.** Screens never touch the phone's storage directly —
they call functions in `lib/storage.js`. When accounts move to the Express
server + MongoDB, we rewrite that one file's internals and no screen changes.

**Honest limits (say these proudly, don't hide them):**
- Login is mocked: no server, no password checking yet
- The AI is mocked: 4 rotating scenarios, not real predictions
- Storage is unencrypted: fine for bookmarks, NOT for real tokens (those go
  in the phone's secure storage when real auth arrives)

## PRD use case coverage

| ID | Use case | File |
|----|----------|------|
| #01/#03 | Register / Login (mocked, with PRD error flows 7a/7b) | screens/AuthScreen.js |
| #04 | Logout | screens/ProfileScreen.js |
| #07/#08 | Scan via camera / gallery | screens/ScanScreen.js |
| #09 | View identification result | components/ResultCard.js |
| #10/#13/#14 | Breed page / encyclopedia / bookmarks | screens/BreedsScreen.js |
| #11/#12 | View / delete scan history | screens/HistoryScreen.js |
| #15/#16/#18 | Quota / ad bonus / premium unlimited | ScanScreen + lib/storage.js |
| #17 | Upgrade to premium (mocked payment) | screens/ProfileScreen.js |
| #19–#21 | Health analysis + non-dismissable disclaimer | ResultCard + components/shared.js |
| #23 | Dog profiles (premium) | screens/ProfileScreen.js |
| PRD premium | CSV + PDF vet report export | lib/storage.js + ProfileScreen |
| #22 | Vet locator | placeholder (later sprint) |

Not in this build: business/moderator/admin roles (#02, #24–#31), real JWT
auth, payments, misidentification reporting.

## Next steps (the plan)

1. Expand `data/breed_health.json` to 15–20 breeds with cited vet sources
2. Build the Express backend (its API = what `lib/storage.js` + `api.js` do,
   over HTTP)
3. Teammate wraps the trained model in FastAPI
4. Integration day: flip `USE_MOCK`, set `BACKEND_URL`, test with real dogs
