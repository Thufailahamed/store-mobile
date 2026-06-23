import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

/**
 * Coupon-hardening tests for the mobile API surface. Pins the contract
 * of the fixes in lib/api/index.ts and the seller coupon screen.
 */
describe("mobile coupon API — getStoreCoupons", () => {
  const api = readFileSync(join(root, "lib/api/index.ts"), "utf8");

  it("delegates to the backend API instead of querying coupons directly", () => {
    // Pre-migration: used `from("coupons")` with `.eq("scope", storeId)` or
    // `.or(...)`. Post-migration: delegates to B.getStoreCouponsBackend().
    expect(api).not.toMatch(/from\("coupons"\)[\s\S]{0,200}\.eq\("scope", storeId\)/);
    expect(api).toMatch(/getStoreCouponsBackend/);
  });
});

describe("mobile coupon API — input validation", () => {
  const api = readFileSync(join(root, "lib/api/index.ts"), "utf8");

  it("createStoreCoupon validates via Zod before inserting", () => {
    expect(api).toMatch(/createStoreCoupon[\s\S]{0,300}CouponCreateSchema\.safeParse/);
  });

  it("createCoupon validates via Zod before inserting", () => {
    expect(api).toMatch(/createCoupon[\s\S]{0,300}CouponCreateSchema\.safeParse/);
  });

  it("rejects percentage > 100", () => {
    expect(api).toMatch(/Percentage coupons cannot exceed 100%/);
  });

  it("rejects expires_at <= starts_at", () => {
    expect(api).toMatch(/expires_at must be after starts_at/);
  });
});

describe("mobile seller coupon screen — BXGY badge", () => {
  const screen = readFileSync(join(root, "app/(seller)/coupons/index.tsx"), "utf8");

  it("renders a distinct badge for bxgy type", () => {
    // Pre-fix: bxgy fell through to "FREE" badge (free_shipping style).
    expect(screen).toMatch(/typeBadgeStyle/);
    expect(screen).toMatch(/case "bxgy":\s*return s\.badgeBxgy/);
    expect(screen).toMatch(/function typeBadgeLabel/);
    expect(screen).toMatch(/coupon\.type === "bxgy"\)?\s*return "BXGY"/);
  });
});
