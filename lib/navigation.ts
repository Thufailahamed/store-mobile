import type { Router } from "expo-router";

/** Navigate to the main home screen (replaces current route). */
export function navigateHome(router: Pick<Router, "replace">) {
  router.replace("/(main)");
}
