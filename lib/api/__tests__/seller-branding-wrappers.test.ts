import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

import { getSellerBrandingBackend, updateSellerBrandingBackend } from "@/lib/api/backend";

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe("seller branding wrappers", () => {
  it("getSellerBrandingBackend hits /api/seller/store", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { store: { theme_preset: "editorial" } } });
    await getSellerBrandingBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/store");
  });

  it("updateSellerBrandingBackend PATCHes", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { store: {} } });
    await updateSellerBrandingBackend({ theme_preset: "modern", primary_color: "#000" });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/store", {
      method: "PATCH",
      body: { theme_preset: "modern", primary_color: "#000" },
    });
  });
});
