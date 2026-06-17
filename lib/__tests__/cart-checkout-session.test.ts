import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CART_CHECKOUT_PREPARED_KEY,
  CART_UNSELECTED_BACKUP_KEY,
  clearCheckoutSession,
  prepareCartForCheckout,
} from "@/lib/cart-checkout-session";
import type { CartItem } from "@/lib/stores/cart-store";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => Promise.resolve(storage.get(key) ?? null),
    setItem: (key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      storage.delete(key);
      return Promise.resolve();
    },
    multiRemove: (keys: string[]) => {
      keys.forEach((key) => storage.delete(key));
      return Promise.resolve();
    },
  },
}));

vi.mock("@/lib/cart-validation", () => ({
  validateCartForCheckout: vi.fn(async () => ({ ok: true })),
}));

function makeItem(key: string): CartItem {
  return {
    productId: "prod-1",
    variantId: "var-1",
    storeId: key.includes("store-b") ? "store-b" : "store-a",
    name: "Tee",
    price: 1000,
    quantity: 1,
    stock: 5,
  };
}

describe("cart-checkout-session", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("parks unselected lines and marks checkout prepared", async () => {
    const removed: string[] = [];
    const items = {
      "store-a:prod-1:var-1": makeItem("store-a:prod-1:var-1"),
      "store-b:prod-1:var-1": makeItem("store-b:prod-1:var-1"),
    };

    const result = await prepareCartForCheckout({
      items,
      selectedKeys: { "store-a:prod-1:var-1": true, "store-b:prod-1:var-1": false },
      removeItem: (key) => {
        removed.push(key);
      },
    });

    expect(result.ok).toBe(true);
    expect(removed).toEqual(["store-b:prod-1:var-1"]);
    expect(storage.get(CART_CHECKOUT_PREPARED_KEY)).toBe("1");
    expect(storage.get(CART_UNSELECTED_BACKUP_KEY)).toContain("store-b");
  });

  it("clears backup and prepared flag", async () => {
    storage.set(CART_UNSELECTED_BACKUP_KEY, "{}");
    storage.set(CART_CHECKOUT_PREPARED_KEY, "1");
    await clearCheckoutSession();
    expect(storage.has(CART_UNSELECTED_BACKUP_KEY)).toBe(false);
    expect(storage.has(CART_CHECKOUT_PREPARED_KEY)).toBe(false);
  });
});
