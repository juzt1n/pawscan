import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { setup, teardown, app, registerAndLogin, jpeg, mockModel, user } from "./helpers.js";

let token;
beforeAll(async () => { await setup(); token = await registerAndLogin(); });
afterAll(teardown);

const analyze = (t = token) =>
  request(app).post("/api/analyze").set("Authorization", `Bearer ${t}`).attach("image", jpeg, "dog.jpg");

describe("Scanning, quota, history", () => {
  test("TC-SCAN-03 valid image accepted, model called", async () => {
    mockModel(0.9);
    const r = await analyze();
    expect(r.status).toBe(200);
    expect(fetch).toHaveBeenCalled();
  });

  test("invalid file bytes rejected", async () => {
    const r = await request(app).post("/api/analyze").set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("not an image at all"), "dog.jpg");
    expect(r.status).toBe(400);
  });

  test("TC-ADS-01 free quota runs out after 3 scans", async () => {
    mockModel();
    const t = await registerAndLogin({ ...user, email: "q@test.com" });
    for (let i = 0; i < 3; i++) expect((await analyze(t)).status).toBe(200);
    const r = await analyze(t);
    expect(r.status).toBe(429);
    expect(r.body.code).toBe("QUOTA_EXHAUSTED");
  });

  test("TC-ADS-01 quota resets after midnight", async () => {
    mockModel();
    const t = await registerAndLogin({ ...user, email: "m@test.com" });
    for (let i = 0; i < 3; i++) await analyze(t);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 24 * 3600 * 1000);
    expect((await analyze(t)).status).toBe(200);
    vi.useRealTimers();
  });

  test("TC-ADS-02 quota is per account, not per device", async () => {
    mockModel();
    const t1 = await registerAndLogin({ ...user, email: "d@test.com" });
    for (let i = 0; i < 3; i++) await analyze(t1);
    const login = await request(app).post("/api/auth/login").send({ email: "d@test.com", password: user.password });
    expect((await analyze(login.body.token)).status).toBe(429);
  });

  test("quota not deducted when model service is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const t = await registerAndLogin({ ...user, email: "f@test.com" });
    expect((await analyze(t)).status).toBe(503);
    mockModel();
    for (let i = 0; i < 3; i++) expect((await analyze(t)).status).toBe(200); // still has all 3
  });

  test("TC-SCAN-06/07 history newest first, delete removes record", async () => {
    const t = await registerAndLogin({ ...user, email: "h@test.com" });
    const auth = { Authorization: `Bearer ${t}` };
    const first = await request(app).post("/api/scans").set(auth).field("record", JSON.stringify({ breed: "Beagle", confidence: 0.8 })).attach("image", jpeg, "a.jpg");
    await new Promise((r) => setTimeout(r, 10));
    await request(app).post("/api/scans").set(auth).field("record", JSON.stringify({ breed: "Pug", confidence: 0.7 }));

    const list = await request(app).get("/api/scans").set(auth);
    expect(list.body.map((s) => s.breed)).toEqual(["Pug", "Beagle"]);

    expect((await request(app).delete(`/api/scans/${first.body.id}`).set(auth)).status).toBe(200);
    expect((await request(app).get(`/api/scans/${first.body.id}/image`).set(auth)).status).toBe(404);
    expect((await request(app).get("/api/scans").set(auth)).body).toHaveLength(1);
  });
});