/**
 * Driver shift state — persisted across app launches.
 * Toggles a 30s auto-refresh + records shift start time for the dashboard timer.
 * While off, no location pings, no recurring refetch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { updateDriverSelf } from "@/lib/api/driver-profile";

const SHIFT_KEY = "driver.shift.on";
const SHIFT_START_KEY = "driver.shift.startedAt";

/**
 * Shift state is stored under a device-wide (not user-scoped) key. Call this
 * on sign-out so a second driver logging in on the same device doesn't
 * inherit the previous driver's "on shift" state and start sending GPS
 * pings under their own session before ever toggling a shift on.
 */
export async function clearDriverShiftState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([SHIFT_KEY, SHIFT_START_KEY]);
  } catch {
    /* ignore */
  }
}

export interface UseDriverShiftResult {
  on: boolean;
  startedAt: string | null;
  toggle: (next?: boolean) => Promise<void>;
  /** True while shift on AND app is in foreground. */
  shouldPing: boolean;
}

export function useDriverShift(): UseDriverShiftResult {
  const [on, setOn] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [foreground, setForeground] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const [onStored, startedStored] = await Promise.all([
          AsyncStorage.getItem(SHIFT_KEY),
          AsyncStorage.getItem(SHIFT_START_KEY),
        ]);
        if (!mounted.current) return;
        setOn(onStored === "1");
        setStartedAt(startedStored);
      } catch {
        /* ignore */
      }
    })();
    const sub = AppState.addEventListener("change", (s) => setForeground(s === "active"));
    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, []);

  const toggle = useCallback(
    async (next?: boolean) => {
      const target = next ?? !on;
      setOn(target);
      if (target) {
        const now = new Date().toISOString();
        setStartedAt(now);
        await AsyncStorage.multiSet([
          [SHIFT_KEY, "1"],
          [SHIFT_START_KEY, now],
        ]);
      } else {
        setStartedAt(null);
        await AsyncStorage.multiRemove([SHIFT_KEY, SHIFT_START_KEY]);
      }
      // Persist is_active on the server so dispatcher can see the state.
      void updateDriverSelf({ is_active: target });
    },
    [on],
  );

  return {
    on,
    startedAt,
    toggle,
    shouldPing: on && foreground,
  };
}
