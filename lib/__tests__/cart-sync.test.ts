import { describe, it, expect } from "vitest";
import { planCartSync } from "@/lib/cart-sync";
import type { CartItem } from "@/lib/stores/cart-store";

describe("cart-sync", () => {
  it("plans insert, update, and delete without wiping unrelated rows", () => {
    const local: CartItem[] = [
      {
        productId: "p1",
        variantId: "v1",
        storeId: "s1",
        name: "A",
        price: 1200,
        quantity: 2,
        stock: 5,
      },
      {
        productId: "p2",
        variantId: "v2",
        storeId: "s2",
        name: "B",
        price: 900,
        quantity: 1,
        stock: 3,
      },
    ];

    const remote = [
      {
        id: "row-1",
        product_id: "p1",
        variant_id: "v1",
        store_id: "s1",
        quantity: 1,
        unit_price: 1000,
      },
      {
        id: "row-old",
        product_id: "p9",
        variant_id: "v9",
        store_id: "s9",
        quantity: 1,
        unit_price: 500,
      },
    ];

    const plan = planCartSync(local, remote);
    expect(plan.toDelete.map((row) => row.id)).toEqual(["row-old"]);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert[0].productId).toBe("p2");
    expect(plan.toUpdate).toEqual([
      { id: "row-1", quantity: 2, unit_price: 1200 },
    ]);
  });
});
