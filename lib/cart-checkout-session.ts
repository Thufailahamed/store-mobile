import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateCartForCheckout } from "@/lib/cart-validation";
import type { CartItem } from "@/lib/stores/cart-store";

export const CART_UNSELECTED_BACKUP_KEY = "cart_unselected_backup";
export const CART_CHECKOUT_PREPARED_KEY = "cart_checkout_prepared";

export type PrepareCartCheckoutResult =
  | { ok: true }
  | { ok: false; error: string };

/** Remove backup + prepared flag after a completed order or full cart reset. */
export async function clearCheckoutSession(): Promise<void> {
  await AsyncStorage.multiRemove([CART_UNSELECTED_BACKUP_KEY, CART_CHECKOUT_PREPARED_KEY]);
}

export async function isCheckoutPrepared(): Promise<boolean> {
  const value = await AsyncStorage.getItem(CART_CHECKOUT_PREPARED_KEY);
  return value === "1";
}

/** Restore lines parked during checkout prep (e.g. user backs out without ordering). */
export async function restoreUnselectedCartItems(
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void,
): Promise<void> {
  try {
    const backupStr = await AsyncStorage.getItem(CART_UNSELECTED_BACKUP_KEY);
    if (!backupStr) return;

    const backupItems = JSON.parse(backupStr) as Record<string, CartItem>;
    Object.values(backupItems).forEach((item) => {
      addItem(item);
    });
    await AsyncStorage.removeItem(CART_UNSELECTED_BACKUP_KEY);
  } catch (err) {
    console.error("[cart-checkout] restore unselected failed:", err);
  }
}

/**
 * Validate the bag, park unselected lines, and mark checkout as prepared.
 * Call before any navigation to checkout.
 */
export async function prepareCartForCheckout(params: {
  items: Record<string, CartItem>;
  selectedKeys: Record<string, boolean>;
  removeItem: (key: string) => void;
}): Promise<PrepareCartCheckoutResult> {
  const { items, selectedKeys, removeItem } = params;

  const checkoutValidation = await validateCartForCheckout();
  if (!checkoutValidation.ok) {
    return { ok: false, error: checkoutValidation.error };
  }

  const freshItems = { ...items };
  const unselectedItems: Record<string, CartItem> = {};
  let selectedCount = 0;

  for (const [key, item] of Object.entries(freshItems)) {
    if (selectedKeys[key]) {
      selectedCount += 1;
    } else {
      unselectedItems[key] = item;
    }
  }

  if (selectedCount === 0) {
    return { ok: false, error: "Please select at least one item to checkout" };
  }

  try {
    if (Object.keys(unselectedItems).length > 0) {
      await AsyncStorage.setItem(CART_UNSELECTED_BACKUP_KEY, JSON.stringify(unselectedItems));
      Object.keys(unselectedItems).forEach((key) => {
        removeItem(key);
      });
    } else {
      await AsyncStorage.removeItem(CART_UNSELECTED_BACKUP_KEY);
    }

    await AsyncStorage.setItem(CART_CHECKOUT_PREPARED_KEY, "1");
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
