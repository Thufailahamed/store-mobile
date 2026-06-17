import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  function makeBuilder(result: { data: any; error: any }) {
    const settled = Promise.resolve(result);
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      maybeSingle: vi.fn(() => settled),
      then: (onF: any, onR: any) => settled.then(onF, onR),
    };
    return builder;
  }

  return {
    supabase: {
      from: (table: string) => {
        fromMock(table);
        return makeBuilder({ data: null, error: null });
      },
    },
  };
});

import {
  findLocalSkuDuplicate,
  formatSkuPersistenceError,
  normalizeSku,
  validateStoreSkus,
} from "@/lib/product-sku";

beforeEach(() => {
  fromMock.mockReset();
});

describe("product-sku", () => {
  it("normalizes SKU for comparison", () => {
    expect(normalizeSku("  luxe-001 ")).toBe("LUXE-001");
  });

  it("detects duplicate SKUs within a product draft", () => {
    expect(
      findLocalSkuDuplicate("ABC-1", [{ sku: "abc-1" }, { sku: "XYZ" }]),
    ).toBe("ABC-1");
    expect(findLocalSkuDuplicate("ABC-1", [{ sku: "XYZ" }])).toBeNull();
  });

  it("maps unique constraint errors to a friendly message", () => {
    expect(formatSkuPersistenceError('duplicate key value violates unique constraint "products_sku_key"')).toBe(
      "That SKU is already in use. Choose a different SKU.",
    );
  });

  it("passes when store has no conflicting SKUs", async () => {
    const result = await validateStoreSkus({
      storeId: "store-1",
      productSku: "NEW-SKU",
      variants: [{ sku: "VAR-1" }],
    });
    expect(result.ok).toBe(true);
  });
});
