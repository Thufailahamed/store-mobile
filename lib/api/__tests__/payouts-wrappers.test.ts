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
});
