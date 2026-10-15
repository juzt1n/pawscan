import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { getDb } from "../db.js";
import { requireAuth } from "../auth.js";
import { wrap, oid, currentQuota, remainingScans } from "../util.js";
import { buildResult, getHealthEntry } from "../health.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

// Per-user limit on the expensive endpoint (PRD security requirement)
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: "Too many scans too quickly. Please wait a minute." },
});

// Server-side content check: look at the file's real bytes, not the name the client claims
function detectImageType(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

async function callModel(buffer, type) {
  const form = new FormData();
  form.append("image", new Blob([buffer], { type }), "photo");
  const r = await fetch(`${process.env.MODEL_URL.replace(/\/$/, "")}/predict`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
    body: form,
    signal: AbortSignal.timeout(60000), // a sleeping Space can take a while to wake up
  });
  if (!r.ok) throw new Error(`Model service responded ${r.status}`);
  const ml = await r.json();
  if (!Array.isArray(ml?.predictions) || !ml.predictions.length) throw new Error("Bad model response");
  return ml;
}

// PRD #07/#08 Scan a dog: validate -> quota check -> model -> merge health data
router.post("/analyze", requireAuth, analyzeLimiter, upload.single("image"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded." });
  const type = detectImageType(req.file.buffer);
  if (!type) return res.status(400).json({ error: "Unsupported or invalid image. Use JPG, PNG or WebP." });

  const q = currentQuota(req.user);
  if (remainingScans(req.user, q) === 0) {
    return res.status(429).json({ error: "You're out of scans for today.", code: "QUOTA_EXHAUSTED" });
  }

  let ml;
  try {
    ml = await callModel(req.file.buffer, type);
  } catch (e) {
    console.error("Model call failed:", e.message);
    // Quota is NOT deducted when the model service is down (PRD #07 5a)
    return res.status(503).json({ error: "Service temporarily unavailable, please try again." });
  }

  if (req.user.tier !== "premium") {
    await getDb().collection("users").updateOne(
      { _id: req.user._id },
      { $set: { quota: { date: q.date, used: q.used + 1, bonus: q.bonus } } }
    );
  }
  res.json(await buildResult(ml));
}));

// ---- Scan history (PRD #11, #12) -------------------------------------------
// The app's record is stored in `payload` so whatever fields the screens save come back unchanged.
const toScan = (d) => ({ ...(d.payload || {}), id: String(d._id), timestamp: d.createdAt.getTime(), breed: d.topBreed, confidence: d.confidence });

router.get("/scans", requireAuth, wrap(async (req, res) => {
  const rows = await getDb().collection("scans").find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json(rows.map(toScan));
}));

router.post("/scans", requireAuth, upload.single("image"), wrap(async (req, res) => {
  let record = req.body?.record;
  if (typeof record === "string") {
    if (record.length > 50000) return res.status(413).json({ error: "Scan record too large." });
    try { record = JSON.parse(record); } catch { return res.status(400).json({ error: "Invalid scan record." }); }
  } else {
    record = req.body || {};
  }
  const topBreed = String(record.breed || "").trim().slice(0, 80);
  if (!topBreed) return res.status(400).json({ error: "Scan record needs a breed." });

  let imageType = null;
  if (req.file) {
    imageType = detectImageType(req.file.buffer);
    if (!imageType) return res.status(400).json({ error: "Unsupported or invalid image." });
  }

  const db = getDb();
  const now = new Date();
  const { imageUri, ...payload } = record; // the phone's local file path means nothing to the server
  const doc = {
    userId: req.user._id,
    dogId: oid(record.dogId),
    imageUrl: null,
    predictions: Array.isArray(record.rawPredictions)
      ? record.rawPredictions.slice(0, 5).map((p) => ({ breed: String(p.breed), confidence: Number(p.confidence) }))
      : [],
    topBreed,
    confidence: Number(record.confidence) || 0,
    belowThreshold: !!record.belowThreshold,
    payload,
    createdAt: now,
  };
  const r = await db.collection("scans").insertOne(doc);
  const id = r.insertedId;

  if (req.file) {
    await db.collection("scan_images").insertOne({ _id: id, userId: req.user._id, contentType: imageType, data: req.file.buffer, createdAt: now });
    doc.imageUrl = `/api/scans/${id}/image`;
    await db.collection("scans").updateOne({ _id: id }, { $set: { imageUrl: doc.imageUrl } });
  }

  // Keep what the user was shown at the time (health_reports, Section 10.1)
  const { entry, coverage } = await getHealthEntry(topBreed);
  await db.collection("health_reports").insertOne({
    scanId: id, breedKey: topBreed.toLowerCase(), watchlistSnapshot: entry.watchlist, coverage, createdAt: now,
  });

  res.status(201).json(toScan({ ...doc, _id: id }));
}));

router.get("/scans/:id/image", requireAuth, wrap(async (req, res) => {
  const id = oid(req.params.id);
  const img = id && (await getDb().collection("scan_images").findOne({ _id: id, userId: req.user._id }));
  if (!img) return res.status(404).json({ error: "Not found" });
  res.set("Cache-Control", "private, max-age=86400");
  res.type(img.contentType).send(Buffer.from(img.data.buffer.subarray(0, img.data.length())));
}));

router.delete("/scans/:id", requireAuth, wrap(async (req, res) => {
  const id = oid(req.params.id);
  const db = getDb();
  const del = id && (await db.collection("scans").deleteOne({ _id: id, userId: req.user._id }));
  if (!del?.deletedCount) return res.status(404).json({ error: "Not found" });
  await db.collection("scan_images").deleteOne({ _id: id }); // image is deleted with the record (PDPA)
  await db.collection("health_reports").deleteMany({ scanId: id });
  res.json({ ok: true });
}));

export default router;
