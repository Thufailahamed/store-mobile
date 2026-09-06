/**
 * Seller dashboard analytics wiring.
 *
 * The backend exposes `GET /api/seller/analytics` only — there is no
 * `/api/seller/analytics/summary` route, so hitting it 404'd and left the
 * dashboard permanently showing "—" for revenue and orders. These tests pin
 * the endpoint and the snake_case -> camelCase reshaping.
 */

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }) },
  },
}));

vi.mock("@/lib/api/_fetch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/_fetch")>("@/lib/api/_fetch");
  return {
    ...actual,
    fetchJson: vi.fn(),
  };
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchJson } from "@/lib/api/_fetch";
import { getSellerAnalyticsBackend, getSellerKPIsBackend } from "../backend";

const fetchJsonMock = vi.mocked(fetchJson);

const analyticsPayload = {
  store_id: "store-1",
  kpi: { revenue: 125000, orders: 42, aov: 2976, refund_rate: 0.0238 },
  deltas: { revenue: 12.5, orders: -4, aov: 3.1, refund: 0 },
  series: [
    { date: "2026-08-01", revenue: 5000, orders: 2 },
    { date: "2026-08-02", revenue: 7500, orders: 3 },
  ],
  top_products: [
    { id: "p1", name: "Linen Shirt", total_sales: 48000 },
    { id: "p2", name: "Wool Coat", total_sales: 32000 },
  ],
};

describe("getSellerAnalyticsBackend", () => {
  beforeEach(() => fetchJsonMock.mockReset());

  it("GETs /api/seller/analytics with the requested range", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: analyticsPayload });
    await getSellerAnalyticsBackend("90d");
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/seller/analytics",
      expect.objectContaining({ query: { range: "90d" } }),
    );
  });

  it("defaults to a 30 day range", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: analyticsPayload });
    await getSellerAnalyticsBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/seller/analytics",
      expect.objectContaining({ query: { range: "30d" } }),
    );
  });
});

describe("getSellerKPIsBackend", () => {
  beforeEach(() => fetchJsonMock.mockReset());

  it("never requests the non-existent /analytics/summary route", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: analyticsPayload });
    await getSellerKPIsBackend();
    const paths = fetchJsonMock.mock.calls.map((c) => c[0]);
    expect(paths).not.toContain("/api/seller/analytics/summary");
    expect(paths).toContain("/api/seller/analytics");
  });

  it("reshapes the analytics payload into dashboard KPIs", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: analyticsPayload });
    const res = await getSellerKPIsBackend();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.revenue).toBe(125000);
    expect(res.data.orders).toBe(42);
    expect(res.data.aov).toBe(2976);
    expect(res.data.refundRate).toBeCloseTo(0.0238);
    expect(res.data.deltas.revenue).toBe(12.5);
    expect(res.data.deltas.orders).toBe(-4);
    expect(res.data.series).toHaveLength(2);
    expect(res.data.series[0]).toEqual({ date: "2026-08-01", revenue: 5000, orders: 2 });
  });

  it("maps top_products.total_sales onto the revenue field the UI reads", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: analyticsPayload });
    const res = await getSellerKPIsBackend();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.topProducts).toEqual([
      { id: "p1", name: "Linen Shirt", revenue: 48000 },
      { id: "p2", name: "Wool Coat", revenue: 32000 },
    ]);
  });

  it("returns zeroed KPIs rather than NaN when the payload is sparse", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: {} });
    const res = await getSellerKPIsBackend();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.revenue).toBe(0);
    expect(res.data.orders).toBe(0);
    expect(res.data.deltas.revenue).toBe(0);
    expect(res.data.series).toEqual([]);
    expect(res.data.topProducts).toEqual([]);
  });

  it("drops top products that have no id", async () => {
    fetchJsonMock.mockResolvedValue({
      ok: true,
      data: { top_products: [{ name: "Orphan", total_sales: 10 }, { id: "p9", name: "Real" }] },
    });
    const res = await getSellerKPIsBackend();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.topProducts).toEqual([{ id: "p9", name: "Real", revenue: 0 }]);
  });

  it("propagates backend failures", async () => {
    fetchJsonMock.mockResolvedValue({ ok: false, error: "Store not found" });
    const res = await getSellerKPIsBackend();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Store not found");
  });
});
