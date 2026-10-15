   import "dotenv/config";
   import { connectMongo } from "./src/mongo.js";
   import bcrypt from "bcryptjs";

   const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
   const pw = process.env.ADMIN_PASSWORD;
   if (!email || !pw) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first");

   const c = await connectMongo();
   const r = await c.db(process.env.DB_NAME || "pawscan").collection("users").updateOne(
     { email, accountType: "admin" },
     { $set: { passwordHash: await bcrypt.hash(pw, 12), failedLogins: 0, lockUntil: null } }
   );
   console.log("admin accounts updated:", r.modifiedCount, "| email:", email, "| password length:", pw.length);
   await c.close();