import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminProducts, approveProduct, setProductFeatured, setProductActive } from "../index";
import * as B from "../backend";

vi.mock("../backend", () => ({
  getAdminProductsBackend: vi.fn(),
  approveProductBackend: vi.fn(),
  setProductFeaturedBackend: vi.fn(),
  setProductActiveBackend: vi.fn(),
  getAdminOverviewStatsBackend: vi.fn(),
  getAdminRecentSignupsBackend: vi.fn(),
  getAdminRecentOrdersBackend: vi.fn(),
  getAdminPendingApprovalsBackend: vi.fn(),
}));

describe("Admin Products API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns backend products when backend call succeeds", async () => {
    const mockProducts = [
      { id: "p1", name: "Silk Shirt", price: 15000, status: "active" },
    ];
    vi.mocked(B.getAdminProductsBackend).mockResolvedValueOnce({
      ok: true,
      data: { products: mockProducts as any, total: 1 },
    });

    const res = await getAdminProducts({ status: "active" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.products.length).toBe(1);
      expect(res.data.products[0].name).toBe("Silk Shirt");
      expect(res.data.total).toBe(1);
    }
  });

  it("handles approveProduct via backend", async () => {
    vi.mocked(B.approveProductBackend).mockResolvedValueOnce({
      ok: true,
      data: { product: { id: "p1", status: "active" } as any },
    });

    const res = await approveProduct("p1", "active");
    expect(res.ok).toBe(true);
    expect(B.approveProductBackend).toHaveBeenCalledWith("p1", "active");
  });

  it("handles setProductFeatured via backend", async () => {
    vi.mocked(B.setProductFeaturedBackend).mockResolvedValueOnce({
      ok: true,
      data: { product: { id: "p1", is_featured: true } as any },
    });

    const res = await setProductFeatured("p1", true);
    expect(res.ok).toBe(true);
    expect(B.setProductFeaturedBackend).toHaveBeenCalledWith("p1", true);
  });

  it("handles setProductActive via backend", async () => {
    vi.mocked(B.setProductActiveBackend).mockResolvedValueOnce({
      ok: true,
      data: { product: { id: "p1", is_active: false } as any },
    });

    const res = await setProductActive("p1", false);
    expect(res.ok).toBe(true);
    expect(B.setProductActiveBackend).toHaveBeenCalledWith("p1", false);
  });
});
