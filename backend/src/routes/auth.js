import { Router } from "express";
import crypto from "node:crypto";
import { getDb } from "../db.js";
import { createUser, checkPassword, hashPassword, signToken, validPassword } from "../auth.js";
import { wrap, sessionOf, audit } from "../util.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const cleanEmail = (e) => String(e || "").trim().toLowerCase();

// PRD #01 Register
router.post("/register", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = req.body.password;
  const name = String(req.body.name || "").trim().slice(0, 80) || email.split("@")[0];

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8 to 72 characters." });

  let user;
  try {
    user = await createUser({ email, password, name });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "This email is already registered. Please log in instead." });
    throw e;
  }
  res.status(201).json({ token: signToken(user), session: sessionOf(user) });
}));

// PRD #03 Login (with lockout after repeated failures, use case 5c)
router.post("/login", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = req.body.password;
  if (!email || typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Please fill up email/password." });
  }

  const db = getDb();
  const users = db.collection("users");
  const user = await users.findOne({ email });
  const invalid = () => res.status(401).json({ error: "Invalid email or password." });
  if (!user) return invalid();

  if (user.lockUntil && user.lockUntil > new Date()) {
    return res.status(423).json({ error: "Account temporarily locked. Please try again later." });
  }

  if (!(await checkPassword(password, user.passwordHash))) {
    const fails = (user.failedLogins || 0) + 1;
    if (fails >= MAX_FAILS) {
      await users.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } });
      await audit("system", `${MAX_FAILS} failed logins - account locked`, String(user._id), "warn");
    } else {
      await users.updateOne({ _id: user._id }, { $set: { failedLogins: fails } });
    }
    return invalid();
  }

  if (user.status === "suspended") return res.status(403).json({ error: "This account has been suspended." });

  await users.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockUntil: null } });
  const clinic = user.accountType === "business" ? await db.collection("clinics").findOne({ ownerId: user._id }) : null;
  res.json({ token: signToken(user), session: sessionOf(user, clinic) });
}));

// PRD #05 Reset password, step 1: request a time-limited token.
// Always answers the same way so nobody can discover which emails are registered.
router.post("/forgot", wrap(async (req, res) => {
  const email = cleanEmail(req.body.email);
  const users = getDb().collection("users");
  const user = email ? await users.findOne({ email }) : null;
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await users.updateOne({ _id: user._id }, { $set: { resetHash: sha256(token), resetExpires: new Date(Date.now() + 30 * 60 * 1000) } });
    // TODO: send `token` to the user by email (Resend / SendGrid / Gmail SMTP).
    // Until an email service is connected, the token is only printed in development.
    if (process.env.NODE_ENV !== "production") console.log(`[dev] password reset token for ${email}: ${token}`);
  }
  res.json({ message: "If that email is registered, a reset link has been sent." });
}));

// Reset password, step 2: set the new password using the token
router.post("/reset", wrap(async (req, res) => {
  const { token, password } = req.body;
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8 to 72 characters." });
  const users = getDb().collection("users");
  const user = await users.findOne({ resetHash: sha256(String(token || "")), resetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });
  await users.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(password), failedLogins: 0, lockUntil: null }, $unset: { resetHash: "", resetExpires: "" } }
  );
  res.json({ message: "Password updated. Please log in." });
}));

export default router;
