import { connectMongo } from "./mongo.js";

let db;

export const getDb = () => {
  if (!db) throw new Error("Database not connected yet");
  return db;
};

export async function connectDb() {
  const client = await connectMongo();
  db = client.db(process.env.DB_NAME || "pawscan");

  // Indexes from Section 10.2 of the Final Tech Doc
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ resetHash: 1 }, { sparse: true });
  await db.collection("scans").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("dogs").createIndex({ ownerId: 1 });
  await db.collection("clinics").createIndex({ location: "2dsphere" });
  await db.collection("clinics").createIndex({ status: 1 });
  await db.collection("referral_events").createIndex({ clinicId: 1, createdAt: -1 });
  await db.collection("audit_logs").createIndex({ createdAt: -1 });
  return db;
}
