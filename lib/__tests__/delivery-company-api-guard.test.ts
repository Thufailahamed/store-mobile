import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertDeliveryCompanyOperations,
  assertDeliveryCompanySetup,
  normalizeDeliveryCompanyAccess,
} from "@/lib/delivery-company-api-guard";

vi.mock("@/lib/api/delivery-company-api", () => ({
  getDeliveryCompanyMe: vi.fn(),
}));

import { getDeliveryCompanyMe } from "@/lib/api/delivery-company-api";

const company = { id: "1", name: "Co", slug: "co", status: "active" as const };

describe("delivery-company-api-guard", () => {
  beforeEach(() => {
    vi.mocked(getDeliveryCompanyMe).mockReset();
  });

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
      company,
    );
    expect(access.lockReason).toBe("Pending admin approval.");
    expect(access.canSetupCompany).toBe(true);
  });

  it("falls back to company status when access is missing", () => {
    const access = normalizeDeliveryCompanyAccess(null, company);
    expect(access.canUseCompanyTools).toBe(true);
  });

  it("assertDeliveryCompanyOperations blocks when tools are locked", async () => {
    vi.mocked(getDeliveryCompanyMe).mockResolvedValue({
      ok: true,
      data: {
        company,
        access: {
          canUseCompanyTools: false,
          canSetupCompany: false,
          reason: "Company suspended.",
        },
      },
    });
    const res = await assertDeliveryCompanyOperations();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Company suspended.");
  });

  it("assertDeliveryCompanyOperations allows active companies", async () => {
    vi.mocked(getDeliveryCompanyMe).mockResolvedValue({
      ok: true,
      data: {
        company,
        access: {
          canUseCompanyTools: true,
          canSetupCompany: true,
        },
      },
    });
    const res = await assertDeliveryCompanyOperations();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe("1");
  });

  it("assertDeliveryCompanySetup blocks when setup is locked", async () => {
    vi.mocked(getDeliveryCompanyMe).mockResolvedValue({
      ok: true,
      data: {
        company: { ...company, status: "pending" },
        access: {
          canUseCompanyTools: false,
          canSetupCompany: false,
          reason: "Pending admin approval.",
        },
      },
    });
    const res = await assertDeliveryCompanySetup();
    expect(res.ok).toBe(false);
  });

  it("assertDeliveryCompanySetup allows owners during onboarding", async () => {
    vi.mocked(getDeliveryCompanyMe).mockResolvedValue({
      ok: true,
      data: {
        company: { ...company, status: "pending" },
        access: {
          canUseCompanyTools: false,
          canSetupCompany: true,
        },
      },
    });
    const res = await assertDeliveryCompanySetup();
    expect(res.ok).toBe(true);
  });
});
