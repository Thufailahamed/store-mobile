import { describe, it, expect } from "vitest";
import {
  getDeliveryCompanyAccessState,
  canAutoAssignLastMileOnReceive,
  shouldApplyDeliveryCompanyOperationsGuard,
  isMoreMenuItemAccessible,
} from "@/lib/delivery-company-access";

describe("delivery-company enforcement (mobile)", () => {
  it("store_owner bypasses delivery-company operator guard", () => {
    const suspended = getDeliveryCompanyAccessState({ status: "suspended" });
    expect(shouldApplyDeliveryCompanyOperationsGuard("store_owner")).toBe(false);
    expect(suspended.canUseCompanyTools).toBe(false);
  });

  it("blocks auto last-mile for non-active companies", () => {
    expect(
      canAutoAssignLastMileOnReceive({ status: "suspended", auto_assign_last_mile_on_receive: true })
    ).toBe(false);
  });

  it("locks operations menu items when company is not active", () => {
    const pending = getDeliveryCompanyAccessState({ status: "pending" });
    expect(isMoreMenuItemAccessible("setup", pending)).toBe(true);
    expect(isMoreMenuItemAccessible("operations", pending)).toBe(false);
  });
});
