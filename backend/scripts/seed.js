// Run once after setting .env:  npm run seed
// Add --force to overwrite breeds/conditions (this discards admin edits).
import "dotenv/config";
import fs from "node:fs/promises";
import { connectMongo } from "../src/mongo.js";
import bcrypt from "bcryptjs";

const force = process.argv.includes("--force");
// Reads backend/data/ if present, otherwise the app's data/ folder (combined repo)
const read = async (name) => {
  for (const p of [`../data/${name}`, `../../data/${name}`]) {
    try { return JSON.parse(await fs.readFile(new URL(p, import.meta.url), "utf8")); } catch { /* try next */ }
  }
  throw new Error(`Could not find ${name} in backend/data or data/`);
};

const client = await connectMongo();
const db = client.db(process.env.DB_NAME || "pawscan");

// 1) Breeds (breed_health.json) and conditions (conditions.json)
async function load(file, collection, skipPrefix = "_", keep = []) {
  const data = await read(file);
  const col = db.collection(collection);
  let n = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(skipPrefix) && !keep.includes(key)) continue; // skips "_meta" / "_note"
    await col.updateOne({ _id: key }, force ? { $set: value } : { $setOnInsert: value }, { upsert: true });
    n++;
  }
  console.log(`${collection}: ${n} entries processed`);
}
await load("breed_health.json", "breeds", "_", ["_default"]); // keep the "_default" fallback entry
await load("conditions.json", "conditions");

// 2) Demo clinics so the vet locator is not empty (coordinates are approximate)
const demo = [
  { clinicName: "Pawsitive Veterinary Clinic", address: "12 Bukit Timah Road, S229899", phone: "62345678", hours: "Mon-Sat 9am-7pm", lng: 103.8385, lat: 1.3074 },
  { clinicName: "Riverside Animal Hospital", address: "88 Clarke Quay, S179020", phone: "63456789", hours: "Open 24 hours", lng: 103.8465, lat: 1.2906 },
  { clinicName: "Sunny Paws Vet Care", address: "5 Tampines Central, S529509", phone: "67890123", hours: "Daily 10am-8pm", lng: 103.9436, lat: 1.3544 },
  { clinicName: "Orchard Pet Wellness", address: "230 Orchard Road, S238854", phone: "68901234", hours: "Mon-Fri 9am-6pm", lng: 103.8318, lat: 1.3048 },
];
for (const { lng, lat, ...c } of demo) {
  await db.collection("clinics").updateOne(
    { clinicName: c.clinicName, ownerId: null },
    { $setOnInsert: { ...c, ownerId: null, uen: "DEMO", avsLicence: "DEMO", status: "approved", reviewReason: null, location: { type: "Point", coordinates: [lng, lat] }, createdAt: new Date(), reviewedAt: null } },
    { upsert: true }
  );
}
console.log("demo clinics ready");

// 3) Admin account
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
if (email && process.env.ADMIN_PASSWORD) {
  const exists = await db.collection("users").findOne({ email });
  if (!exists) {
    await db.collection("users").insertOne({
      email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), name: "System Admin", phone: "",
      accountType: "admin", tier: "free", status: "active", quota: { date: "", used: 0, bonus: 0 },
      bookmarks: [], failedLogins: 0, lockUntil: null, createdAt: new Date(),
    });
    console.log(`admin created: ${email}`);
  } else {
    console.log(`admin already exists: ${email}`);
  }
}

await client.close();
