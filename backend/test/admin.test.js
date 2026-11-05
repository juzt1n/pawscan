import { describe, test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "node:fs/promises";
import { setup, teardown, app, registerAndLogin, user } from "./helpers.js";
import { getDb } from "../src/db.js";
import { createUser, signToken } from "../src/auth.js";

let adminAuth, ownerAuth, ownerId, breedKey, original;

beforeAll(async () => {
  await setup();

  // admin: create a normal user, then promote directly in the DB
  await createUser({ email: "admin@test.com", password: "Passw0rd!", name: "Admin" });
  await getDb().collection("users").updateOne({ email: "admin@test.com" }, { $set: { accountType: "admin" } });
  const admin = await getDb().collection("users").findOne({ email: "admin@test.com" });
  adminAuth = { Authorization: `Bearer ${signToken(admin)}` };

  // owner
  const t = await registerAndLogin();
  ownerAuth = { Authorization: `Bearer ${t}` };
  ownerId = String((await getDb().collection("users").findOne({ email: user.email }))._id);

  // seed one breed using the first key in the shipped JSON, so reset has something to restore
  const all = JSON.parse(await fs.readFile(new URL("../../data/breed_health.json", import.meta.url), "utf8"));
  breedKey = Object.keys(all).find((k) => !k.startsWith("_"));
  original = all[breedKey];
  await getDb().collection("breeds").insertOne({ _id: breedKey, ...original });
});
afterAll(teardown);

describe("System Admin and Audit", () => {
  test("admin routes reject non-admins", async () => {
    expect((await request(app).get("/api/admin/users").set(ownerAuth)).status).toBe(403);
  });

  test("TC-SYS-01 edit breed shows publicly and is tagged edited", async () => {
    const body = {
      profile: { size: "Test size", lifespan: "10", temperament: "Calm" },
      watchlist: [{ condition: "Test Condition", risk: "high", earlySigns: "x", prevention: "y" }],
      careTips: ["Tip 1"],
    };
    const put = await request(app).put(`/api/admin/breeds/${encodeURIComponent(breedKey)}`).set(adminAuth).send(body);
    expect(put.status).toBe(200);

    const pub = await request(app).get("/api/breeds/edited"); // no auth needed
    expect(pub.body[breedKey].watchlist[0].condition).toBe("Test Condition");
    expect(pub.body[breedKey].editedAt).toBeTruthy();
  });

  test("TC-SYS-01 reset restores factory data and removes edited tag", async () => {
    const del = await request(app).delete(`/api/admin/breeds/${encodeURIComponent(breedKey)}`).set(adminAuth);
    expect(del.status).toBe(200);
    const pub = await request(app).get("/api/breeds/edited");
    expect(pub.body[breedKey]).toBeUndefined();
    const doc = await getDb().collection("breeds").findOne({ _id: breedKey });
    expect(doc.watchlist).toEqual(original.watchlist);
  });

  test("TC-SYS-01 edit with no condition rejected", async () => {
    const r = await request(app).put(`/api/admin/breeds/${encodeURIComponent(breedKey)}`).set(adminAuth).send({ watchlist: [] });
    expect(r.status).toBe(400);
  });

  test("TC-SYS-02 suspend blocks login and is audited", async () => {
    const s = await request(app).patch(`/api/admin/users/${ownerId}/status`).set(adminAuth).send({ status: "suspended" });
    expect(s.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send(user);
    expect(login.status).toBe(403);
    expect(login.body.error).toMatch(/suspended/i);

    const log = await request(app).get("/api/admin/audit").set(adminAuth);
    expect(log.body[0].what).toMatch(/Suspended user account/);
  });

  test("TC-SYS-02 reactivate restores login", async () => {
    await request(app).patch(`/api/admin/users/${ownerId}/status`).set(adminAuth).send({ status: "active" });
    expect((await request(app).post("/api/auth/login").send(user)).status).toBe(200);
    const log = await request(app).get("/api/admin/audit").set(adminAuth);
    expect(log.body[0].what).toMatch(/Reactivated/);
  });

  test("admin accounts cannot be suspended", async () => {
    const admin = await getDb().collection("users").findOne({ email: "admin@test.com" });
    const r = await request(app).patch(`/api/admin/users/${admin._id}/status`).set(adminAuth).send({ status: "suspended" });
    expect(r.status).toBe(403);
  });

  test("TC-SYS-04 analytics returns metrics and 12-day trend", async () => {
    const r = await request(app).get("/api/admin/analytics").set(adminAuth);
    expect(r.status).toBe(200);
    expect(r.body.totalUsers).toBe(1);            // admin not counted
    expect(r.body.scanTrend).toHaveLength(12);
    expect(r.body).toHaveProperty("activeSubscriptions");
  });

  test("TC-SYS-04 audit log is append-only", async () => {
    const before = (await getDb().collection("audit_logs").countDocuments());
    await request(app).post("/api/admin/audit").set(adminAuth).send({ what: "manual entry", kind: "info" }).expect(201);
    expect(await getDb().collection("audit_logs").countDocuments()).toBe(before + 1);

    // no edit or delete endpoints exist
    expect((await request(app).put("/api/admin/audit").set(adminAuth).send({})).status).toBe(404);
    expect((await request(app).delete("/api/admin/audit").set(adminAuth)).status).toBe(404);

    // newest first
    const log = await request(app).get("/api/admin/audit").set(adminAuth);
    expect(log.body[0].what).toBe("manual entry");
  });
});