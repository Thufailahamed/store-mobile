import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listWishlistBackend, addWishlistBackend, removeWishlistBackend } from "@/lib/api/backend";
import { suppressRemoteSyncPull } from "@/lib/remote-sync-guard";

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
  refreshFromServer: (userId: string) => Promise<void>;
}

async function fetchServerWishlistItems(): Promise<Record<string, boolean>> {
  const res = await listWishlistBackend();
  if (!res.ok) return {};
  const serverItems: Record<string, boolean> = {};
  for (const row of (res.data.items ?? []) as Array<{ product_id: string }>) {
    serverItems[row.product_id] = true;
  }
  return serverItems;
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

      clear: () => {
        const { items, hydrated } = get();
        if (Object.keys(items).length === 0 && !hydrated) return;
        set({ items: {}, hydrated: false });
      },

      syncToServer: async (_userId) => {
        if (!get().hydrated) return;
        suppressRemoteSyncPull();
        try {
          const localIds = new Set(Object.keys(get().items));
          const serverItems = await fetchServerWishlistItems();
          const remoteIds = new Set(Object.keys(serverItems));
          const toInsert = [...localIds].filter((id) => !remoteIds.has(id));
          const toDelete = [...remoteIds].filter((id) => !localIds.has(id));
          for (const productId of toInsert) {
            const res = await addWishlistBackend(productId);
            if (!res.ok) break;
          }
          for (const productId of toDelete) {
            const res = await removeWishlistBackend(productId);
            if (!res.ok) break;
          }
        } catch {
          // Silent fail — local wishlist still works offline.
        }
      },

      loadFromServer: async (_userId) => {
        try {
          const serverItems = await fetchServerWishlistItems();
          const merged = { ...serverItems, ...get().items };
          set({ items: merged, hydrated: true });
        } catch {
          set({ hydrated: true });
        }
      },

      refreshFromServer: async (_userId) => {
        if (!get().hydrated) return;
        try {
          const serverItems = await fetchServerWishlistItems();
          set({ items: serverItems });
        } catch {
          // Keep current local state on transient errors.
        }
      },
    }),
    {
      name: "wishlist-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
