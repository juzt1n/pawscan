import { Router } from "express";
import { getDb } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { wrap, oid, audit } from "../util.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

const SGT = "Asia/Singapore";

// URS #27 List users (admin accounts are not listed)
router.get("/users", wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const skip = Math.max(parseInt(req.query.skip) || 0, 0);
  const rows = await getDb().collection("users")
    .find({ accountType: { $ne: "admin" } })
    .sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
  res.json(rows.map((u) => ({
    id: String(u._id), name: u.name, email: u.email, tier: u.tier, status: u.status,
    accountType: u.accountType, created: u.createdAt.toISOString().slice(0, 10),
  })));
}));

// Suspend / reactivate
router.patch("/users/:id/status", wrap(async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  const id = oid(req.params.id);
  const target = id && (await getDb().collection("users").findOne({ _id: id }));
  if (!target) return res.status(404).json({ error: "No user found." });
  if (target.accountType === "admin") return res.status(403).json({ error: "Admin accounts cannot be changed here." });
  await getDb().collection("users").updateOne({ _id: id }, { $set: { status } });
  await audit(req.user.email, status === "suspended" ? "Suspended user account" : "Reactivated user account", String(id), status === "suspended" ? "warn" : "ok");
  res.json({ ok: true });
}));

// URS #30 Dashboard figures, computed from the real collections
router.get("/analytics", wrap(async (req, res) => {
  const db = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeSubscriptions, suspendedUsers, pendingBusinesses, scansThisMonth, okThisMonth, trendRows] = await Promise.all([
    db.collection("users").countDocuments({ accountType: { $ne: "admin" } }),
    db.collection("users").countDocuments({ tier: "premium" }),
    db.collection("users").countDocuments({ status: "suspended" }),
    db.collection("clinics").countDocuments({ status: "pending" }),
    db.collection("scans").countDocuments({ createdAt: { $gte: monthStart } }),
    db.collection("scans").countDocuments({ createdAt: { $gte: monthStart }, belowThreshold: false }),
    db.collection("scans").aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: SGT } }, n: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const byDay = Object.fromEntries(trendRows.map((r) => [r._id, r.n]));
  const scanTrend = [];
  for (let i = 11; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: SGT });
    scanTrend.push(byDay[day] || 0);
  }

  res.json({
    totalUsers,
    activeSubscriptions,
    scansThisMonth,
    successRate: scansThisMonth ? `${((okThisMonth / scansThisMonth) * 100).toFixed(1)}%` : "n/a",
    pendingBusinesses,
    suspendedUsers,
    scanTrend,
  });
}));

// Audit log: read and append only
router.get("/audit", wrap(async (req, res) => {
  const rows = await getDb().collection("audit_logs").find().sort({ createdAt: -1 }).limit(50).toArray();
  res.json(rows.map((r) => ({
    time: r.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: SGT }),
    who: r.actor, what: r.action, kind: r.kind,
  })));
}));

router.post("/audit", wrap(async (req, res) => {
  const what = String(req.body.what || "").trim().slice(0, 200);
  const kind = ["ok", "warn", "info"].includes(req.body.kind) ? req.body.kind : "ok";
  if (!what) return res.status(400).json({ error: "Missing text." });
  await audit(req.user.email, what, null, kind);
  res.status(201).json({ ok: true });
}));

export default router;
