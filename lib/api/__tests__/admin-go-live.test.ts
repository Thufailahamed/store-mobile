vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: () => {
      throw new Error("supabase should not be hit when backend succeeds");
    },
  },
}));

vi.mock("../backend", () => ({
  getAdminStoreDetailBackend: vi.fn(),
  getAdminDeliveryCompaniesBackend: vi.fn(),
  getAdminDeliveryCompanyBackend: vi.fn(),
  updateAdminDeliveryCompanyBackend: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAdminStoreDetail,
  getAdminDeliveryCompanyDetail,
  updateAdminDeliveryCompanyStatus,
} from "../index";
import * as B from "../backend";

describe("admin go-live: store detail returns real data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps backend store detail instead of returning null", async () => {
    vi.mocked(B.getAdminStoreDetailBackend).mockResolvedValueOnce({
      ok: true,
      data: {
        store: { id: "s1", name: "Aura", slug: "aura", status: "pending" },
        owner: { id: "u1", full_name: "Ama" },
        products: [{ id: "p1", name: "Dress", status: "active" }],
      } as any,
    });
    const res = await getAdminStoreDetail("s1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).not.toBeNull();
      expect(res.data?.store.name).toBe("Aura");
    }
  });
});

describe("admin go-live: delivery company detail + status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves company detail from real backend data", async () => {
    vi.mocked(B.getAdminDeliveryCompaniesBackend).mockResolvedValueOnce({
      ok: true,
      data: {
        companies: [
          { id: "c1", name: "FastX", slug: "fastx", status: "pending" },
        ],
      } as any,
    });
    const res = await getAdminDeliveryCompanyDetail("c1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.company.id).toBe("c1");
      expect(res.data.company.name).toBe("FastX");
    }
  });

  it("maps active status to approved flags on update", async () => {
    vi.mocked(B.updateAdminDeliveryCompanyBackend).mockResolvedValueOnce({
      ok: true,
      data: { company: { id: "c1" } } as any,
    });
    const res = await updateAdminDeliveryCompanyStatus("c1", "active");
    expect(res.ok).toBe(true);
    expect(B.updateAdminDeliveryCompanyBackend).toHaveBeenCalledWith("c1", {
      is_approved: true,
      is_active: true,
    });
  });
});
