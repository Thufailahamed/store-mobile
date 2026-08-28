import { describe, it, expect } from "vitest";
import { generateIdempotencyKey } from "../idempotency";

describe("generateIdempotencyKey", () => {
  it("returns string with expected shape (prefix-timestamp-random)", () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^luxe-[a-z0-9]{12}-[0-9a-f]{16}$/);
  });

  it("honours custom prefix", () => {
    expect(generateIdempotencyKey("wd")).toMatch(/^wd-[a-z0-9]{12}-[0-9a-f]{16}$/);
  });

  it("returns unique keys across calls", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(100);
  });

  it("timestamp portion is monotonically non-decreasing within a single tick window", async () => {
    const k1 = generateIdempotencyKey();
    await new Promise((r) => setTimeout(r, 2));
    const k2 = generateIdempotencyKey();
    const ts1 = k1.split("-")[1];
    const ts2 = k2.split("-")[1];
    // base36 compare — both padded to 12 chars
    expect(ts2 >= ts1).toBe(true);
  });
});
