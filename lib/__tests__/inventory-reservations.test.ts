import { describe, it, expect } from "vitest";
import { cartItemsToReservations } from "@/lib/inventory-reservations";

describe("inventory-reservations", () => {
  it("maps cart lines to reservation payload", () => {
    expect(
      cartItemsToReservations([
        {
          variantId: "var-1",
          storeId: "store-1",
          quantity: 2,
        },
        {
          variantId: null,
          storeId: "store-1",
          quantity: 1,
        },
      ]),
    ).toEqual([{ variant_id: "var-1", store_id: "store-1", quantity: 2 }]);
  });
});
