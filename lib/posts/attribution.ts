/**
 * Post → add-to-cart attribution, kept free of React Native imports so the
 * cart store (and its tests) can depend on it.
 *
 * Tapping a product in a post records it here for 30 min; the cart store calls
 * notePostCartAdd() on every add, which reports one add_to_cart for the post
 * through the reporter registered by lib/posts/track.ts.
 */
export type AttributionSurface = "store" | "pdp" | "viewer" | "share" | "home" | "discover";

const TTL_MS = 30 * 60 * 1000;
const pending = new Map<string, { post_id: string; surface: AttributionSurface; at: number }>();
let reporter: ((postId: string, productId: string, surface: AttributionSurface) => void) | null = null;

export function setPostCartReporter(fn: typeof reporter) {
  reporter = fn;
}

export function rememberPostProduct(postId: string, productId: string, surface: AttributionSurface) {
  pending.set(productId, { post_id: postId, surface, at: Date.now() });
}

export function notePostCartAdd(productId: string) {
  const hit = pending.get(productId);
  if (!hit) return;
  pending.delete(productId);
  if (Date.now() - hit.at > TTL_MS) return;
  reporter?.(hit.post_id, productId, hit.surface);
}
