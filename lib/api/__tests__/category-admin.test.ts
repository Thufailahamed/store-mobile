import { describe, it, expect, beforeEach, vi } from "vitest";

const { rpcMock, fromMock, authGetUserMock, insertMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const fromMock = vi.fn();
  const authGetUserMock = vi.fn();
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  return { rpcMock, fromMock, authGetUserMock, insertMock };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    auth: { getUser: () => authGetUserMock() },
    from: (table: string) => fromMock(table),
  },
}));

import {
  getCategoryDeleteImpact,
  createCategory,
  deleteCategoryWithOptions,
} from "@/lib/api/category-admin";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  insertMock.mockClear();
  authGetUserMock.mockReset();
  authGetUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  fromMock.mockImplementation((table: string) => {
    if (table === "admin_audit_log") return { insert: insertMock };
    return { insert: insertMock };
  });
});

describe("getCategoryDeleteImpact", () => {
  it("calls RPC and parses counts", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { productCount: 3, childCount: 1, couponCount: 2 },
      error: null,
    });

    const r = await getCategoryDeleteImpact("cat-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ productCount: 3, childCount: 1, couponCount: 2 });
    }
    expect(rpcMock).toHaveBeenCalledWith("get_category_delete_impact", { p_category_id: "cat-1" });
  });
});

describe("createCategory", () => {
  it("writes audit log after create", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "categories") {
        const chain: any = {
          select: vi.fn(() => chain),
          single: vi.fn().mockResolvedValue({
            data: { id: "new-cat", name: "Shoes", slug: "shoes" },
            error: null,
          }),
        };
        return { insert: vi.fn(() => chain) };
      }
      return { insert: insertMock };
    });

    const r = await createCategory({ name: "Shoes", slug: "shoes" });
    expect(r.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("admin_audit_log");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "categories.create", target_id: "new-cat" }),
    );
  });
});

describe("deleteCategoryWithOptions", () => {
  it("re-fetches impact, calls transactional RPC, and audits", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: { productCount: 2, childCount: 0, couponCount: 0 },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const r = await deleteCategoryWithOptions(
      "root",
      { productAction: "reassign", productReassignId: "other", childAction: "detach" },
      [
        { id: "root", parent_id: null },
        { id: "other", parent_id: null },
      ],
    );

    expect(r.ok).toBe(true);
    expect(rpcMock).toHaveBeenLastCalledWith("delete_category_with_options", {
      p_category_id: "root",
      p_product_action: "reassign",
      p_product_reassign_id: "other",
      p_child_action: "detach",
      p_child_reassign_parent_id: null,
    });
    expect(fromMock).toHaveBeenCalledWith("admin_audit_log");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "categories.delete", target_id: "root" }),
    );
  });

  it("returns validation errors without calling delete RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { productCount: 1, childCount: 0, couponCount: 0 },
      error: null,
    });

    const r = await deleteCategoryWithOptions(
      "root",
      { productAction: "reassign", childAction: "detach" },
      [{ id: "root", parent_id: null }],
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Choose a category");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(fromMock).not.toHaveBeenCalledWith("admin_audit_log");
  });
});
