import { create } from "zustand";

interface UIStore {
  currency: string;
  locale: string;
  cartDrawerOpen: boolean;
  setCurrency: (currency: string) => void;
  setLocale: (locale: string) => void;
  setCartDrawer: (open: boolean) => void;
}

export const useUI = create<UIStore>((set) => ({
  currency: "LKR",
  locale: "en-LK",
  cartDrawerOpen: false,
  setCurrency: (currency) => set({ currency }),
  setLocale: (locale) => set({ locale }),
  setCartDrawer: (open) => set({ cartDrawerOpen: open }),
}));
