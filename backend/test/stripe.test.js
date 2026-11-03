import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { setup, teardown, app, registerAndLogin, bearer, user } from "./helpers.js";
import { getDb } from "../src/db.js";

const stripeMock = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn() }));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: stripeMock.create, retrieve: stripeMock.retrieve } };
  },
}));

let auth, otherAuth, myId, otherId;
const tierOf = async (a) => (await request(app).get("/api/me").set(a)).body.tier;

beforeAll(async () => {
  process.env.PUBLIC_BASE_URL = "http://localhost:3001";
  await setup();
  auth = bearer(await registerAndLogin());
  otherAuth = bearer(await registerAndLogin({ ...user, email: "other@test.com" }));
  const users = getDb().collection("users");
  myId = String((await users.findOne({ email: user.email }))._id);
  otherId = String((await users.findOne({ email: "other@test.com" }))._id);
});
afterAll(teardown);

describe("TC-ADS-04 premium upgrade via Stripe", () => {
  test("checkout session requires login", async () => {
    expect((await request(app).post("/api/stripe/create-checkout-session")).status).toBe(401);
  });

  test("checkout session returns a URL and carries the user id", async () => {
    stripeMock.create.mockResolvedValue({ url: "https://checkout.stripe.test/x", id: "cs_1" });
    const r = await request(app).post("/api/stripe/create-checkout-session").set(auth);
    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^https:/);
    expect(stripeMock.create.mock.calls[0][0].metadata.userId).toBe(myId);
  });

  test("missing sessionId rejected", async () => {
    expect((await request(app).post("/api/stripe/activate-premium").set(auth).send({})).status).toBe(400);
  });

  test("unpaid session does NOT upgrade", async () => {
    stripeMock.retrieve.mockResolvedValue({ payment_status: "unpaid", metadata: { userId: myId } });
    const r = await request(app).post("/api/stripe/activate-premium").set(auth).send({ sessionId: "cs_unpaid" });
    expect(r.status).toBe(400);
    expect(await tierOf(auth)).toBe("free");
  });

  test("someone else's paid session is rejected (fails until Bug 1 is fixed)", async () => {
    stripeMock.retrieve.mockResolvedValue({ payment_status: "paid", payment_intent: "pi_x", metadata: { userId: otherId } });
    const r = await request(app).post("/api/stripe/activate-premium").set(auth).send({ sessionId: "cs_other" });
    expect(r.status).toBe(403);
    expect(await tierOf(auth)).toBe("free");
  });

  test("own paid session upgrades to premium", async () => {
    stripeMock.retrieve.mockResolvedValue({ payment_status: "paid", payment_intent: "pi_1", metadata: { userId: myId } });
    const r = await request(app).post("/api/stripe/activate-premium").set(auth).send({ sessionId: "cs_ok" });
    expect(r.status).toBe(200);
    expect(await tierOf(auth)).toBe("premium");
  });

  test("TC-ADS-05 premium sees unlimited quota", async () => {
    const q = await request(app).get("/api/quota").set(auth);
    expect(q.body.remaining).toBeNull();
  });

  test("free users cannot self-upgrade without paying (fails if /me/upgrade still exists)", async () => {
    const r = await request(app).post("/api/me/upgrade").set(otherAuth);
    expect(r.status).not.toBe(200);
    expect(await tierOf(otherAuth)).toBe("free");
  });
});