import { describe, expect, it } from "vitest";
import { SELLER_DASHBOARD_ACTIONS } from "../seller/dashboard-actions";

describe("SELLER_DASHBOARD_ACTIONS", () => {
  it("keeps the mobile dashboard focused on daily seller operations", () => {
    expect(SELLER_DASHBOARD_ACTIONS.map((a) => a.key)).toEqual([
      "orders",
      "products",
      "inventory",
      "payouts",
    ]);
  });

  it("keeps existing seller routes unchanged", () => {
    const routes = Object.fromEntries(
      SELLER_DASHBOARD_ACTIONS.map((a) => [a.key, a.route]),
    );
    expect(routes).toEqual({
      orders: "/(seller)/orders",
      products: "/(seller)/products",
      inventory: "/(seller)/inventory",
      payouts: "/(seller)/payouts",
    });
  });

  it("gives every action a label, hint, and icon", () => {
    for (const a of SELLER_DASHBOARD_ACTIONS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.hint.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });

  it("does not duplicate attention badges already shown in the dashboard summary", () => {
    expect(SELLER_DASHBOARD_ACTIONS.every((a) => a.badgeKey == null)).toBe(true);
  });
});
