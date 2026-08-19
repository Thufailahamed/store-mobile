/**
 * Mobile anon session token management (0260).
 *
 * Mirrors the web's `luxe_anon_sid` cookie via AsyncStorage. The HMAC-
 * signed token is opaque client-side; backend verifies with ANON_SID_SECRET.
 *
 * RN has no automatic cookie jar — the cookie is forwarded as a literal
 * `Cookie:` header by callers that need to send it (see
 * `lib/api/backend.ts:appendEventsBackend`).
 *
 * Token format: `<base64url(payload)>.<base64url(hmac_sha256)>`
 *   payload = { anon_sid: uuid, user_id: null|uuid, iat: epoch }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchJson } from "@/lib/api/_fetch";

export const ANON_SID_STORAGE_KEY = "luxe:anon_sid";

/** Read the persisted anon_sid token (or null if not yet minted). */
export async function readAnonSidCookie(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ANON_SID_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persist a freshly-minted token returned by /api/recommender/track. */
export async function writeAnonSidCookie(token: string): Promise<void> {
  if (!token || token.length < 20) return;
  try {
    await AsyncStorage.setItem(ANON_SID_STORAGE_KEY, token);
  } catch {
    // ignore — best-effort.
  }
}

/** Clear the persisted token (called after a successful merge). */
export async function clearAnonSidCookie(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ANON_SID_STORAGE_KEY);
  } catch {
    // ignore.
  }
}

/**
 * Merge the pre-login anon signals into the newly-signed-in user.
 * Idempotent server-side. Clears the local token on success so the next
 * sign-out doesn't replay it.
 *
 * Returns true when a merge was attempted (regardless of success), false
 * when no anon token was present to merge.
 */
export async function mergeAnonSessionOnLogin(): Promise<boolean> {
  const token = await readAnonSidCookie();
  if (!token) return false;
  try {
    const res = await fetchJson<{ merged: number }>("/api/recommender/merge-anon", {
      method: "POST",
      body: { anon_sid: token },
    });
    if (res.ok) {
      await clearAnonSidCookie();
      return true;
    }
  } catch {
    // Network error — leave token intact for the next login attempt.
  }
  return false;
}