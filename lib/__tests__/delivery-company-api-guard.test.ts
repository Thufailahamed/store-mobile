import { describe, expect, it } from "vitest";
import { normalizeDeliveryCompanyAccess } from "@/lib/delivery-company-api-guard";

describe("delivery-company-api-guard", () => {
  it("maps server access.reason to lockReason", () => {
    const access = normalizeDeliveryCompanyAccess(
      {
        hasCompany: true,
        status: "pending",
        isActive: false,
        isPendingReview: true,
        isRejected: false,
        isSuspended: false,
        canUseCompanyTools: false,
        canSetupCompany: true,
        reason: "Pending admin approval.",
      },
      { id: "1", name: "Co", slug: "co", status: "pending" }
    );
    expect(access.lockReason).toBe("Pending admin approval.");
    expect(access.canSetupCompany).toBe(true);
  });

  it("falls back to company status when access is missing", () => {
    const access = normalizeDeliveryCompanyAccess(null, { id: "1", name: "Co", slug: "co", status: "active" });
    expect(access.canUseCompanyTools).toBe(true);
  });
});
