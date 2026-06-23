import { describe, it, expect, beforeEach, vi } from "vitest";

const { fetchJsonMock } = vi.hoisted(() => {
  const fetchJsonMock = vi.fn();
  return { fetchJsonMock };
});

vi.mock("@/lib/api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/backend")>();
  return {
    ...actual,
    fetchJson: fetchJsonMock,
  };
});

// Still need supabase mock because _fetch.ts imports it for getAccessToken
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok" } } }) },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import {
  getCategoryDeleteImpact,
  createCategory,
  deleteCategoryWithOptions,
} from "@/lib/api/category-admin";

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe("getCategoryDeleteImpact", () => {
  it("calls the backend API and parses counts", async () => {
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { impact: { productCount: 3, childCount: 1, couponCount: 2 } },
    });

    const r = await getCategoryDeleteImpact("cat-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ productCount: 3, childCount: 1, couponCount: 2 });
    }
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/admin/categories/cat-1/delete-impact",
    );
  });
});

describe("createCategory", () => {
  it("calls the backend POST and returns the new category", async () => {
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { category: { id: "new-cat", name: "Shoes", slug: "shoes" } },
    });

    const r = await createCategory({ name: "Shoes", slug: "shoes" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ id: "new-cat", name: "Shoes", slug: "shoes" });
    }
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/admin/categories",
      { method: "POST", body: { name: "Shoes", slug: "shoes" } },
    );
  });
});

describe("deleteCategoryWithOptions", () => {
  it("re-fetches impact, calls backend DELETE, and returns ok", async () => {
    // First call: getCategoryDeleteImpact → GET /api/admin/categories/root/delete-impact
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { impact: { productCount: 2, childCount: 0, couponCount: 0 } },
    });
    // Second call: DELETE /api/admin/categories/root
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { result: null },
    });

    const r = await deleteCategoryWithOptions(
      "root",
      { productAction: "reassign", productReassignId: "other", childAction: "detach" },
      [
        { id: "root", parent_id: null },
        { id: "other", parent_id: null },
      ],
    );

    expect(r.ok).toBe(true);
    // Verify the impact fetch
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/admin/categories/root/delete-impact",
    );
    // Verify the delete call
    expect(fetchJsonMock).toHaveBeenLastCalledWith(
      "/api/admin/categories/root",
      {
        method: "DELETE",
        body: {
          productAction: "reassign",
          productReassignId: "other",
          childAction: "detach",
          childReassignParentId: null,
        },
      },
    );
  });

  it("returns validation errors without calling delete", async () => {
    // Impact fetch
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { impact: { productCount: 1, childCount: 0, couponCount: 0 } },
    });

    const r = await deleteCategoryWithOptions(
      "root",
      { productAction: "reassign", childAction: "detach" },
      [{ id: "root", parent_id: null }],
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Choose a category");
    // Only the impact fetch should have been called, not the delete
    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
  });
});
