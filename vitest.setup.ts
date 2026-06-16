/**
 * Vitest setup. Mocks the native-bridge modules so the recommender code
 * (which writes to AsyncStorage and Supabase) can run in node without
 * pulling in the React Native runtime. Without this, the rolldown
 * transformer chokes on Flow syntax in node_modules/react-native.
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
  },
}));
