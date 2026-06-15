import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface UIStore {
  theme: Theme;
  currency: string;
  locale: string;
  setTheme: (theme: Theme) => void;
  setCurrency: (currency: string) => void;
  setLocale: (locale: string) => void;
}

export const useUI = create<UIStore>((set) => ({
  theme: "system",
  currency: "LKR",
  locale: "en-LK",
  setTheme: (theme) => set({ theme }),
  setCurrency: (currency) => set({ currency }),
  setLocale: (locale) => set({ locale }),
}));
