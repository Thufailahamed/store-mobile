import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { getVariantAvailableStock } from "@/lib/inventory";
import type { CartReconciliation } from "@/lib/cart-validation";
import { buildCartLineKeyFromItem, migrateCartItemRecord, mergeCartItemRecords, assertStoreConsistency, buildCartLineKey } from "@/lib/cart-line-key";
import { clearCheckoutSession } from "@/lib/cart-checkout-session";
import { planCartSync, type CartSyncResult } from "@/lib/cart-sync";

/** Notice payload when a cart mutation was clamped to available stock. */
export type CartClampNotice = {
  productName: string;
  variantLabel?: string;
  requested: number;
  capped: number;
  reason: "stock" | "max_qty";
};

let cartClampHandler: ((notice: CartClampNotice) => void) | null = null;

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
  stock: number;
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
  loadFromServer: (userId: string) => Promise<CartLoadResult>;
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
          const effectiveCap = item.stock ?? existing?.stock ?? 99;
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
                stock: effectiveCap,
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
          const capped = Math.min(quantity, item.stock);
          if (quantity > item.stock) {
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

      syncToServer: async (userId): Promise<CartSyncResult> => {
        if (!get().hydrated) return { ok: true };

        try {
          const { data: existingCart, error: cartLookupError } = await supabase
            .from("cart")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (cartLookupError) {
            console.warn("[cart] sync lookup failed:", cartLookupError.message);
            return { ok: false, error: "Could not sync your bag. Try again shortly." };
          }

          let cartId = existingCart?.id;

          if (!cartId) {
            const { data: newCart, error: createError } = await supabase
              .from("cart")
              .insert({ user_id: userId })
              .select("id")
              .single();
            if (createError || !newCart?.id) {
              console.warn("[cart] sync create cart failed:", createError?.message);
              return { ok: false, error: "Could not sync your bag. Try again shortly." };
            }
            cartId = newCart.id;
          }

          const { data: remoteRows, error: remoteError } = await supabase
            .from("cart_items")
            .select("id, product_id, variant_id, store_id, quantity, unit_price")
            .eq("cart_id", cartId);

          if (remoteError) {
            console.warn("[cart] sync read failed:", remoteError.message);
            return { ok: false, error: "Could not sync your bag. Try again shortly." };
          }

          const localItems = Object.values(get().items);
          const plan = planCartSync(localItems, remoteRows ?? []);

          if (plan.toDelete.length > 0) {
            const { error } = await supabase
              .from("cart_items")
              .delete()
              .in(
                "id",
                plan.toDelete.map((row) => row.id),
              );
            if (error) {
              console.warn("[cart] sync delete failed:", error.message);
              return { ok: false, error: "Could not sync your bag. Try again shortly." };
            }
          }

          for (const patch of plan.toUpdate) {
            const { error } = await supabase
              .from("cart_items")
              .update({ quantity: patch.quantity, unit_price: patch.unit_price })
              .eq("id", patch.id);
            if (error) {
              console.warn("[cart] sync update failed:", error.message);
              return { ok: false, error: "Could not sync your bag. Try again shortly." };
            }
          }

          if (plan.toInsert.length > 0) {
            const { error } = await supabase.from("cart_items").insert(
              plan.toInsert.map((item) => ({
                cart_id: cartId,
                product_id: item.productId,
                variant_id: item.variantId,
                store_id: item.storeId,
                quantity: item.quantity,
                unit_price: item.price,
              })),
            );
            if (error) {
              console.warn("[cart] sync insert failed:", error.message);
              return { ok: false, error: "Could not sync your bag. Try again shortly." };
            }
          }

          return { ok: true };
        } catch (err) {
          console.warn("[cart] sync failed:", err);
          return { ok: false, error: "Could not sync your bag. Try again shortly." };
        }
      },

      loadFromServer: async (userId): Promise<CartLoadResult> => {
        const loadFailed = "Could not load your bag. Showing items saved on this device.";
        try {
          const { data: cart, error: cartLookupError } = await supabase
            .from("cart")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (cartLookupError) {
            console.warn("[cart] load lookup failed:", cartLookupError.message);
            set({ hydrated: true });
            return { ok: false, error: loadFailed };
          }

          if (!cart) {
            set({ hydrated: true });
            return { ok: true };
          }

          const { data: rows, error: rowsError } = await supabase
            .from("cart_items")
            .select(
              "*, product:products(id, name, status, is_active, store_id, images:product_images(url, is_primary), variants:product_variants(*, inventory(quantity, reserved))), variant:product_variants(*, inventory(quantity, reserved))",
            )
            .eq("cart_id", cart.id);

          if (rowsError) {
            console.warn("[cart] load rows failed:", rowsError.message);
            set({ hydrated: true });
            return { ok: false, error: loadFailed };
          }

          const serverItems: Record<string, CartItem> = {};
          for (const row of (rows ?? []) as any[]) {
            const product = row.product;
            const productVariants = product?.variants ?? [];
            let variant = row.variant;
            let variantId = row.variant_id as string | null;
            if (!variantId && productVariants.length === 1) {
              variantId = productVariants[0].id;
              variant = productVariants[0];
            }
            const productMissing = !product?.id;
            const productInactive =
              product?.status !== "active" || product?.is_active === false;
            const variantMissing = variantId && !variant?.id;
            const variantInactive = variant?.is_active === false;
            if (productMissing || productInactive || variantMissing || variantInactive) {
              continue;
            }

            const key = buildCartLineKeyFromItem({
              storeId: row.store_id,
              productId: row.product_id,
              variantId,
            });
            serverItems[key] = {
              productId: row.product_id,
              variantId,
              storeId: row.store_id,
              name: product?.name ?? "Product",
              variantLabel: variant
                ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim() || undefined
                : undefined,
              price: row.unit_price,
              quantity: row.quantity,
              stock: getVariantAvailableStock({ inventory: variant?.inventory }, 99),
            };
          }

          // Merge: any local items the server doesn't know about get added
          // (covers the "added to cart while signed out" case).
          const local = migrateCartItemRecord(get().items);
          const { items: merged, quantityConflicts } = mergeCartItemRecords(serverItems, local);

          // Re-validate store consistency. After merge the line keys may still
          // reference an old storeId if a product was transferred; re-key them
          // silently using the fresh product snapshot we already fetched above.
          const productIndex: Record<string, { id: string; store_id: string }> = {};
          for (const row of (rows ?? []) as any[]) {
            if (row.product?.id) {
              productIndex[row.product.id] = {
                id: row.product.id,
                store_id: row.product.store_id,
              };
            }
          }
          const consistency = assertStoreConsistency(merged, productIndex);
          if (
            consistency.dropped.length > 0 ||
            consistency.rekeyed.length > 0 ||
            consistency.recapped.length > 0
          ) {
            set({ items: consistency.next, hydrated: true });
            return { ok: true, quantityConflicts };
          }

          set({ items: merged, hydrated: true });
          return { ok: true, quantityConflicts };
        } catch (err) {
          console.warn("[cart] load failed:", err);
          set({ hydrated: true });
          return { ok: false, error: loadFailed };
        }
      },

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
            items[patch.key] = {
              ...item,
              ...(patch.price !== undefined ? { price: patch.price } : {}),
              ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
              ...(patch.quantity !== undefined
                ? { quantity: Math.min(patch.quantity, nextStock) }
                : {}),
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
        items: state.items,
      }),
    }
  )
);
