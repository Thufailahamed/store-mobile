import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

interface WishlistStore {
  items: Record<string, boolean>;
  /** True until the first server load has completed for the active user. */
  hydrated: boolean;
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  count: () => number;
  clear: () => void;
  syncToServer: (userId: string) => Promise<void>;
  loadFromServer: (userId: string) => Promise<void>;
}

async function ensureWishlistId(userId: string): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from("wishlists")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;

    const { data: created } = await supabase
      .from("wishlists")
      .insert({ user_id: userId, name: "My Wishlist" })
      .select("id")
      .single();
    return created?.id ?? null;
  } catch {
    return null;
  }
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: {},
      hydrated: false,

      toggle: (productId) => {
        set((state) => {
          const exists = state.items[productId];
          const { [productId]: _, ...rest } = state.items;
          return {
            items: exists ? rest : { ...state.items, [productId]: true },
          };
        });
      },

      has: (productId) => !!get().items[productId],

      count: () => Object.keys(get().items).length,

      clear: () => set({ items: {}, hydrated: false }),

      syncToServer: async (userId) => {
        try {
          const wishlistId = await ensureWishlistId(userId);
          if (!wishlistId) return;

          const { data: remote } = await supabase
            .from("wishlist_items")
            .select("product_id")
            .eq("wishlist_id", wishlistId);
          const remoteIds = new Set(
            (remote ?? []).map((r: { product_id: string }) => r.product_id)
          );
          const localIds = new Set(Object.keys(get().items));

          const toInsert = [...localIds].filter((id) => !remoteIds.has(id));
          const toDelete = [...remoteIds].filter((id) => !localIds.has(id));

          if (toInsert.length > 0) {
            await supabase
              .from("wishlist_items")
              .insert(
                toInsert.map((product_id) => ({ wishlist_id: wishlistId, product_id }))
              );
          }
          if (toDelete.length > 0) {
            await supabase
              .from("wishlist_items")
              .delete()
              .eq("wishlist_id", wishlistId)
              .in("product_id", toDelete);
          }
        } catch {
          // Silent fail — local wishlist still works offline.
        }
      },

      loadFromServer: async (userId) => {
        try {
          const wishlistId = await ensureWishlistId(userId);
          if (!wishlistId) {
            set({ hydrated: true });
            return;
          }
          const { data } = await supabase
            .from("wishlist_items")
            .select("product_id")
            .eq("wishlist_id", wishlistId);
          const serverItems: Record<string, boolean> = {};
          for (const row of (data ?? []) as { product_id: string }[]) {
            serverItems[row.product_id] = true;
          }
          // Merge with local — union of server + local so a user who added
          // items while signed out keeps them.
          const merged = { ...serverItems, ...get().items };
          set({ items: merged, hydrated: true });
        } catch {
          set({ hydrated: true });
        }
      },
    }),
    {
      name: "wishlist-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
