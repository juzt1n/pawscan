import { Router } from "express";
import fs from "node:fs/promises";
import { getDb } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { wrap, audit } from "../util.js";

// ============================================================================
// Breed encyclopedia edits (URS #26, admin only)
// ============================================================================
// The app ships with data/breed_health.json. When an admin edits a breed, the
// edited version is saved in the `breeds` collection with editedAt/editedBy.
// Every phone downloads the edited breeds at start-up (GET /breeds/edited), so
// an edit shows up for all users, and /analyze already reads from this collection.
const router = Router();
const breeds = () => getDb().collection("breeds");
const RISKS = ["high", "moderate", "low"];
const s = (v, max) => String(v ?? "").trim().slice(0, max);

// Where the original breed data lives (backend/data in a standalone deploy,
// or the app's data/ folder when the backend sits inside the app repo)
async function readOriginal(key) {
  for (const p of ["../../data/breed_health.json", "../../../data/breed_health.json"]) {
    try {
      const all = JSON.parse(await fs.readFile(new URL(p, import.meta.url), "utf8"));
      return all[key] || null;
    } catch {
      /* try the next location */
    }
  }
  return null;
}

// Public: the encyclopedia is public content. Returns { breedKey: entry } for edited breeds only.
router.get("/breeds/edited", wrap(async (req, res) => {
  const rows = await breeds().find({ editedAt: { $ne: null } }).toArray();
  res.json(Object.fromEntries(rows.map(({ _id, editedBy, ...entry }) => [_id, { ...entry, editedAt: entry.editedAt?.getTime?.() ?? entry.editedAt }])));
}));

// Admin: save an edited breed. Breeds can be edited but not created (they must match the model's 120 classes).
router.put("/admin/breeds/:key", requireAuth, requireRole("admin"), wrap(async (req, res) => {
  const key = s(req.params.key, 80).toLowerCase();
  if (!key || key.startsWith("_") || !(await breeds().findOne({ _id: key }, { projection: { _id: 1 } }))) {
    return res.status(404).json({ error: "Unknown breed." });
  }
  const b = req.body || {};
  const watchlist = Array.isArray(b.watchlist) ? b.watchlist.slice(0, 30) : [];
  const careTips = Array.isArray(b.careTips) ? b.careTips.slice(0, 20) : [];
  const entry = {
    profile: {
      size: s(b.profile?.size, 120),
      lifespan: s(b.profile?.lifespan, 60),
      temperament: s(b.profile?.temperament, 200),
    },
    watchlist: watchlist.map((w) => ({
      condition: s(w?.condition, 120),
      risk: RISKS.includes(w?.risk) ? w.risk : "moderate",
      earlySigns: s(w?.earlySigns, 400),
      prevention: s(w?.prevention, 400),
    })).filter((w) => w.condition),
    careTips: careTips.map((t) => s(t, 300)).filter(Boolean),
  };
  if (!entry.watchlist.length) return res.status(400).json({ error: "An article needs at least one condition." });

  await breeds().updateOne({ _id: key }, { $set: { ...entry, editedAt: new Date(), editedBy: req.user.email } });
  await audit(req.user.email, `Edited encyclopedia article: ${key}`, key, "info");
  res.json({ ...entry, editedAt: Date.now() });
}));

// Admin: undo all edits to a breed (restores the shipped breed_health.json entry)
router.delete("/admin/breeds/:key", requireAuth, requireRole("admin"), wrap(async (req, res) => {
  const key = s(req.params.key, 80).toLowerCase();
  const original = await readOriginal(key);
  if (!original) return res.status(404).json({ error: "Unknown breed." });
  await breeds().updateOne({ _id: key }, { $set: original, $unset: { editedAt: "", editedBy: "" } });
  await audit(req.user.email, `Reset encyclopedia article to original: ${key}`, key, "info");
  res.json({ ok: true });
}));

export default router;
