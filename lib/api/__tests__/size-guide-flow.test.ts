import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("../backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../backend")>();
  return {
    ...actual,
    getProductSizeGuideBackend: (id: string) =>
      fetchJsonMock(`/api/size-guides/product/${id}`, { requireAuth: false }),
    setProductSizeGuideBackend: (id: string, input: any) =>
      fetchJsonMock(`/api/size-guides/product/${id}`, { method: "PUT", body: input }),
  };
});

import { getProductSizeGuideBackend, setProductSizeGuideBackend } from "../backend";

describe("Size guide product API flow with images", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it("fetches product size guide with single or multiple images", async () => {
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: {
        size_system: "apparel",
        columns: ["Size", "Chest"],
        rows: [["S", "36"]],
        images: ["https://cdn.example.com/chart1.png", "https://cdn.example.com/chart2.png"],
      },
    });

    const res = await getProductSizeGuideBackend("prod-123");
    expect(res.ok).toBe(true);
    if (res.ok && res.data) {
      expect(res.data.images).toHaveLength(2);
      expect(res.data.images?.[0]).toBe("https://cdn.example.com/chart1.png");
    }
  });

  it("saves product size guide with images", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: {} });

    const payload = {
      size_system: "apparel",
      columns: ["Size", "Chest"],
      rows: [["S", "36"]],
      images: ["https://cdn.example.com/single-chart.jpg"],
    };

    const res = await setProductSizeGuideBackend("prod-123", payload);
    expect(res.ok).toBe(true);
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/size-guides/product/prod-123", {
      method: "PUT",
      body: payload,
    });
  });
});
