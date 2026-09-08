import { describe, expect, it } from "vitest";
import { SELLER_DASHBOARD_ACTIONS } from "../seller/dashboard-actions";

describe("SELLER_DASHBOARD_ACTIONS", () => {
  it("has exactly 6 actions in web-parity order", () => {
    expect(SELLER_DASHBOARD_ACTIONS.map((a) => a.key)).toEqual([
      "orders",
      "products",
      "payouts",
      "analytics",
      "returns",
      "alerts",
    ]);
  });

  it("keeps existing seller routes unchanged", () => {
    const routes = Object.fromEntries(
      SELLER_DASHBOARD_ACTIONS.map((a) => [a.key, a.route]),
    );
    expect(routes).toEqual({
      orders: "/(seller)/orders",
      products: "/(seller)/products",
      payouts: "/(seller)/payouts",
      analytics: "/(seller)/analytics",
      returns: "/(seller)/returns",
      alerts: "/(seller)/notifications",
    });
  });

  it("gives every action a label, hint, and icon", () => {
    for (const a of SELLER_DASHBOARD_ACTIONS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.hint.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });

  it("wires badges to returns and alerts only", () => {
    const badges = Object.fromEntries(
      SELLER_DASHBOARD_ACTIONS.map((a) => [a.key, a.badgeKey ?? null]),
    );
    expect(badges).toEqual({
      orders: null,
      products: null,
      payouts: null,
      analytics: null,
      returns: "returns",
      alerts: "alerts",
    });
  });
});
