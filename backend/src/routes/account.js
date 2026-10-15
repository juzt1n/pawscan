import { Router } from "express";
import { getDb } from "../db.js";
import { requireAuth } from "../auth.js";
import { wrap, sessionOf, audit, currentQuota, remainingScans, FREE_DAILY_QUOTA } from "../util.js";

const router = Router();
const users = () => getDb().collection("users");

async function sessionFor(user) {
  const clinic = user.accountType === "business" ? await getDb().collection("clinics").findOne({ ownerId: user._id }) : null;
  return sessionOf(user, clinic);
}

// ---- Profile / session -----------------------------------------------------
router.get("/me", requireAuth, wrap(async (req, res) => res.json(await sessionFor(req.user))));

// PRD #06 Update profile
router.patch("/me", requireAuth, wrap(async (req, res) => {
  const set = {};
  if (typeof req.body.name === "string") set.name = req.body.name.trim().slice(0, 80);
  if (typeof req.body.phone === "string") set.phone = req.body.phone.trim().slice(0, 30);
  if (set.name === "") delete set.name;
  const user = Object.keys(set).length
    ? await users().findOneAndUpdate({ _id: req.user._id }, { $set: set }, { returnDocument: "after" })
    : req.user;
  res.json(await sessionFor(user));
}));

// PRD #17 Upgrade. DEMO: no real payment is taken here (see README).
router.post("/me/upgrade", requireAuth, wrap(async (req, res) => {
  const user = await users().findOneAndUpdate({ _id: req.user._id }, { $set: { tier: "premium" } }, { returnDocument: "after" });
  await audit("system", "Account upgraded to premium", String(user._id), "info");
  res.json(await sessionFor(user));
}));

// PDPA: deleting the account removes scans, images, dogs, health reports (Section 10.4)
router.delete("/me", requireAuth, wrap(async (req, res) => {
  if (req.user.accountType === "admin") return res.status(403).json({ error: "Admin accounts cannot be deleted here." });
  const db = getDb();
  const uid = req.user._id;

  const scanIds = (await db.collection("scans").find({ userId: uid }, { projection: { _id: 1 } }).toArray()).map((s) => s._id);
  await db.collection("scan_images").deleteMany({ _id: { $in: scanIds } });
  await db.collection("health_reports").deleteMany({ scanId: { $in: scanIds } });
  await db.collection("scans").deleteMany({ userId: uid });
  await db.collection("dogs").deleteMany({ ownerId: uid });

  const clinicIds = (await db.collection("clinics").find({ ownerId: uid }, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
  await db.collection("referral_events").deleteMany({ clinicId: { $in: clinicIds } });
  await db.collection("clinics").deleteMany({ ownerId: uid });

  await users().deleteOne({ _id: uid });
  await audit("system", "Account deleted", String(uid), "info");
  res.json({ ok: true });
}));

// ---- Scan quota (PRD #15, #16, #18) ----------------------------------------
const quotaBody = (user) => {
  const q = currentQuota(user);
  return { day: q.date, used: q.used, bonus: q.bonus, limit: FREE_DAILY_QUOTA, remaining: remainingScans(user, q) }; // remaining: null = unlimited
};

router.get("/quota", requireAuth, (req, res) => res.json(quotaBody(req.user)));

router.post("/quota/ad-bonus", requireAuth, wrap(async (req, res) => {
  if (req.user.tier === "premium") return res.json(quotaBody(req.user));
  const q = currentQuota(req.user);
  if (q.bonus >= 5) return res.status(429).json({ error: "Daily ad bonus limit reached." });
  const user = await users().findOneAndUpdate(
    { _id: req.user._id },
    { $set: { quota: { date: q.date, used: q.used, bonus: q.bonus + 1 } } },
    { returnDocument: "after" }
  );
  res.json(quotaBody(user));
}));

// ---- Bookmarks (PRD #14) ----------------------------------------------------
router.get("/bookmarks", requireAuth, (req, res) => res.json(req.user.bookmarks || []));

router.post("/bookmarks/toggle", requireAuth, wrap(async (req, res) => {
  const breed = String(req.body.breed || "").trim().slice(0, 80);
  if (!breed) return res.status(400).json({ error: "Breed required." });
  const has = (req.user.bookmarks || []).includes(breed);
  const user = await users().findOneAndUpdate(
    { _id: req.user._id },
    has ? { $pull: { bookmarks: breed } } : { $addToSet: { bookmarks: breed } },
    { returnDocument: "after" }
  );
  res.json(user.bookmarks || []);
}));

// ---- Dog profiles (PRD #23, premium) ---------------------------------------
const toDog = (d) => ({ ...(d.extra || {}), id: String(d._id), name: d.name, breed: d.breed, age: d.age, sex: d.sex, photoUri: d.photoUrl });

router.get("/dogs", requireAuth, wrap(async (req, res) => {
  const dogs = await getDb().collection("dogs").find({ ownerId: req.user._id }).sort({ createdAt: 1 }).toArray();
  res.json(dogs.map(toDog));
}));

router.post("/dogs", requireAuth, wrap(async (req, res) => {
  if (req.user.tier !== "premium") return res.status(403).json({ error: "Dog profiles are a Premium feature." });
  const { name, breed, age, sex, photoUri, ...rest } = req.body || {};
  if (!String(name || "").trim()) return res.status(400).json({ error: "Please fill in all required fields." });
  if (JSON.stringify(rest).length > 5000) return res.status(413).json({ error: "Dog profile too large." });
  const doc = {
    ownerId: req.user._id,
    name: String(name).trim().slice(0, 60),
    breed: String(breed || "").slice(0, 80),
    age: typeof age === "number" || typeof age === "string" ? age : null,
    sex: String(sex || "").slice(0, 20),
    photoUrl: photoUri ? String(photoUri).slice(0, 500) : null,
    extra: rest,
    createdAt: new Date(),
  };
  const r = await getDb().collection("dogs").insertOne(doc);
  res.status(201).json(toDog({ ...doc, _id: r.insertedId }));
}));

export default router;
