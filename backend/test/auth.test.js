import { describe, test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { setup, teardown, app, user } from "./helpers.js";
import { getDb } from "../src/db.js";
import crypto from "node:crypto";

beforeAll(setup);
afterAll(teardown);

describe("Account & Authentication", () => {
  test("TC-ACC-01 register succeeds", async () => {
    const r = await request(app).post("/api/auth/register").send(user);
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
  });

  test("TC-ACC-02 duplicate email rejected", async () => {
    const r = await request(app).post("/api/auth/register").send(user);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/already registered/i);
  });

  test("TC-ACC-05 lockout after 5 failed logins", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong" });
      expect(r.status).toBe(401);
    }
    // 5th failure sets the lock; even the correct password is now blocked
    const r = await request(app).post("/api/auth/login").send(user);
    expect(r.status).toBe(423);
    expect(r.body.error).toMatch(/locked/i);
  });

  test("lock expires after 15 min", async () => {
    await getDb().collection("users").updateOne({ email: user.email }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    const r = await request(app).post("/api/auth/login").send(user);
    expect(r.status).toBe(200);
  });

  test("TC-ACC-08 forgot gives identical response for known and unknown email", async () => {
    const a = await request(app).post("/api/auth/forgot").send({ email: user.email });
    const b = await request(app).post("/api/auth/forgot").send({ email: "nobody@test.com" });
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  test("TC-ACC-07 expired reset token fails, password unchanged", async () => {
    const token = "a".repeat(64);
    await getDb().collection("users").updateOne(
      { email: user.email },
      { $set: { resetHash: crypto.createHash("sha256").update(token).digest("hex"), resetExpires: new Date(Date.now() - 1000) } }
    );
    const r = await request(app).post("/api/auth/reset").send({ token, password: "NewPassw0rd!" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/expired/i);
    const login = await request(app).post("/api/auth/login").send(user); // old password still works
    expect(login.status).toBe(200);
  });
});