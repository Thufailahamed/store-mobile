/**
 * createStoreCoupon — POST /api/seller/coupons facade.
 * Pinned so mobile seller dashboard can rely on shape + error handling.
 */

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }) },
  },
}));

vi.mock("@/lib/api/_fetch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/_fetch")>("@/lib/api/_fetch");
  return { ...actual, fetchJson: vi.fn() };
});

vi.mock("@/lib/api/backend", () => ({
  getSellerStoreBackend: vi.fn().mockResolvedValue({
    ok: true,
    data: { store: { id: "s1", name: "Test Store", status: "approved", slug: "t", description: null, owner_id: "u1", legal_name: null, tax_id: null, contact_phone: null, contact_email: null } },
  }),
  getSellerPayoutSettingsBackend: vi.fn().mockResolvedValue({
    ok: true,
    data: { settings: { bank_name: "Bank", account_name: "Owner", account_number_last4: "1234", tax_form_submitted: true } },
  }),
  getSellerComplianceDocsBackend: vi.fn().mockResolvedValue({
    ok: true,
    data: { documents: [] },
  }),
  createStoreCouponBackend: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as backend from "@/lib/api/backend";
import { createStoreCoupon } from "../index";
import type { AdminCoupon } from "../index";

const createBackendMock = vi.mocked(backend.createStoreCouponBackend);

const baseCoupon: Partial<AdminCoupon> = {
  code: "WELCOME10",
  type: "percentage",
  value: 10,
  scope: "all",
};

describe("createStoreCoupon facade", () => {
  beforeEach(() => createBackendMock.mockReset());

  it("POSTs to backend with remapped fields", async () => {
    createBackendMock.mockResolvedValue({ ok: true, data: { coupon: { id: "c1" } } });
    const res = await createStoreCoupon({ ...baseCoupon, min_order_total: 500, max_uses: 100 });
    expect(res.ok).toBe(true);
    expect(createBackendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "WELCOME10",
        discount_type: "percent",
        min_order_value: 500,
        usage_limit: 100,
      }),
    );
  });

  it("surfaces backend error on valid input", async () => {
    createBackendMock.mockResolvedValue({ ok: false, error: "duplicate_code" });
    const res = await createStoreCoupon(baseCoupon);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("duplicate_code");
  });

  it("rejects invalid type without hitting backend", async () => {
    const res = await createStoreCoupon({ ...baseCoupon, type: "unknown" as any });
    expect(res.ok).toBe(false);
    expect(createBackendMock).not.toHaveBeenCalled();
  });

  it("returns the created coupon on success", async () => {
    createBackendMock.mockResolvedValue({
      ok: true,
      data: { coupon: { id: "c2", code: "WELCOME10", discount_type: "percent", discount_value: 10, scope: "store", is_active: true } },
    });
    const res = await createStoreCoupon(baseCoupon);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe("c2");
  });

  it("does not turn the discount into a minimum order requirement", async () => {
    createBackendMock.mockResolvedValue({ ok: true, data: { coupon: { id: "c3" } } });
    // "Rs.500 off" with no stated minimum must not become "spend Rs.500".
    const res = await createStoreCoupon({ code: "FLAT500", type: "fixed", value: 500 });
    expect(res.ok).toBe(true);
    expect(createBackendMock).toHaveBeenCalledWith(
      expect.objectContaining({ discount_type: "fixed", discount_value: 500, min_order_value: 0 }),
    );
  });

  it("accepts a free_shipping coupon with no discount value", async () => {
    createBackendMock.mockResolvedValue({ ok: true, data: { coupon: { id: "c4" } } });
    const res = await createStoreCoupon({ code: "FREESHIP", type: "free_shipping", value: 0 });
    expect(res.ok).toBe(true);
    expect(createBackendMock).toHaveBeenCalledWith(
      expect.objectContaining({ discount_type: "free_shipping", discount_value: 0 }),
    );
  });

  it("rejects a percentage coupon above 100%", async () => {
    const res = await createStoreCoupon({ code: "TOOMUCH", type: "percentage", value: 150 });
    expect(res.ok).toBe(false);
    expect(createBackendMock).not.toHaveBeenCalled();
  });
});
