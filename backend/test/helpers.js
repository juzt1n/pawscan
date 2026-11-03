import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { vi } from "vitest";

export let app, mongod;

export async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri(); // use whatever env name your db.js reads
  process.env.JWT_SECRET = "test-secret";
  process.env.MODEL_URL = "http://model.test";
  process.env.HF_TOKEN = "x";
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234"; // 32+ chars, in case auth.js checks
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";                    // in case stripe.js needs it at import
  const { connectDb } = await import("../src/db.js");   // adjust to your db.js export
  await connectDb();
  app = (await import("../src/app.js")).default;        // adjust to where your Express app is exported
}

export const teardown = () => mongod.stop();

export const user = { email: "a@test.com", password: "Passw0rd!", name: "A" };

export async function registerAndLogin(u = user) {
  const r = await request(app).post("/api/auth/register").send(u);
  return r.body.token;
}

export const bearer = (t) => ({ Authorization: `Bearer ${t}` });

export async function makeAdmin(email = "admin@test.com") {
  const { getDb } = await import("../src/db.js");
  const { createUser, signToken } = await import("../src/auth.js");
  await createUser({ email, password: "Passw0rd!", name: "Admin" });
  await getDb().collection("users").updateOne({ email }, { $set: { accountType: "admin" } });
  const u = await getDb().collection("users").findOne({ email });
  return { Authorization: `Bearer ${signToken(u)}` };
}

// valid JPEG magic bytes so detectImageType() passes
export const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

export function mockModel(conf = 0.9) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ predictions: [
      { breed: "Labrador Retriever", confidence: conf },
      { breed: "Golden Retriever", confidence: 0.05 },
      { breed: "Beagle", confidence: 0.02 },
    ] }),
  }));
}