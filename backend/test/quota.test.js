import { describe, test, expect, vi, afterEach } from "vitest";
import { currentQuota, remainingScans } from "../src/util.js";

afterEach(() => vi.useRealTimers());

describe("TC-ADS-01 quota resets at SGT midnight", () => {
  const user = { tier: "free", quota: { date: "2026-11-04", used: 3, bonus: 0 } };

  test("23:59 SGT same day: still 0 left", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-04T15:59:00Z")); // 23:59 SGT
    expect(remainingScans(user)).toBe(0);
  });

  test("00:01 SGT next day: full 3 again", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-04T16:01:00Z")); // 00:01 SGT on 5 Nov
    expect(remainingScans(user)).toBe(3);
    expect(currentQuota(user).used).toBe(0);
  });

  test("ad bonus adds to the limit", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-04T05:00:00Z"));
    expect(remainingScans({ ...user, quota: { ...user.quota, bonus: 1 } })).toBe(1);
  });

  test("premium is unlimited (null)", () => {
    expect(remainingScans({ ...user, tier: "premium" })).toBeNull();
  });
});