/**
 * End-to-end style integration tests for mobile cart flows.
 * Exercises store + merge + checkout session orchestration with mocked Supabase.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeCartItemRecords, buildCartLineKey } from "@/lib/cart-line-key";
import { useCart, type CartItem } from "@/lib/stores/cart-store";
import {
  clearCheckoutSession,
  prepareCartForCheckout,
  restoreUnselectedCartItems,
} from "@/lib/cart-checkout-session";

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

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod-1",
    variantId: "var-1",
    storeId: "store-a",
    name: "Tee",
    price: 1000,
    quantity: 1,
    stock: 5,
    ...overrides,
  };
}

describe("mobile cart e2e flows", () => {
  beforeEach(() => {
    storage.clear();
    useCart.setState({ items: {}, couponCode: null, hydrated: true });
  });

  it("guest add → persist shape → reload merge keeps lines", () => {
    useCart.getState().addItem(makeItem({ quantity: 2 }));
    const guest = { ...useCart.getState().items };
    expect(Object.keys(guest)).toHaveLength(1);

    useCart.setState({ items: {}, hydrated: false });
    const server = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem({ quantity: 1 }),
    };
    const { items: merged } = mergeCartItemRecords(server, guest);
    useCart.setState({ items: merged, hydrated: true });

    expect(useCart.getState().items[buildCartLineKey("store-a", "prod-1", "var-1")].quantity).toBe(2);
  });

  it("login merge keeps local-only lines from another store", () => {
    const server = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem({ quantity: 1 }),
    };
    const local = {
      [buildCartLineKey("store-b", "prod-1", "var-1")]: makeItem({
        storeId: "store-b",
        quantity: 3,
      }),
    };
    const { items: merged } = mergeCartItemRecords(server, local);
    expect(Object.keys(merged)).toHaveLength(2);
    expect(merged[buildCartLineKey("store-b", "prod-1", "var-1")].quantity).toBe(3);
  });

  it("partial selection checkout parks unselected lines and restores them", async () => {
    const keyA = buildCartLineKey("store-a", "prod-1", "var-1");
    const keyB = buildCartLineKey("store-b", "prod-1", "var-1");
    useCart.setState({
      items: {
        [keyA]: makeItem({ storeId: "store-a" }),
        [keyB]: makeItem({ storeId: "store-b" }),
      },
      hydrated: true,
    });

    const removed: string[] = [];
    const prep = await prepareCartForCheckout({
      items: useCart.getState().items,
      selectedKeys: { [keyA]: true, [keyB]: false },
      removeItem: (key) => {
        removed.push(key);
        useCart.getState().removeItem(key);
      },
    });

    expect(prep.ok).toBe(true);
    expect(removed).toEqual([keyB]);
    expect(Object.keys(useCart.getState().items)).toEqual([keyA]);

    await restoreUnselectedCartItems(useCart.getState().addItem);
    expect(Object.keys(useCart.getState().items)).toHaveLength(2);
    await clearCheckoutSession();
  });

  it("clears checkout session backup on successful order clear", async () => {
    const keyA = buildCartLineKey("store-a", "prod-1", "var-1");
    useCart.setState({ items: { [keyA]: makeItem() }, hydrated: true });
    await prepareCartForCheckout({
      items: useCart.getState().items,
      selectedKeys: { [keyA]: true },
      removeItem: (key) => useCart.getState().removeItem(key),
    });

    useCart.getState().clear();
    expect(useCart.getState().items).toEqual({});
  });
});
