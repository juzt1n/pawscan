# PawScan backend (Express + MongoDB Atlas)

Sits between the app and the AI service:
`phone app -> this server (login, quota, history, clinics, admin) -> private Hugging Face Space (the model)`

## 1. MongoDB Atlas (10 min)
1. cloud.mongodb.com -> create a free **M0** cluster.
2. Database Access -> add a database user (username + password).
3. Network Access -> add IP `0.0.0.0/0` (hosted servers have no fixed IP; the password still protects it).
4. Connect -> Drivers -> copy the connection string; put your password in it.

## 2. Run locally
```
npm install
cp .env.example .env        # then fill it in
```
The seed script reads `breed_health.json` and `conditions.json` from the app's `data/` folder
(one level up), or from `backend/data/` if you deploy the backend on its own. Then:
```
npm run seed                # fills breeds, conditions, demo clinics, and creates the admin account
npm start
```
Check `http://localhost:3001/health` returns `{"status":"ok"}`.

## 3. Test with Postman or curl before touching the app
```
# register
curl -X POST localhost:3001/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"me@test.com","password":"password123","name":"Me"}'
# -> returns {"token": "...", "session": {...}}   (copy the token)

# scan a dog (needs the AI service running, MODEL_URL + HF_TOKEN set in .env)
curl -X POST localhost:3001/api/analyze -H "Authorization: Bearer TOKEN" -F "image=@dog.jpg"

# quota, history, bookmarks
curl localhost:3001/api/quota -H "Authorization: Bearer TOKEN"
```

## 4. Deploy to Render (free)
1. The backend lives in the `backend/` folder of the PawScan repo (`.env` and `node_modules` are git-ignored).
2. render.com -> New -> **Web Service** -> pick the repo, and set **Root Directory** to `backend`.
3. Build command: `npm install`   Start command: `npm start`   Runtime: Node.
4. Environment tab: add every variable from `.env.example` (`MONGODB_URI`, `JWT_SECRET`, `MODEL_URL`, `HF_TOKEN`, `DB_NAME`).
5. Deploy, then open `https://YOUR-APP.onrender.com/health`.
6. Put that address in the app's `lib/config.js`.

Free tier note: the service sleeps after about 15 minutes idle, so the first request can take 30 to 60 seconds.
Open the `/health` URL a few minutes before your demo to wake it. The Hugging Face Space can sleep too.

## Endpoints (all under /api)
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/forgot`, `/auth/reset` |
| Account | `GET/PATCH/DELETE /me`, `POST /me/upgrade`, `GET /quota`, `POST /quota/ad-bonus`, `GET /bookmarks`, `POST /bookmarks/toggle`, `GET/POST /dogs` |
| Scans | `POST /analyze`, `GET/POST /scans`, `GET /scans/:id/image`, `DELETE /scans/:id` |
| Business | `POST /businesses/register`, `GET /businesses/me`, `GET /businesses/me/stats`, `PATCH /businesses/:id` |
| Clinics | `GET /clinics/nearby`, `POST /clinics/:id/events` |
| Admin | `GET /businesses`, `POST /businesses/:id/review`, `GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/analytics`, `GET/POST /admin/audit` |
| Encyclopedia | `GET /breeds/edited` (public), `PUT /admin/breeds/:key`, `DELETE /admin/breeds/:key` (reset to original) |

## Security measures covered (maps to your PRD section 4.4)
bcrypt password hashing, JWT auth, 5-failed-login lockout, per-user rate limit on scans, server-side image checks
(real file bytes, 5 MB cap), model service only reachable with the private token, scan images deleted with the
record, account deletion cascades, append-only audit log, helmet headers.

## Honest limitations to state in the report
- One JWT (7 days) instead of short-lived access + refresh-token rotation.
- Password-reset emails are not sent yet (needs an email service); the endpoints are ready.
- Premium upgrade has no real payment; the ad bonus is trusted from the app.
- Verification of UEN / AVS licence is a manual admin decision.
- Clinic registration has no address-to-coordinates lookup, so new clinics sort by newest, not distance,
  until coordinates are added (demo clinics have them).
