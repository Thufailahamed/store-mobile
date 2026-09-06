import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

import {
  getPayoutsBackend,
  updatePayoutSettingsBackend,
  getPayoutBalanceBackend,
  createStripeConnectLinkBackend,
  withdrawPayoutBackend,
  getPayoutDetailBackend,
} from "@/lib/api/backend";

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe("payouts wrappers", () => {
  it("getPayoutsBackend hits GET /api/seller/payouts", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { payouts: [], payout: null } });
    await getPayoutsBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts");
  });

  it("updatePayoutSettingsBackend PATCHes settings", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { payout: { method: "bank" } } });
    await updatePayoutSettingsBackend({ method: "bank", schedule: "weekly" });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts", {
      method: "PATCH",
      body: { method: "bank", schedule: "weekly" },
    });
  });

  it("getPayoutBalanceBackend hits /balance", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { available: 0, currency: "LKR" } });
    await getPayoutBalanceBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts/balance");
  });

  it("createStripeConnectLinkBackend POSTs /connect", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { url: "x", accountId: "y" } });
    await createStripeConnectLinkBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts/connect", { method: "POST" });
  });

  it("withdrawPayoutBackend POSTs /withdraw with Idempotency-Key header", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { id: "p1", amount: 1000, status: "pending" } });
    await withdrawPayoutBackend({ amount: 1000, idempotencyKey: "wd-test-123" });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts/withdraw", {
      method: "POST",
      body: { amount: 1000 },
      headers: { "Idempotency-Key": "wd-test-123" },
    });
  });

  it("getPayoutDetailBackend hits /api/seller/payouts/:id with encoded id", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { payout: { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", amount: 100 } } });
    await getPayoutDetailBackend("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts/a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("getPayoutDetailBackend does not call the API for reserved paths", async () => {
    const res = await getPayoutDetailBackend("balance");
    expect(res.ok).toBe(false);
    expect(fetchJsonMock).not.toHaveBeenCalled();
  });
});

describe("seller payout settings wrappers", () => {
  it("getSellerPayoutSettingsBackend reads GET /api/seller/payouts (not /settings)", async () => {
    const { getSellerPayoutSettingsBackend } = await import("@/lib/api/backend");
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { payouts: [], payout: { method: "bank", kyc_status: "approved" } },
    });
    const res = await getSellerPayoutSettingsBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.settings).toMatchObject({ method: "bank", kyc_status: "approved" });
    }
  });

  it("upsertSellerPayoutSettingsBackend PATCHes /api/seller/payouts", async () => {
    const { upsertSellerPayoutSettingsBackend } = await import("@/lib/api/backend");
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { payout: { method: "upi", upi: "a@b" } },
    });
    const res = await upsertSellerPayoutSettingsBackend({ method: "upi", upi: "a@b" });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/payouts", {
      method: "PATCH",
      body: { method: "upi", upi: "a@b" },
    });
    expect(res.ok).toBe(true);
  });
});
