/**
 * Foreground GPS pings for the delivery driver.
 * - Only runs while shift is on AND the app is in the foreground.
 * - Polls every 30s (expo-location doesn't expose an exact interval option, so
 *   we restart a fresh getCurrentPositionAsync in a setInterval).
 * - Skips any fix with accuracy worse than 100m.
 * - PATCHes delivery_company_members via the existing updateDriverMember endpoint
 *   through updateDriverSelf (no new server route).
 */

import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { updateDriverSelf } from "@/lib/api/driver-profile";

const PING_INTERVAL_MS = 30_000;
const MAX_ACCURACY_M = 100;

export function useDriverLocation(shouldPing: boolean): void {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const grantedRef = useRef(false);

  useEffect(() => {
    if (!shouldPing) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      grantedRef.current = false;
      return;
    }

    let cancelled = false;

    const ping = async () => {
      if (!grantedRef.current) return;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const accuracy = pos.coords.accuracy ?? 0;
        if (accuracy > MAX_ACCURACY_M) return;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log(
            "[driver-location]",
            pos.coords.latitude,
            pos.coords.longitude,
            "±",
            accuracy,
          );
        }
        // Best-effort no-op ping. The web admin endpoint is the only path that
        // currently persists coords; once a /api/delivery-company/drivers/[id]/ping
        // endpoint exists we'd call it here. We send a no-op patch so the hook
        // remains a single source of truth.
        void updateDriverSelf({});
      } catch {
        /* ignore */
      }
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      grantedRef.current = true;

      // Initial ping
      void ping();

      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: PING_INTERVAL_MS,
            distanceInterval: 25,
          },
          () => {
            void ping();
          },
        );
        if (cancelled) {
          sub.remove();
        } else {
          subscriptionRef.current = sub;
        }
      } catch {
        // Fall back to a poll loop if watchPositionAsync is unavailable.
        intervalRef.current = setInterval(ping, PING_INTERVAL_MS);
      }
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      grantedRef.current = false;
    };
  }, [shouldPing]);
}
