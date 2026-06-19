import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCart, setCartClampNoticeHandler } from "@/lib/stores/cart-store";

describe("cart-store clamp UX (mobile)", () => {
  beforeEach(() => {
    useCart.setState({ items: {}, couponCode: null, hydrated: true });
    setCartClampNoticeHandler(null);
  });

  it("does not emit when stock is sufficient", () => {
    const handler = vi.fn();
    setCartClampNoticeHandler(handler);
    useCart.getState().addItem({
      productId: "p1",
      variantId: "v1",
      storeId: "s1",
      name: "Sneaker",
      variantLabel: "M",
      price: 1000,
      stock: 10,
      quantity: 3,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("emits when addItem stacks above stock", () => {
    const handler = vi.fn();
    setCartClampNoticeHandler(handler);
    useCart.getState().addItem({
      productId: "p1",
      variantId: "v1",
      storeId: "s1",
      name: "Sneaker",
      variantLabel: "M",
      price: 1000,
      stock: 3,
      quantity: 2,
    });
    useCart.getState().addItem({
      productId: "p1",
      variantId: "v1",
      storeId: "s1",
      name: "Sneaker",
      variantLabel: "M",
      price: 1000,
      stock: 3,
      quantity: 5,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      productName: "Sneaker",
      requested: 7,
      capped: 3,
      reason: "stock",
    });
    const items = Object.values(useCart.getState().items);
    expect(items[0]?.quantity).toBe(3);
  });

  it("emits when updateQuantity exceeds stock", () => {
    const handler = vi.fn();
    setCartClampNoticeHandler(handler);
    useCart.getState().addItem({
      productId: "p1",
      variantId: "v1",
      storeId: "s1",
      name: "Sneaker",
      variantLabel: "M",
      price: 1000,
      stock: 2,
      quantity: 1,
    });
    const key = Object.keys(useCart.getState().items)[0]!;
    useCart.getState().updateQuantity(key, 9);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ requested: 9, capped: 2 });
  });

  it("applyReconciliation drops lines clamped to 0 (ghost-row guard)", () => {
    useCart.getState().addItem({
      productId: "p1",
      variantId: "v1",
      storeId: "s1",
      name: "Sneaker",
      variantLabel: "M",
      price: 1000,
      stock: 5,
      quantity: 5,
    });
    const key = Object.keys(useCart.getState().items)[0]!;

    useCart.getState().applyReconciliation({
      remove: [],
      update: [{ key, stock: 0, quantity: 0 }],
    });

    expect(useCart.getState().items).not.toHaveProperty(key);
  });

  it("addItem preserves null stock when caller doesn't know it", () => {
    useCart.getState().addItem({
      productId: "p1",
      variantId: null,
      storeId: "s1",
      name: "Poster",
      price: 500,
      quantity: 1,
    } as any);
    const items = Object.values(useCart.getState().items);
    expect(items[0]?.stock).toBeNull();
  });

  it("updateQuantity does not artificially cap when stock is unknown", () => {
    useCart.getState().addItem({
      productId: "p1",
      variantId: null,
      storeId: "s1",
      name: "Poster",
      price: 500,
      quantity: 1,
    } as any);
    const key = Object.keys(useCart.getState().items)[0]!;
    useCart.getState().updateQuantity(key, 50);
    expect(useCart.getState().items[key]?.quantity).toBe(50);
  });
});