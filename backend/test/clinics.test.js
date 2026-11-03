import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { setup, teardown, app, registerAndLogin, makeAdmin, bearer, user } from "./helpers.js";
import { getDb } from "../src/db.js";

vi.mock("../src/geocode.js", () => ({
  geocodeSG: async (a) => ({
    "1 Near Road": { type: "Point", coordinates: [103.85, 1.30] },
    "2 Far Road":  { type: "Point", coordinates: [103.70, 1.35] },
  })[a] ?? null,
}));

let admin, owner;
const biz = (over = {}) => ({
  email: "clinic1@test.com", password: "Passw0rd!", clinicName: "Near Vet", uen: "201234567A",
  avsLicence: "AVS123", address: "1 Near Road", phone: "61234567", ...over,
});
let clinic1Id, clinic1Token, clinic2Id;

beforeAll(async () => {
  await setup();
  await getDb().collection("clinics").createIndex({ location: "2dsphere" }); // $geoNear needs this; skip if db.js already does it
  admin = await makeAdmin();
  owner = bearer(await registerAndLogin());
});
afterAll(teardown);

describe("Business registration and approval", () => {
  test("TC-ACC-03 business registers as pending", async () => {
    const r = await request(app).post("/api/businesses/register").send(biz());
    expect(r.status).toBe(201);
    expect(r.body.session.accountType).toBe("business");   // TC-ACC-04 API half
    expect(r.body.session.status).toBe("pending");
    clinic1Token = r.body.token;
    clinic1Id = r.body.session.businessId;
  });

  test("TC-ACC-03 pending clinic NOT in vet locator", async () => {
    const r = await request(app).get("/api/clinics/nearby").set(owner);
    expect(r.body.map((c) => c.id)).not.toContain(clinic1Id);
  });

  test("missing mandatory field rejected", async () => {
    const r = await request(app).post("/api/businesses/register").send(biz({ email: "x@test.com", uen: "" }));
    expect(r.status).toBe(400);
  });

  test("TC-SYS-03 admin approves, clinic appears and action is audited", async () => {
    const rev = await request(app).post(`/api/businesses/${clinic1Id}/review`).set(admin).send({ decision: "approved" });
    expect(rev.status).toBe(200);
    expect(rev.body.status).toBe("approved");

    const list = await request(app).get("/api/clinics/nearby").set(owner);
    expect(list.body.map((c) => c.id)).toContain(clinic1Id);

    const log = await request(app).get("/api/admin/audit").set(admin);
    expect(log.body[0].what).toMatch(/Approved business application/);
  });

  test("non-admin cannot review", async () => {
    const r = await request(app).post(`/api/businesses/${clinic1Id}/review`).set(owner).send({ decision: "approved" });
    expect(r.status).toBe(403);
  });

  test("rejected or suspended clinic is hidden", async () => {
    await request(app).post(`/api/businesses/${clinic1Id}/review`).set(admin).send({ decision: "suspended", reason: "test" });
    const list = await request(app).get("/api/clinics/nearby").set(owner);
    expect(list.body.map((c) => c.id)).not.toContain(clinic1Id);
    await request(app).post(`/api/businesses/${clinic1Id}/review`).set(admin).send({ decision: "approved" });
  });
});

describe("Vet locator and listing", () => {
  test("TC-VET-01 sorted by proximity with required fields", async () => {
    const r2 = await request(app).post("/api/businesses/register").send(biz({ email: "clinic2@test.com", clinicName: "Far Vet", address: "2 Far Road" }));
    clinic2Id = r2.body.session.businessId;
    await request(app).post(`/api/businesses/${clinic2Id}/review`).set(admin).send({ decision: "approved" });

    // user standing right next to "Near Road"
    const r = await request(app).get("/api/clinics/nearby?lat=1.30&lng=103.85").set(owner);
    expect(r.body[0].clinicName).toBe("Near Vet");
    expect(r.body[0].distanceKm).toBeLessThan(r.body[1].distanceKm);
    for (const k of ["address", "phone", "distanceKm", "lat", "lng"]) expect(r.body[0]).toHaveProperty(k);
  });

  test("locator requires login", async () => {
    expect((await request(app).get("/api/clinics/nearby")).status).toBe(401);
  });

  test("TC-VET-02 owner edit shows immediately in locator", async () => {
    const e = await request(app).patch(`/api/businesses/${clinic1Id}`).set(bearer(clinic1Token))
      .send({ hours: "Mon-Fri 9am-6pm", phone: "69998888" });
    expect(e.status).toBe(200);
    const list = await request(app).get("/api/clinics/nearby?lat=1.30&lng=103.85").set(owner);
    const c = list.body.find((x) => x.id === clinic1Id);
    expect(c.hours).toBe("Mon-Fri 9am-6pm");
    expect(c.phone).toBe("69998888");
  });

  test("another business cannot edit someone else's listing", async () => {
    const other = await request(app).post("/api/auth/login").send({ email: "clinic2@test.com", password: "Passw0rd!" });
    const r = await request(app).patch(`/api/businesses/${clinic1Id}`).set(bearer(other.body.token)).send({ phone: "1" });
    expect(r.status).toBe(403);
  });

  test("TC-VET-03 stats are anonymous counts over 30 days", async () => {
    const ev = (type) => request(app).post(`/api/clinics/${clinic1Id}/events`).set(owner).send({ type });
    await ev("view"); await ev("view"); await ev("directions"); await ev("call");

    // an old event must be excluded
    await getDb().collection("referral_events").insertOne({
      clinicId: (await getDb().collection("clinics").findOne({ clinicName: "Near Vet" }))._id,
      type: "view", createdAt: new Date(Date.now() - 40 * 86400000),
    });

    const s = await request(app).get("/api/businesses/me/stats").set(bearer(clinic1Token));
    expect(s.body).toEqual({ period: "30d", views: 2, directions: 1, calls: 1 });

    const stored = await getDb().collection("referral_events").findOne({});
    expect(stored.userId).toBeUndefined();   // no user id stored
  });

  test("invalid event type rejected", async () => {
    const r = await request(app).post(`/api/clinics/${clinic1Id}/events`).set(owner).send({ type: "hack" });
    expect(r.status).toBe(400);
  });
});