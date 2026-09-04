import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminOrders } from "../index";
import * as B from "../backend";

vi.mock("../backend", () => ({
  getAdminOrdersBackend: vi.fn(),
  getAdminProductsBackend: vi.fn(),
  approveProductBackend: vi.fn(),
  setProductFeaturedBackend: vi.fn(),
  setProductActiveBackend: vi.fn(),
  getAdminOverviewStatsBackend: vi.fn(),
  getAdminRecentSignupsBackend: vi.fn(),
  getAdminRecentOrdersBackend: vi.fn(),
  getAdminPendingApprovalsBackend: vi.fn(),
}));

describe("Admin Orders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cleans status='all' when requesting orders from backend", async () => {
    const mockOrders = [
      { id: "o1", order_number: "ORD-001", total: 25000, status: "pending" },
    ];
    vi.mocked(B.getAdminOrdersBackend).mockResolvedValueOnce({
      ok: true,
      data: { orders: mockOrders as any, total: 1 },
    });

    const res = await getAdminOrders({ status: "all" });
    expect(res.ok).toBe(true);
    expect(B.getAdminOrdersBackend).toHaveBeenCalledWith({});
    if (res.ok) {
      expect(res.data.length).toBe(1);
      expect(res.data[0].order_number).toBe("ORD-001");
    }
  });

  it("passes specific status when requested", async () => {
    vi.mocked(B.getAdminOrdersBackend).mockResolvedValueOnce({
      ok: true,
      data: { orders: [], total: 0 },
    });

    await getAdminOrders({ status: "confirmed" });
    expect(B.getAdminOrdersBackend).toHaveBeenCalledWith({ status: "confirmed" });
  });
});
