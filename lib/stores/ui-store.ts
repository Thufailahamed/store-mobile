import { create } from "zustand";

interface UIStore {
  currency: string;
  locale: string;
  setCurrency: (currency: string) => void;
  setLocale: (locale: string) => void;
}

export const useUI = create<UIStore>((set) => ({
  currency: "LKR",
  locale: "en-LK",
  setCurrency: (currency) => set({ currency }),
  setLocale: (locale) => set({ locale }),
}));
