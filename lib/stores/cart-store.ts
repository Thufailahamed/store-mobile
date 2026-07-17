import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCartBackend, putCartBackend } from "@/lib/api/backend";
import { getVariantAvailableStock } from "@/lib/inventory";
import type { CartReconciliation } from "@/lib/cart-validation";
import { buildCartLineKeyFromItem, migrateCartItemRecord, mergeCartItemRecords, assertStoreConsistency, buildCartLineKey } from "@/lib/cart-line-key";
import { clearCheckoutSession } from "@/lib/cart-checkout-session";
import { planCartSync, type CartSyncResult } from "@/lib/cart-sync";
import { suppressRemoteSyncPull, beginPushInFlight, endPushInFlight } from "@/lib/remote-sync-guard";

/** Notice payload when a cart mutation was clamped to available stock. */
export type CartClampNotice = {
  productName: string;
  variantLabel?: string;
  requested: number;
  capped: number;
  reason: "stock" | "max_qty";
};

let cartClampHandler: ((notice: CartClampNotice) => void) | null = null;

/** Hard cap on distinct cart lines kept in AsyncStorage. */
const MAX_CART_LINES = 50;

/** Register a callback that fires whenever an `addItem` or `updateQuantity`
 *  silently caps the requested quantity to available stock. Matches the
 *  reservation-sync error-handler pattern so the toast layer can react. */
export function setCartClampNoticeHandler(
  handler: ((notice: CartClampNotice) => void) | null,
): void {
  cartClampHandler = handler;
}

function emitClamp(notice: CartClampNotice): void {
  if (cartClampHandler) cartClampHandler(notice);
}

export interface CartItem {
  productId: string;
  variantId: string | null;
  storeId: string;
  name: string;
  variantLabel?: string;
  price: number;
  image?: string;
  quantity: number;
  /** Available stock at the time the line was added. `null` = unknown —
   *  set when the caller can't compute it. Reconciliation replaces this
   *  with the live catalogue figure on the next refresh. */
  stock: number | null;
}

export type CartLoadResult =
  | { ok: true; quantityConflicts?: number }
  | { ok: false; error: string };

export interface CartStore {
  items: Record<string, CartItem>;
  couponCode: string | null;
  /** False until the first server load finishes for the signed-in user. */
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  setCoupon: (code: string | null) => void;
  clear: () => void;
  syncToServer: (userId: string) => Promise<import("@/lib/cart-sync").CartSyncResult>;
  loadFromServer: (userId: string, options?: { merge?: "login" | "remote" }) => Promise<CartLoadResult>;
  refreshFromServer: (userId: string) => Promise<CartLoadResult>;
  applyReconciliation: (reconciliation: CartReconciliation) => void;
  itemCount: () => number;
  subtotal: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: {},
      couponCode: null,
      hydrated: false,

      addItem: (item) => {
        const key = buildCartLineKeyFromItem(item);
        const requestedQty = item.quantity ?? 1;
        set((state) => {
          const existing = state.items[key];
          // Cap cart line count to 50 — anything beyond that exhausts
          // AsyncStorage and (more importantly) is almost always a bug or
          // an automation gone wrong. Update an existing line in place
          // even when we're at the cap so the user can still adjust qty.
          if (!existing && Object.keys(state.items).length >= MAX_CART_LINES) {
            emitClamp({
              productName: item.name,
              variantLabel: item.variantLabel,
              requested: 1,
              capped: 0,
              reason: "max_qty",
            });
            return state;
          }
          // Prefer the new item's stock when known; otherwise fall back to
          // whatever the existing line carries. Only when we genuinely have
          // no signal do we cap at 99 — and in that case we still record
          // `stock: undefined` so reconciliation can correct it instead of
          // letting a phantom 99-unit line ride through checkout.
          const knownStock =
            item.stock != null ? item.stock : existing?.stock;
          const fallbackCap = 99;
          const effectiveCap =
            knownStock != null && knownStock > 0
              ? Math.min(knownStock, fallbackCap)
              : fallbackCap;
          const { image: _image, ...rest } = item;
          const next = existing
            ? Math.min(existing.quantity + requestedQty, effectiveCap)
            : Math.min(requestedQty, effectiveCap);
          if (existing && existing.quantity + requestedQty > effectiveCap) {
            emitClamp({
              productName: item.name,
              variantLabel: item.variantLabel,
              requested: existing.quantity + requestedQty,
              capped: next,
              reason: "stock",
            });
          } else if (!existing && requestedQty > effectiveCap) {
            emitClamp({
              productName: item.name,
              variantLabel: item.variantLabel,
              requested: requestedQty,
              capped: next,
              reason: "stock",
            });
          }
          return {
            items: {
              ...state.items,
              [key]: {
                ...rest,
                quantity: next,
                // Persist the *known* stock; use `null` (not undefined) when
                // the caller didn't pass one so downstream consumers can
                // distinguish "unknown" from "out of stock".
                stock: knownStock ?? null,
              },
            },
          };
        });
      },

      removeItem: (key) => {
        set((state) => {
          const { [key]: _, ...rest } = state.items;
          return { items: rest };
        });
      },

      updateQuantity: (key, quantity) => {
        if (quantity <= 0) {
          get().removeItem(key);
          return;
        }
        set((state) => {
          const item = state.items[key];
          if (!item) return state;
          // When stock is unknown, don't artificially cap. The next
          // reconciliation pass will correct the count if the buyer over-ordered.
          const knownStock = item.stock;
          const capped =
            knownStock != null && knownStock > 0
              ? Math.min(quantity, knownStock)
              : quantity;
          if (knownStock != null && quantity > knownStock) {
            emitClamp({
              productName: item.name,
              variantLabel: item.variantLabel,
              requested: quantity,
              capped,
              reason: "stock",
            });
          }
          return {
            items: {
              ...state.items,
              [key]: { ...item, quantity: capped },
            },
          };
        });
      },

      setCoupon: (code) => set({ couponCode: code }),

      clear: () => {
        const { items, couponCode, hydrated } = get();
        if (Object.keys(items).length === 0 && couponCode == null && !hydrated) return;
        set({ items: {}, couponCode: null, hydrated: false });
        void clearCheckoutSession();
      },

      syncToServer: async (_userId): Promise<CartSyncResult> => {
        if (!get().hydrated) return { ok: true };

        // Block remote pulls for the *entire* push, not just a fixed
        // window from now — a pull that lands mid-push would read a
        // stale (or, on the server, briefly empty) cart and stomp the
        // change we're about to write. beginPushInFlight/endPushInFlight
        // cover the request itself; the trailing suppressRemoteSyncPull
        // covers the Realtime echo that follows a successful write.
        suppressRemoteSyncPull();
        beginPushInFlight();

        try {
          const localItems = Object.values(get().items);
          const lines = localItems.map((item) => ({
            product_id: item.productId,
            variant_id: item.variantId,
            store_id: item.storeId,
            quantity: item.quantity,
            unit_price: item.price,
          }));
          const res = await putCartBackend(lines, "LKR");
          if (!res.ok) {
            console.warn("[cart] sync failed:", res.error);
            return { ok: false, error: "Could not sync your bag. Try again shortly." };
          }
          return { ok: true };
        } catch (err) {
          console.warn("[cart] sync failed:", err);
          return { ok: false, error: "Could not sync your bag. Try again shortly." };
        } finally {
          endPushInFlight();
          suppressRemoteSyncPull();
        }
      },

      loadFromServer: async (_userId, options?: { merge?: "login" | "remote" }): Promise<CartLoadResult> => {
        const mergeMode = options?.merge ?? "login";
        const loadFailed =
          mergeMode === "remote"
            ? "Could not refresh your bag."
            : "Could not load your bag. Showing items saved on this device.";
        try {
          const res = await getCartBackend();
          if (!res.ok) {
            console.warn("[cart] load failed:", res.error);
            set({ hydrated: true });
            return { ok: false, error: loadFailed };
          }

          const remoteRows = (res.data.lines ?? []) as unknown[];
          const serverItems: Record<string, CartItem> = {};
          for (const row of remoteRows) {
            const r = row as {
              product_id: string;
              variant_id?: string | null;
              store_id?: string;
              product_name?: string;
              variant_label?: string | null;
              unit_price?: number;
              quantity?: number;
              product?: { id: string; name: string; status?: string; is_active?: boolean };
              variant?: { id?: string; color?: string; size?: string; inventory?: unknown; is_active?: boolean };
            };
            if (!r.product_id || !r.store_id) continue;
            const productInactive =
              r.product?.status !== "active" || r.product?.is_active === false;
            const variantInactive = r.variant?.is_active === false;
            if (productInactive || variantInactive) continue;

            const key = buildCartLineKeyFromItem({
              storeId: r.store_id,
              productId: r.product_id,
              variantId: r.variant_id ?? null,
            });
            serverItems[key] = {
              productId: r.product_id,
              variantId: r.variant_id ?? null,
              storeId: r.store_id,
              name: r.product_name ?? r.product?.name ?? "Product",
              variantLabel: r.variant_label ?? undefined,
              price: Number(r.unit_price ?? 0),
              quantity: Number(r.quantity ?? 1),
              stock: getVariantAvailableStock(
                { inventory: r.variant?.inventory as never },
                99,
              ),
            };
          }

          const local = migrateCartItemRecord(get().items);
          let mergedItems: Record<string, CartItem>;
          let quantityConflicts = 0;
          if (mergeMode === "remote") {
            mergedItems = serverItems;
          } else {
            const merged = mergeCartItemRecords(serverItems, local);
            mergedItems = merged.items;
            quantityConflicts = merged.quantityConflicts;
          }

          const productIndex: Record<string, { id: string; store_id: string }> = {};
          for (const row of remoteRows) {
            const r = row as { product_id: string; product?: { id: string; store_id?: string } };
            if (r.product?.id && r.product.store_id) {
              productIndex[r.product_id] = { id: r.product.id, store_id: r.product.store_id };
            }
          }
          const consistency = assertStoreConsistency(mergedItems, productIndex);
          if (
            consistency.dropped.length > 0 ||
            consistency.rekeyed.length > 0 ||
            consistency.recapped.length > 0
          ) {
            set({ items: consistency.next, hydrated: true });
            return { ok: true, quantityConflicts };
          }

          set({ items: mergedItems, hydrated: true });
          return { ok: true, quantityConflicts };
        } catch (err) {
          console.warn("[cart] load failed:", err);
          set({ hydrated: true });
          return { ok: false, error: loadFailed };
        }
      },

      refreshFromServer: async (userId) => get().loadFromServer(userId, { merge: "remote" }),

      applyReconciliation: (reconciliation) => {
        set((state) => {
          if (reconciliation.remove.length === 0 && reconciliation.update.length === 0) {
            return state;
          }

          const items = { ...state.items };

          for (const issue of reconciliation.remove) {
            delete items[issue.key];
          }

          for (const patch of reconciliation.update) {
            const item = items[patch.key];
            if (!item) continue;
            const nextStock = patch.stock ?? item.stock;
            const nextQty =
              patch.quantity !== undefined
                ? nextStock != null && nextStock > 0
                  ? Math.min(patch.quantity, nextStock)
                  : patch.quantity
                : item.quantity;
            // Drop ghost lines: when stock is exhausted mid-checkout the
            // patch clamps quantity to 0, but a 0-quantity row in the bag
            // just confuses downstream totals — remove it cleanly.
            if (nextQty <= 0) {
              delete items[patch.key];
              continue;
            }
            items[patch.key] = {
              ...item,
              ...(patch.price !== undefined ? { price: patch.price } : {}),
              ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
              quantity: nextQty,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.variantLabel !== undefined
                ? { variantLabel: patch.variantLabel }
                : {}),
            };
          }

          return { items };
        });
      },

      itemCount: () => {
        return Object.values(get().items).reduce((sum, item) => sum + item.quantity, 0);
      },

      subtotal: () => {
        return Object.values(get().items).reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },
    }),
    {
      name: "cart-v1",
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { items?: Record<string, CartItem>; couponCode?: string | null };
        const items =
          state.items && typeof state.items === "object" && !Array.isArray(state.items)
            ? version < 2
              ? migrateCartItemRecord(state.items)
              : state.items
            : {};
        return { ...state, items };
      },
      merge: (persisted, current) => {
        const state = persisted as { items?: Record<string, CartItem>; couponCode?: string | null };
        const items =
          state.items && typeof state.items === "object" && !Array.isArray(state.items)
            ? state.items
            : current.items;
        return {
          ...current,
          couponCode: state.couponCode ?? current.couponCode,
          items,
        };
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        couponCode: state.couponCode,
        // Truncate persisted items to MAX_CART_LINES so we never write
        // an unbounded payload to AsyncStorage.
        items: Object.fromEntries(
          Object.entries(state.items).slice(0, MAX_CART_LINES),
        ),
      }),
    }
  )
);
