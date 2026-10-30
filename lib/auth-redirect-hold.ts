import { useSyncExternalStore } from "react";

/**
 * Lets a screen briefly hold the root layout's "signed in → leave (auth)"
 * redirect, e.g. so the OTP screen can finish its "Verified" animation after
 * the session lands. The hold always auto-releases so sign-in can't get stuck.
 */

let held = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function holdAuthRedirect(maxMs = 8000) {
  clearTimeout(timer);
  timer = setTimeout(releaseAuthRedirect, maxMs);
  if (held) return;
  held = true;
  emit();
}

export function releaseAuthRedirect() {
  clearTimeout(timer);
  if (!held) return;
  held = false;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuthRedirectHeld(): boolean {
  return useSyncExternalStore(subscribe, () => held, () => held);
}
