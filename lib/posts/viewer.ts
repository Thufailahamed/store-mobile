/**
 * Stable per-install viewer id for post personalization.
 *
 * The same id is sent with engagement events and with the ranked feed request,
 * so anonymous shoppers still get seen-post suppression and store/product
 * affinity. Signed-in users additionally match by user id on the server.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const VIEWER_KEY = "luxe-post-viewer-v1";

let viewerId: string | null = null;

function randomId() {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function getPostViewerId(): Promise<string> {
  if (viewerId) return viewerId;
  try {
    viewerId = (await AsyncStorage.getItem(VIEWER_KEY)) ?? null;
    if (!viewerId) {
      viewerId = `m_${randomId()}`;
      await AsyncStorage.setItem(VIEWER_KEY, viewerId);
    }
  } catch {
    // Privacy-restricted storage or a test runtime: keep it in memory only.
    viewerId = `m_session_${randomId()}`;
  }
  return viewerId;
}
