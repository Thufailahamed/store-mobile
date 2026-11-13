import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAppVersionPolicyBackend } from "@/lib/api/backend";
import {
  POLICY_REFRESH_MS,
  isValidVersion,
  parsePolicy,
  safeStoreUrl,
  shouldBlock,
  shouldShowBanner,
  type AppVersionPolicy,
  type BannerDismissal,
} from "@/lib/app-update/policy";

const DISMISS_KEY = "vestara_update_banner_dismissed";

/**
 * Version the policy is compared against. `EXPO_PUBLIC_APP_VERSION_OVERRIDE`
 * lets a dev build pretend to be another release to test the prompts; it is
 * ignored in release builds.
 */
export function getInstalledVersion(): string {
  const override = process.env.EXPO_PUBLIC_APP_VERSION_OVERRIDE;
  if (__DEV__ && isValidVersion(override)) return override;
  return Constants.expoConfig?.version ?? "0.0.0";
}

async function readDismissal(): Promise<BannerDismissal | null> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<BannerDismissal>;
    return typeof v.latest === "string" && typeof v.at === "number" ? { latest: v.latest, at: v.at } : null;
  } catch {
    return null;
  }
}

/**
 * Checks the backend version policy on launch and whenever the app returns
 * to the foreground (at most every 15 min). Fails open: any network/parse
 * error leaves `policy` as it was (null on first launch) so an outage can
 * never lock users out.
 */
export function useAppUpdate() {
  const installed = getInstalledVersion();
  const [policy, setPolicy] = useState<AppVersionPolicy | null>(null);
  const [dismissal, setDismissal] = useState<BannerDismissal | null>(null);
  const lastFetchRef = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < POLICY_REFRESH_MS) return;
    lastFetchRef.current = now;
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    try {
      const res = await getAppVersionPolicyBackend(Platform.OS, installed);
      if (!res.ok) return;
      const parsed = parsePolicy(res.data);
      if (parsed) setPolicy(parsed);
    } catch {
      // fail open
    }
  }, [installed]);

  useEffect(() => {
    void readDismissal().then(setDismissal);
    void refresh(true);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const dismissBanner = useCallback(() => {
    if (!policy) return;
    const next: BannerDismissal = { latest: policy.latest, at: Date.now() };
    setDismissal(next);
    AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(next)).catch(() => {});
  }, [policy]);

  const openStore = useCallback(async () => {
    const url = safeStoreUrl(policy?.store_url);
    if (!url) return false;
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }, [policy?.store_url]);

  return {
    installed,
    policy,
    blocked: shouldBlock(policy, installed),
    bannerVisible: shouldShowBanner(policy, installed, dismissal),
    hasStoreUrl: !!safeStoreUrl(policy?.store_url),
    dismissBanner,
    openStore,
    recheck: () => refresh(true),
  };
}
