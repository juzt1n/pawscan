import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "./db.js";
import { today } from "./util.js";

export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES || "7d" });

export const validPassword = (pw) => typeof pw === "string" && pw.length >= 8 && pw.length <= 72; // bcrypt limit

// Throws an error with code 11000 if the email already exists
export async function createUser({ email, password, name, accountType = "personal" }) {
  const doc = {
    email,
    passwordHash: await hashPassword(password),
    name,
    phone: "",
    accountType,
    tier: "free",
    status: "active",
    quota: { date: today(), used: 0, bonus: 0 },
    bookmarks: [],
    failedLogins: 0,
    lockUntil: null,
    createdAt: new Date(),
  };
  const r = await getDb().collection("users").insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

export async function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await getDb().collection("users").findOne({ _id: new ObjectId(sub) });
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    if (user.status === "suspended") return res.status(403).json({ error: "This account has been suspended." });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.accountType) ? next() : res.status(403).json({ error: "Not allowed" });
