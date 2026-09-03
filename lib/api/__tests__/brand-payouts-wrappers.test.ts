/**
 * Brand payouts wrapper tests (slice 0310).
 *
 * Verifies the API wrappers delegate to fetchJson with correct args
 * (path, method, body, Idempotency-Key header).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

import {
  getBrandPayoutSettingsBackend,
  updateBrandPayoutSettingsBackend,
  withdrawBrandBackend,
} from "@/lib/api/backend";

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe("brand payouts wrappers", () => {
  it("getBrandPayoutSettingsBackend hits GET /api/brand/payouts/settings", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { payout: null } });
    const res = await getBrandPayoutSettingsBackend();
    expect(res.ok).toBe(true);
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/brand/payouts/settings");
  });

  it("updateBrandPayoutSettingsBackend PATCHes bank settings", async () => {
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { payout: { method: "bank", bank_name: "BOC" } },
    });
    await updateBrandPayoutSettingsBackend({
      method: "bank",
      bank_name: "BOC",
      account_name: "Test",
      account_number_last4: "1234",
    });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/brand/payouts/settings", {
      method: "PATCH",
      body: {
        method: "bank",
        bank_name: "BOC",
        account_name: "Test",
        account_number_last4: "1234",
      },
    });
  });

  it("updateBrandPayoutSettingsBackend PATCHes PayPal settings", async () => {
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { payout: { method: "paypal" } },
    });
    await updateBrandPayoutSettingsBackend({ method: "paypal", paypal: "test@example.com" });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/brand/payouts/settings", {
      method: "PATCH",
      body: { method: "paypal", paypal: "test@example.com" },
    });
  });

  it("withdrawBrandBackend POSTs amount + Idempotency-Key", async () => {
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: {
        payout: { id: "p1", amount: 5000, currency: "LKR", status: "requested" },
        ledger_entries: 2,
      },
    });
    const res = await withdrawBrandBackend(5000, "key-abc-123");
    expect(res.ok).toBe(true);
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/brand/payouts/withdraw", {
      method: "POST",
      body: { amount: 5000 },
      headers: { "Idempotency-Key": "key-abc-123" },
    });
  });

  it("withdrawBrandBackend propagates error", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: false, error: "kyc_required" });
    const res = await withdrawBrandBackend(5000, "k");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("kyc_required");
  });
});
