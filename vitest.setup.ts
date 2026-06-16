/**
 * Vitest setup. Mocks the native-bridge modules so the recommender code
 * (which writes to AsyncStorage, talks to Supabase, and reads images
 * via `Platform.OS`) can run in node without pulling in the React
 * Native runtime. Without this, the rolldown transformer chokes on
 * Flow syntax in node_modules/react-native.
 */

import { vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: vi.fn(),
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: any) => obj.ios ?? obj.default },
  View: "View",
  Text: "Text",
  Image: "Image",
  ScrollView: "ScrollView",
  StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
  Pressable: "Pressable",
  ActivityIndicator: "ActivityIndicator",
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  PixelRatio: { get: () => 2 },
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));
