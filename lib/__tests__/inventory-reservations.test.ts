import { describe, it, expect } from "vitest";
import { cartItemsToReservations } from "@/lib/inventory-reservations";

describe("cartItemsToReservations", () => {
  it("resolves single-variant products when variant id is missing on the line", () => {
    const rows = cartItemsToReservations(
      [{ variantId: null, productId: "p1", storeId: "store-a", quantity: 2 }],
      {
        p1: { variants: [{ id: "v1", is_active: true }] },
      },
    );
    expect(rows).toEqual([{ variant_id: "v1", store_id: "store-a", quantity: 2 }]);
  });

  it("skips lines without a resolvable variant", () => {
    const rows = cartItemsToReservations(
      [{ variantId: null, productId: "p1", storeId: "store-a", quantity: 1 }],
      {
        p1: {
          variants: [
            { id: "v1", is_active: true },
            { id: "v2", is_active: true },
          ],
        },
      },
    );
    expect(rows).toEqual([]);
  });
});
