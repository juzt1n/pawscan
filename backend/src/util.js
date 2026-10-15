import { ObjectId } from "mongodb";
import { getDb } from "./db.js";

export const FREE_DAILY_QUOTA = 3;

// Only accept real 24-char hex ids (ObjectId.isValid also accepts any 12-char string)
export const oid = (s) => (/^[a-f0-9]{24}$/i.test(String(s)) ? new ObjectId(String(s)) : null);

// Lets async route handlers throw without crashing the server
export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// "2026-10-15" in Singapore time: the daily scan quota resets at SGT midnight
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });

export function currentQuota(user) {
  const q = user.quota;
  return q && q.date === today() ? q : { date: today(), used: 0, bonus: 0 };
}

// null means unlimited (premium)
export function remainingScans(user, q = currentQuota(user)) {
  return user.tier === "premium" ? null : Math.max(FREE_DAILY_QUOTA + q.bonus - q.used, 0);
}

// The object the app keeps as its "session" (same fields as the old mock session)
export function sessionOf(user, clinic) {
  const s = {
    email: user.email,
    name: user.name,
    phone: user.phone || "",
    tier: user.tier,
    accountType: user.accountType,
    status: user.status,
    createdAt: user.createdAt.getTime(),
  };
  if (user.accountType === "business" && clinic) {
    s.name = clinic.clinicName;
    s.status = clinic.status; // pending / approved / rejected / suspended
    s.businessId = String(clinic._id);
  }
  return s;
}

// Append-only audit log (Section 10.1). There is deliberately no update/delete.
export async function audit(actor, action, target = null, kind = "info") {
  await getDb().collection("audit_logs").insertOne({ actor, action, target, kind, createdAt: new Date() });
}
