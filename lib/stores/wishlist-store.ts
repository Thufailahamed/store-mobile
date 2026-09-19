import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listWishlistBackend, addWishlistBackend, removeWishlistBackend } from "@/lib/api/backend";
import { suppressRemoteSyncPull } from "@/lib/remote-sync-guard";

type PendingWishlistOperation = "add" | "remove";

interface WishlistStore {
  items: Record<string, boolean>;
  pending: Record<string, PendingWishlistOperation>;
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
  if (!res.ok) throw new Error(res.error || "Could not load wishlist");
  const serverItems: Record<string, boolean> = {};
  for (const row of (res.data.items ?? []) as { product_id: string }[]) {
    serverItems[row.product_id] = true;
  }
  return serverItems;
}

function applyPendingOperations(
  items: Record<string, boolean>,
  pending: Record<string, PendingWishlistOperation>,
): Record<string, boolean> {
  const next = { ...items };
  for (const [productId, operation] of Object.entries(pending)) {
    if (operation === "add") next[productId] = true;
    else delete next[productId];
  }
  return next;
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: {},
      pending: {},
      hydrated: false,

      toggle: (productId) => {
        set((state) => {
          const exists = state.items[productId];
          const { [productId]: _, ...rest } = state.items;
          return {
            items: exists ? rest : { ...state.items, [productId]: true },
            pending: {
              ...state.pending,
              [productId]: exists ? "remove" : "add",
            },
          };
        });
      },

      has: (productId) => !!get().items[productId],

      count: () => Object.keys(get().items).length,

      clear: () => {
        const { items, pending, hydrated } = get();
        if (Object.keys(items).length === 0 && Object.keys(pending).length === 0 && !hydrated) return;
        set({ items: {}, pending: {}, hydrated: false });
      },

      syncToServer: async (_userId) => {
        if (!get().hydrated) return;
        suppressRemoteSyncPull();
        const operations = { ...get().pending };
        for (const [productId, operation] of Object.entries(operations)) {
          try {
            const res = operation === "add"
              ? await addWishlistBackend(productId)
              : await removeWishlistBackend(productId);
            if (!res.ok) continue;
            set((state) => {
              if (state.pending[productId] !== operation) return state;
              const { [productId]: _, ...pending } = state.pending;
              return { pending };
            });
          } catch {
            // Silent fail — the persisted operation will retry on the next sync.
          }
        }
      },

      loadFromServer: async (_userId) => {
        try {
          const serverItems = await fetchServerWishlistItems();
          const localItems = get().items;
          const pending = { ...get().pending };
          for (const productId of Object.keys(localItems)) {
            if (!serverItems[productId] && !pending[productId]) pending[productId] = "add";
          }
          const merged = applyPendingOperations({ ...serverItems, ...localItems }, pending);
          set({ items: merged, pending, hydrated: true });
        } catch {
          set({ hydrated: true });
        }
      },

      refreshFromServer: async (_userId) => {
        if (!get().hydrated) return;
        try {
          const serverItems = await fetchServerWishlistItems();
          set((state) => ({
            items: applyPendingOperations(serverItems, state.pending),
          }));
        } catch {
          // Keep current local state on transient errors.
        }
      },
    }),
    {
      name: "wishlist-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items, pending: state.pending }),
    },
  ),
);
