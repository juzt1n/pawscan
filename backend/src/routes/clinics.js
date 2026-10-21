import { Router } from "express";
import { getDb } from "../db.js";
import { createUser, requireAuth, requireRole, signToken, validPassword } from "../auth.js";
import { wrap, oid, sessionOf, audit } from "../util.js";
import { geocodeSG } from "../geocode.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clinics = () => getDb().collection("clinics");

// The shape the app's admin/business screens already use
const toBusiness = (c, email) => ({
  id: String(c._id),
  email,
  clinicName: c.clinicName,
  uen: c.uen,
  avsLicence: c.avsLicence,
  address: c.address,
  phone: c.phone,
  hours: c.hours || null,
  services: c.services || null,
  status: c.status,
  reason: c.reviewReason || null,
  submittedAt: c.createdAt.getTime(),
  reviewedAt: c.reviewedAt ? c.reviewedAt.getTime() : null,
});

const toClinic = (c) => ({
  id: String(c._id),
  clinicName: c.clinicName,
  address: c.address,
  phone: c.phone,
  distanceKm: c.distM != null ? Math.round(c.distM / 100) / 10 : null,
  lat: c.location?.coordinates?.[1] ?? null,
  lng: c.location?.coordinates?.[0] ?? null,
  hours: c.hours || null,
  verified: true,
});

const str = (v, max) => String(v || "").trim().slice(0, max);

// URS #02 Register a business (vet clinic). Starts as "pending" until an admin reviews it.
router.post("/businesses/register", wrap(async (req, res) => {
  const b = req.body || {};
  const email = str(b.email, 120).toLowerCase();
  const clinicName = str(b.clinicName, 120);
  const uen = str(b.uen, 20).toUpperCase();
  const avsLicence = str(b.avsLicence, 40).toUpperCase();
  const address = str(b.address, 200);
  const phone = str(b.phone, 30);

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (!validPassword(b.password)) return res.status(400).json({ error: "Password must be 8 to 72 characters." });
  if (!clinicName || !uen || !avsLicence || !address || !phone) {
    return res.status(400).json({ error: "Please fill in all mandatory fields." });
  }

  let user;
  try {
    user = await createUser({ email, password: b.password, name: clinicName, accountType: "business" });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "This email is already registered. Please log in instead." });
    throw e;
  }

  const doc = { ownerId: user._id, clinicName, uen, avsLicence, address, phone, hours: null, status: "pending", reviewReason: null, createdAt: new Date(), reviewedAt: null };
  // Map position for the vet locator, looked up from the address (null if not found)
  const location = await geocodeSG(address);
  if (location) doc.location = location;
  else doc.geoFailedFor = address;
  try {
    const r = await clinics().insertOne(doc);
    doc._id = r.insertedId;
  } catch (e) {
    await getDb().collection("users").deleteOne({ _id: user._id }); // don't leave a half-created account
    throw e;
  }
  res.status(201).json({ token: signToken(user), session: sessionOf(user, doc) });
}));

// The logged-in business's own listing
router.get("/businesses/me", requireAuth, requireRole("business"), wrap(async (req, res) => {
  const c = await clinics().findOne({ ownerId: req.user._id });
  if (!c) return res.status(404).json({ error: "No business application found." });
  res.json(toBusiness(c, req.user.email));
}));

// URS #24 Business edits its own listing (admins may edit too)
router.patch("/businesses/:id", requireAuth, wrap(async (req, res) => {
  const id = oid(req.params.id);
  const c = id && (await clinics().findOne({ _id: id }));
  if (!c) return res.status(404).json({ error: "Not found" });
  const isOwner = String(c.ownerId) === String(req.user._id);
  if (!isOwner && req.user.accountType !== "admin") return res.status(403).json({ error: "Not allowed" });

  const set = {};
  for (const [field, max] of [["clinicName", 120], ["address", 200], ["phone", 30], ["hours", 80], ["services", 200]]) {
    if (typeof req.body[field] === "string") set[field] = req.body[field].trim().slice(0, max);
  }
  if (set.clinicName === "") delete set.clinicName;
  const update = { $set: set };
  // A new address needs a new map position
  if (set.address && set.address !== c.address) {
    const location = await geocodeSG(set.address);
    if (location) { set.location = location; update.$unset = { geoFailedFor: "" }; }
    else { set.geoFailedFor = set.address; update.$unset = { location: "" }; }
  }
  const updated = Object.keys(set).length
    ? await clinics().findOneAndUpdate({ _id: id }, update, { returnDocument: "after" })
    : c;
  const owner = await getDb().collection("users").findOne({ _id: updated.ownerId });
  res.json(toBusiness(updated, owner?.email || ""));
}));

// URS #25 Anonymous referral statistics for the business (no user ids are ever stored)
router.get("/businesses/me/stats", requireAuth, requireRole("business"), wrap(async (req, res) => {
  const c = await clinics().findOne({ ownerId: req.user._id });
  if (!c) return res.status(404).json({ error: "No business application found." });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await getDb().collection("referral_events").aggregate([
    { $match: { clinicId: c._id, createdAt: { $gte: since } } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
  ]).toArray();
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  res.json({ period: "30d", views: by.view || 0, directions: by.directions || 0, calls: by.call || 0 });
}));

// ---- Admin: applications (URS #28) ------------------------------------------
router.get("/businesses", requireAuth, requireRole("admin"), wrap(async (req, res) => {
  const rows = await clinics().find({ ownerId: { $ne: null } }).sort({ createdAt: -1 }).limit(200).toArray();
  const owners = await getDb().collection("users").find({ _id: { $in: rows.map((c) => c.ownerId) } }).toArray();
  const emailById = Object.fromEntries(owners.map((u) => [String(u._id), u.email]));
  res.json(rows.map((c) => toBusiness(c, emailById[String(c.ownerId)] || "")));
}));

router.post("/businesses/:id/review", requireAuth, requireRole("admin"), wrap(async (req, res) => {
  const decision = req.body.decision;
  if (!["approved", "rejected", "suspended"].includes(decision)) return res.status(400).json({ error: "Invalid decision." });
  const id = oid(req.params.id);
  const c = id && (await clinics().findOneAndUpdate(
    { _id: id },
    { $set: { status: decision, reviewReason: str(req.body.reason, 300) || null, reviewedAt: new Date() } },
    { returnDocument: "after" }
  ));
  if (!c) return res.status(404).json({ error: "Not found" });
  await audit(req.user.email, `${decision[0].toUpperCase()}${decision.slice(1)} business application`, String(c._id), decision === "approved" ? "ok" : "warn");
  const owner = await getDb().collection("users").findOne({ _id: c.ownerId });
  res.json(toBusiness(c, owner?.email || ""));
}));

// ---- Vet locator (URS #22) -------------------------------------------------
// Only admin-approved clinics are ever shown. Pass ?lat=&lng= to sort by distance.
router.get("/clinics/nearby", requireAuth, wrap(async (req, res) => {
  // Approved clinics registered before geocoding existed get a map position now (a few at a time)
  const missing = await clinics()
    .find({ status: "approved", location: { $exists: false }, geoFailedFor: { $exists: false } })
    .limit(5).toArray();
  for (const m of missing) {
    const location = await geocodeSG(m.address);
    await clinics().updateOne({ _id: m._id }, location ? { $set: { location } } : { $set: { geoFailedFor: m.address } });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  let rows;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const near = await clinics().aggregate([
      { $geoNear: { near: { type: "Point", coordinates: [lng, lat] }, distanceField: "distM", spherical: true, query: { status: "approved" } } },
      { $limit: 50 },
    ]).toArray();
    const rest = await clinics().find({ status: "approved", _id: { $nin: near.map((c) => c._id) } }).toArray();
    rows = [...near, ...rest];
  } else {
    rows = await clinics().find({ status: "approved" }).sort({ createdAt: -1 }).limit(100).toArray();
  }
  res.json(rows.map(toClinic));
}));

// Referral events: stores the clinic and the type of action only, never who did it
router.post("/clinics/:id/events", requireAuth, wrap(async (req, res) => {
  const id = oid(req.params.id);
  const type = req.body.type;
  if (!["view", "directions", "call"].includes(type)) return res.status(400).json({ error: "Invalid event type." });
  const c = id && (await clinics().findOne({ _id: id, status: "approved" }, { projection: { _id: 1 } }));
  if (!c) return res.status(404).json({ error: "Not found" });
  await getDb().collection("referral_events").insertOne({ clinicId: id, type, createdAt: new Date() });
  res.status(204).end();
}));

export default router;
