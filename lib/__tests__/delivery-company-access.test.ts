import { describe, it, expect } from "vitest";
import { getDeliveryCompanyAccessState, isDeliveryCompanyAccessibleRoute } from "@/lib/delivery-company-access";

describe("delivery-company-access", () => {
  it("locks operations for non-active companies", () => {
    expect(getDeliveryCompanyAccessState({ status: "active" }).canUseCompanyTools).toBe(true);
    expect(getDeliveryCompanyAccessState({ status: "pending" }).canUseCompanyTools).toBe(false);
    expect(getDeliveryCompanyAccessState({ status: "suspended" }).canUseCompanyTools).toBe(false);
  });

  it("allows setup during pending review", () => {
    expect(getDeliveryCompanyAccessState({ status: "pending" }).canSetupCompany).toBe(true);
    expect(getDeliveryCompanyAccessState({ status: "suspended" }).canSetupCompany).toBe(false);
  });

  it("allows setup routes while pending", () => {
    const access = getDeliveryCompanyAccessState({ status: "pending" });
    expect(isDeliveryCompanyAccessibleRoute(["(delivery-company)", "drivers"], access)).toBe(true);
    expect(isDeliveryCompanyAccessibleRoute(["(delivery-company)", "more"], access)).toBe(true);
    expect(isDeliveryCompanyAccessibleRoute(["(delivery-company)", "packages"], access)).toBe(false);
  });
});
