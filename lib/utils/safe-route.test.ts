import { describe, it, expect } from "vitest";
import { isAllowedRoute, mapWebPathToMobileRoute, isUuid, sanitizeSlug } from "./safe-route";

describe("safe-route utils", () => {
  it("validates allowed static routes", () => {
    expect(isAllowedRoute("/(main)/cart")).toBe(true);
    expect(isAllowedRoute("/(main)/notifications")).toBe(true);
    expect(isAllowedRoute("/(main)/account/orders")).toBe(true);
    expect(isAllowedRoute("/(seller)/notifications")).toBe(true);
    expect(isAllowedRoute("/(brand)/more/notifications")).toBe(true);
  });

  it("validates allowed dynamic routes", () => {
    expect(isAllowedRoute("/(main)/products/silk-shirt")).toBe(true);
    expect(isAllowedRoute("/(main)/account/orders/11111111-2222-3333-4444-555555555555")).toBe(true);
    expect(isAllowedRoute("/(delivery)/orders/11111111-2222-3333-4444-555555555555")).toBe(true);
  });

  it("rejects unauthorized routes", () => {
    expect(isAllowedRoute("/evil-screen")).toBe(false);
    expect(isAllowedRoute("/admin/secret")).toBe(false);
    expect(isAllowedRoute("javascript:alert(1)")).toBe(false);
  });

  it("maps web paths to mobile router routes", () => {
    expect(mapWebPathToMobileRoute("/cart")).toBe("/(main)/cart");
    expect(mapWebPathToMobileRoute("/notifications")).toBe("/(main)/notifications");
    expect(mapWebPathToMobileRoute("/account/orders")).toBe("/(main)/account/orders");
    expect(mapWebPathToMobileRoute("/products/linen-dress")).toBe("/(main)/products/linen-dress");
    expect(mapWebPathToMobileRoute("/account/gift-cards")).toBe("/(main)/account/gift-cards");
    expect(mapWebPathToMobileRoute("/(main)/cart")).toBe("/(main)/cart");
  });

  it("handles query params in web path mapping", () => {
    expect(mapWebPathToMobileRoute("/cart?coupon=LUXE10")).toBe("/(main)/cart?coupon=LUXE10");
  });

  it("rejects invalid or unsafe web paths", () => {
    expect(mapWebPathToMobileRoute("https://external.com")).toBe(null);
    expect(mapWebPathToMobileRoute("/invalid-path-not-in-routes")).toBe(null);
    expect(mapWebPathToMobileRoute("")).toBe(null);
  });

  it("validates UUIDs correctly", () => {
    expect(isUuid("11111111-2222-3333-4444-555555555555")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("sanitizes slugs correctly", () => {
    expect(sanitizeSlug("silk-shirt_2026")).toBe("silk-shirt_2026");
    expect(sanitizeSlug("silk/shirt../")).toBe("silkshirt");
  });
});
