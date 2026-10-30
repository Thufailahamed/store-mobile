/**
 * LUXE Mobile — reliable one-shot device position.
 *
 * `getCurrentPositionAsync({ accuracy: High })` alone is flaky on Android
 * release builds: it can hang forever indoors (GPS-only fix), throws when the
 * user has location switched off, and never asks to turn it on. This helper:
 *   1. asks for foreground permission,
 *   2. on Android, prompts the system "turn on location" dialog if needed,
 *   3. tries a fresh Balanced fix with a hard timeout,
 *   4. falls back to the last known position so the user always gets *something*.
 */

import { Platform } from "react-native";
import * as Location from "expo-location";

export class LocationError extends Error {
  constructor(
    public code: "permission" | "services" | "unavailable",
    message: string
  ) {
    super(message);
    this.name = "LocationError";
  }
}

export interface DevicePosition {
  lat: number;
  lng: number;
  accuracy: number | null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

function toPosition(pos: Location.LocationObject | null): DevicePosition | null {
  if (!pos) return null;
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

export async function getDevicePosition(opts: { timeoutMs?: number } = {}): Promise<DevicePosition> {
  const timeoutMs = opts.timeoutMs ?? 10000;

  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    throw new LocationError(
      "permission",
      perm.canAskAgain === false
        ? "Location permission is blocked. Enable it for LUXE in your phone settings."
        : "Allow location access to auto-fill your address."
    );
  }

  let servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesOn && Platform.OS === "android") {
    // Shows the Google Play "Turn on device location" dialog in-app.
    try {
      await Location.enableNetworkProviderAsync();
      servicesOn = true;
    } catch {
      servicesOn = false;
    }
  }
  if (!servicesOn) {
    throw new LocationError("services", "Turn on location services to auto-fill your address.");
  }

  // 1. Check last known position immediately (resolves in ~5ms) as a safety fallback
  const lastKnown = toPosition(
    await Location.getLastKnownPositionAsync().catch(() => null)
  );

  // 2. Try High accuracy fix first with a fast timeout (up to 5s) for precise pinpointing
  const freshHigh = toPosition(
    await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      Math.min(timeoutMs, 5000)
    )
  );
  if (freshHigh) return freshHigh;

  // 3. Try Balanced fix (wifi/cell triangulation) with up to 4s
  const freshBalanced = toPosition(
    await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      Math.min(timeoutMs, 4000)
    )
  );
  if (freshBalanced) return freshBalanced;

  // 4. Return last known position if fresh fix timed out
  if (lastKnown) return lastKnown;

  // 5. Final fallback attempt
  const finalFallback = toPosition(
    await Location.getLastKnownPositionAsync().catch(() => null)
  );
  if (finalFallback) return finalFallback;

  throw new LocationError(
    "unavailable",
    "Couldn't get a GPS fix. Move near a window or drop the pin on the map."
  );
}
