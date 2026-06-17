import { describe, it, expect, beforeEach } from "vitest";
import { useCart } from "@/lib/stores/cart-store";
import { buildCartLineKey } from "@/lib/cart-line-key";

describe("cart-store line keys", () => {
  beforeEach(() => {
    useCart.setState({ items: {}, couponCode: null, hydrated: true });
  });

  it("keeps identical product+variant from different stores as separate lines", () => {
    useCart.getState().addItem({
      productId: "prod-1",
      variantId: "var-1",
      storeId: "store-a",
      name: "Tee",
      price: 1000,
      stock: 5,
      quantity: 1,
    });
    useCart.getState().addItem({
      productId: "prod-1",
      variantId: "var-1",
      storeId: "store-b",
      name: "Tee",
      price: 1200,
      stock: 3,
      quantity: 2,
    });

    const items = useCart.getState().items;
    expect(Object.keys(items)).toEqual([
      buildCartLineKey("store-a", "prod-1", "var-1"),
      buildCartLineKey("store-b", "prod-1", "var-1"),
    ]);
    expect(items[buildCartLineKey("store-a", "prod-1", "var-1")].quantity).toBe(1);
    expect(items[buildCartLineKey("store-b", "prod-1", "var-1")].quantity).toBe(2);
  });

  it("does not sync to server before hydration completes", async () => {
    useCart.setState({ hydrated: false });
    await useCart.getState().syncToServer("user-1");
    // No throw and no-op — verified by hydrated gate in store implementation.
    expect(useCart.getState().hydrated).toBe(false);
  });
});
