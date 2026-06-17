import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import type { CartReconciliation } from "@/lib/cart-validation";

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

export interface CartStore {
  items: Record<string, CartItem>;
  couponCode: string | null;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  setCoupon: (code: string | null) => void;
  clear: () => void;
  syncToServer: (userId: string) => Promise<void>;
  loadFromServer: (userId: string) => Promise<void>;
  applyReconciliation: (reconciliation: CartReconciliation) => void;
  itemCount: () => number;
  subtotal: () => number;
}

function cartKey(productId: string, variantId: string | null) {
  return `${productId}-${variantId ?? "default"}`;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: {},
      couponCode: null,

      addItem: (item) => {
        const key = cartKey(item.productId, item.variantId);
        set((state) => {
          const existing = state.items[key];
          const { image: _image, ...rest } = item;
          return {
            items: {
              ...state.items,
              [key]: {
                ...rest,
                quantity: existing
                  ? Math.min(existing.quantity + (item.quantity ?? 1), existing.stock)
                  : (item.quantity ?? 1),
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
          return {
            items: {
              ...state.items,
              [key]: { ...item, quantity: Math.min(quantity, item.stock) },
            },
          };
        });
      },

      setCoupon: (code) => set({ couponCode: code }),

      clear: () => {
        const { items, couponCode } = get();
        if (Object.keys(items).length === 0 && couponCode == null) return;
        set({ items: {}, couponCode: null });
      },

      syncToServer: async (userId) => {
        try {
          const { data: existingCart } = await supabase
            .from("cart")
            .select("id")
            .eq("user_id", userId)
            .single();

          let cartId = existingCart?.id;

          if (!cartId) {
            const { data: newCart } = await supabase
              .from("cart")
              .insert({ user_id: userId })
              .select("id")
              .single();
            cartId = newCart?.id;
          }

          if (!cartId) return;

          await supabase.from("cart_items").delete().eq("cart_id", cartId);

          const cartItems = Object.values(get().items);
          if (cartItems.length === 0) return;

          const rows = cartItems.map((item) => ({
            cart_id: cartId,
            product_id: item.productId,
            variant_id: item.variantId,
            store_id: item.storeId,
            quantity: item.quantity,
            unit_price: item.price,
          }));

          await supabase.from("cart_items").insert(rows);
        } catch {
          // Silent fail — local cart still works
        }
      },

      loadFromServer: async (userId) => {
        try {
          const { data: cart } = await supabase
            .from("cart")
            .select("id")
            .eq("user_id", userId)
            .single();

          if (!cart) return;

          const { data: rows } = await supabase
            .from("cart_items")
            .select(
              "*, product:products(id, name, status, is_active, store_id, images:product_images(url, is_primary)), variant:product_variants(id, label, stock, is_active)",
            )
            .eq("cart_id", cart.id);

          const serverItems: Record<string, CartItem> = {};
          for (const row of (rows ?? []) as any[]) {
            const product = row.product;
            const variant = row.variant;
            const productMissing = !product?.id;
            const productInactive =
              product?.status !== "active" || product?.is_active === false;
            const variantMissing = row.variant_id && !variant?.id;
            const variantInactive = variant?.is_active === false;
            if (productMissing || productInactive || variantMissing || variantInactive) {
              continue;
            }

            const key = cartKey(row.product_id, row.variant_id);
            serverItems[key] = {
              productId: row.product_id,
              variantId: row.variant_id,
              storeId: row.store_id,
              name: product?.name ?? "Product",
              variantLabel: variant?.label,
              price: row.unit_price,
              quantity: row.quantity,
              stock: variant?.stock ?? 99,
            };
          }

          // Merge: any local items the server doesn't know about get added
          // (covers the "added to cart while signed out" case).
          const local = get().items;
          const merged: Record<string, CartItem> = { ...serverItems };
          for (const [key, item] of Object.entries(local)) {
            if (!merged[key]) merged[key] = item;
          }
          set({ items: merged });
        } catch {
          // Silent fail — local cart still works
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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        couponCode: state.couponCode,
        items: Object.fromEntries(
          Object.entries(state.items).map(([key, item]) => {
            const { image: _image, ...rest } = item;
            return [key, rest];
          })
        ),
      }),
    }
  )
);
