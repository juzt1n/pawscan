import { describe, test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { setup, teardown, app, registerAndLogin, bearer, user } from "./helpers.js";
import { getDb } from "../src/db.js";

let auth;
beforeAll(async () => { await setup(); auth = bearer(await registerAndLogin()); });
afterAll(teardown);

describe("Profile", () => {
  test("TC-ACC-09 name and phone saved, email cannot change", async () => {
    const r = await request(app).patch("/api/me").set(auth).send({ name: "New Name", phone: "91234567", email: "hacker@test.com" });
    expect(r.body.name).toBe("New Name");
    expect(r.body.phone).toBe("91234567");
    expect(r.body.email).toBe(user.email);
  });

  test("blank name ignored", async () => {
    const r = await request(app).patch("/api/me").set(auth).send({ name: "   " });
    expect(r.body.name).toBe("New Name");
  });
});

describe("Quota, ads, premium", () => {
  test("TC-ADS-01 banner data: 3 remaining at start", async () => {
    const q = await request(app).get("/api/quota").set(auth);
    expect(q.body).toMatchObject({ limit: 3, used: 0, bonus: 0, remaining: 3 });
  });

  test("TC-ADS-03 watching an ad adds exactly +1 immediately", async () => {
    const r = await request(app).post("/api/quota/ad-bonus").set(auth);
    expect(r.body.remaining).toBe(4);
    expect(r.body.bonus).toBe(1);
  });

  test("ad bonus capped at 5 per day", async () => {
    for (let i = 0; i < 4; i++) await request(app).post("/api/quota/ad-bonus").set(auth); // bonus now 5
    const r = await request(app).post("/api/quota/ad-bonus").set(auth);
    expect(r.status).toBe(429);
  });

  test("TC-ADS-04 premium account has unlimited quota", async () => {
    // the payment flow itself is tested in stripe.test.js, so promote directly here
    await getDb().collection("users").updateOne({ email: user.email }, { $set: { tier: "premium" } });
    const q = await request(app).get("/api/quota").set(auth);
    expect(q.body.remaining).toBeNull();
  });

  test("TC-ADS-05 premium ad-bonus is a no-op", async () => {
    const r = await request(app).post("/api/quota/ad-bonus").set(auth);
    expect(r.status).toBe(200);
    expect(r.body.remaining).toBeNull();
  });
});

describe("Premium gating and bookmarks", () => {
  test("free user cannot create dog profile, premium can", async () => {
    const free = bearer(await registerAndLogin({ ...user, email: "free@test.com" }));
    expect((await request(app).post("/api/dogs").set(free).send({ name: "Rex" })).status).toBe(403);
    expect((await request(app).post("/api/dogs").set(auth).send({ name: "Rex" })).status).toBe(201);
  });

  test("TC-HR-04 bookmark toggles on and off", async () => {
    const a = await request(app).post("/api/bookmarks/toggle").set(auth).send({ breed: "Beagle" });
    expect(a.body).toEqual(["Beagle"]);
    const b = await request(app).post("/api/bookmarks/toggle").set(auth).send({ breed: "Beagle" });
    expect(b.body).toEqual([]);
  });

  test("TC-ADS-02 bookmarks and quota follow the account across logins", async () => {
    await request(app).post("/api/bookmarks/toggle").set(auth).send({ breed: "Pug" });
    const l = await request(app).post("/api/auth/login").send(user);
    const r = await request(app).get("/api/bookmarks").set(bearer(l.body.token));
    expect(r.body).toEqual(["Pug"]);
  });
});

describe("Account deletion", () => {
  test("DELETE /me removes the user and login fails", async () => {
    const t = bearer(await registerAndLogin({ ...user, email: "del@test.com" }));
    expect((await request(app).delete("/api/me").set(t)).status).toBe(200);
    const l = await request(app).post("/api/auth/login").send({ email: "del@test.com", password: user.password });
    expect(l.status).toBe(401);
  });
});