import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface WishlistStore {
  items: Record<string, boolean>;
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  count: () => number;
  clear: () => void;
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: {},

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

      clear: () => set({ items: {} }),
    }),
    {
      name: "wishlist-v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
