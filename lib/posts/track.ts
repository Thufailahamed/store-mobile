/**
 * Post engagement events → POST /api/catalog/posts/events (batched every 4 s,
 * flushed when the app backgrounds). Impressions / views / completes are sent
 * once per post per app session.
 *
 * Attribution: tapping a product in a post remembers it for 30 min
 * (./attribution.ts); the cart store reports a later add-to-cart for it.
 */
import { fetchJson, getAccessToken } from "@/lib/api/_fetch";
import { POSTS_ENABLED } from "./api";
import { rememberPostProduct, setPostCartReporter } from "./attribution";
import { getPostViewerId } from "./viewer";

export type PostEventType = "impression" | "view" | "complete" | "product_click" | "add_to_cart" | "share";
export type PostSurface = "store" | "pdp" | "viewer" | "share" | "home" | "discover";

interface PostEvent {
  post_id: string;
  type: PostEventType;
  surface: PostSurface;
  product_id?: string | null;
  watch_ms?: number | null;
}

let queue: PostEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seen = new Set<string>();
let appStateHooked = false;

async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const token = await getAccessToken().catch(() => null);
  await fetchJson("/api/catalog/posts/events", {
    method: "POST",
    requireAuth: false,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: { viewer_id: await getPostViewerId(), events },
  }).catch(() => undefined);
  if (queue.length) void flush();
}

/** Flush when the app backgrounds. Hooked lazily so non-RN contexts (tests) never touch AppState. */
function hookAppState() {
  if (appStateHooked) return;
  appStateHooked = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require("react-native") as typeof import("react-native");
    AppState?.addEventListener?.("change", (s) => {
      if (s !== "active") void flush();
    });
  } catch {
    /* not in a React Native runtime */
  }
}

export function trackPost(e: PostEvent) {
  if (!POSTS_ENABLED) return;
  hookAppState();
  if (e.type === "impression" || e.type === "view" || e.type === "complete") {
    const key = `${e.type}:${e.post_id}`;
    if (seen.has(key)) return;
    seen.add(key);
  }
  queue.push(e);
  if (queue.length >= 20) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), 4000);
}

/** Shopper tapped a product in a post. */
export function notePostProductClick(postId: string, productId: string, surface: PostSurface) {
  trackPost({ post_id: postId, type: "product_click", surface, product_id: productId });
  rememberPostProduct(postId, productId, surface);
}

setPostCartReporter((postId, productId, surface) =>
  trackPost({ post_id: postId, type: "add_to_cart", surface, product_id: productId }));
