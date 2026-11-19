import type { Router } from "expo-router";

/** Navigate to the main home screen (replaces current route). */
export function navigateHome(router: Pick<Router, "replace">) {
  router.replace("/(main)");
}

/**
 * Back to the previous screen, like the Android back gesture. Falls back
 * to Home only when there is no history (cold start from a deep link).
 */
export function goBack(router: Pick<Router, "back" | "canGoBack" | "replace">) {
  if (router.canGoBack()) router.back();
  else navigateHome(router);
}
