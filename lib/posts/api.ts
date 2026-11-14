/**
 * Seller Posts & Reels API (backend: store-backend/src/modules/posts).
 * Feature flag: EXPO_PUBLIC_POSTS_ENABLED (static read so Expo inlines it).
 */
import { fetchJson, type ApiResult } from "@/lib/api/_fetch";
import { getPostViewerId } from "./viewer";
import type {
  PostAspect, PostCta, PostKind, PostPlacement, PostStats, PostStatus, PostUploadTicket,
  FeedStore, PublicPost, SellerPost, SellerPostDetail, SellerPostListItem, SellerPostMedia, SellerPostTag,
} from "./types";

export const POSTS_ENABLED = process.env.EXPO_PUBLIC_POSTS_ENABLED === "true";

export class PostsApiError extends Error {}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) {
    // _fetch formats errors as "code: message" — show the message part.
    const msg = r.error.includes(": ") ? r.error.slice(r.error.indexOf(": ") + 2) : r.error;
    throw new PostsApiError(msg || "Something went wrong");
  }
  return r.data;
}

const S = "/api/seller/posts";

export type TagInput = { product_id: string; media_id?: string | null; x?: number | null; y?: number | null; source?: "seller" | "ai_suggested" };

export const sellerPostsApi = {
  list: (q: { status?: PostStatus; before?: string; limit?: number } = {}) =>
    unwrap(fetchJson<{ items: SellerPostListItem[]; next_cursor: string | null }>(S, {
      query: { status: q.status, before: q.before, limit: q.limit },
    })),
  get: (id: string) => unwrap(fetchJson<{ post: SellerPostDetail }>(`${S}/${id}`)).then((d) => d.post),
  create: (body: { kind: PostKind; aspect: PostAspect; caption?: string; cta?: PostCta; placements?: PostPlacement[] }) =>
    unwrap(fetchJson<{ post: SellerPost }>(S, { method: "POST", body })).then((d) => d.post),
  update: (id: string, body: Partial<{
    caption: string | null; cta: PostCta; placements: PostPlacement[]; publish_at: string | null; expires_at: string | null;
    alt_texts: { media_id: string; alt_text: string | null }[];
  }>) => unwrap(fetchJson<{ post: SellerPost }>(`${S}/${id}`, { method: "PATCH", body })).then((d) => d.post),
  remove: (id: string) => unwrap(fetchJson<{ deleted: boolean }>(`${S}/${id}`, { method: "DELETE" })),
  startImage: (id: string, f: { filename: string; contentType: string; bytes: number }) =>
    unwrap(fetchJson<PostUploadTicket>(`${S}/${id}/media`, {
      method: "POST", body: { media_type: "image", filename: f.filename, content_type: f.contentType, bytes: f.bytes },
    })),
  startVideo: (id: string, f: { contentType?: string; bytes: number; durationMs: number }) =>
    unwrap(fetchJson<PostUploadTicket>(`${S}/${id}/media`, {
      method: "POST", body: { media_type: "video", content_type: f.contentType, bytes: f.bytes, duration_ms: Math.round(f.durationMs) },
    })),
  uploaded: (id: string, mediaId: string) => unwrap(fetchJson<{ queued: boolean }>(`${S}/${id}/media/${mediaId}/uploaded`, { method: "POST" })),
  removeMedia: (id: string, mediaId: string) => unwrap(fetchJson<{ deleted: boolean }>(`${S}/${id}/media/${mediaId}`, { method: "DELETE" })),
  reorder: (id: string, ids: string[]) =>
    unwrap(fetchJson<{ media: SellerPostMedia[] }>(`${S}/${id}/media/order`, { method: "PUT", body: { ids } })).then((d) => d.media),
  setTags: (id: string, tags: TagInput[]) =>
    unwrap(fetchJson<{ tags: SellerPostTag[] }>(`${S}/${id}/products`, { method: "PUT", body: { tags } })).then((d) => d.tags),
  suggestions: (id: string) =>
    unwrap(fetchJson<{ ready: boolean; suggestions: { product_id: string; score: number }[] }>(`${S}/${id}/suggestions`)),
  submit: (id: string) => unwrap(fetchJson<{ post: SellerPost }>(`${S}/${id}/submit`, { method: "POST" })).then((d) => d.post),
  archive: (id: string) => unwrap(fetchJson<{ post: SellerPost }>(`${S}/${id}/archive`, { method: "POST" })).then((d) => d.post),
  republish: (id: string) => unwrap(fetchJson<{ post: SellerPost }>(`${S}/${id}/republish`, { method: "POST" })).then((d) => d.post),
  pin: (id: string) => unwrap(fetchJson<{ post: SellerPost }>(`${S}/${id}/pin`, { method: "POST" })).then((d) => d.post),
  unpin: (id: string) => unwrap(fetchJson<{ post: SellerPost }>(`${S}/${id}/pin`, { method: "DELETE" })).then((d) => d.post),
  stats: (id: string, days = 14) => unwrap(fetchJson<PostStats>(`${S}/${id}/stats`, { query: { days } })),
  cleanCaption: (text: string) =>
    unwrap(fetchJson<{ text: string; removed: string[] }>(`${S}/caption/clean`, { method: "POST", body: { text } })),
};

export const publicPostsApi = {
  forStore: (slug: string, q: { before?: string; limit?: number } = {}) =>
    unwrap(fetchJson<{ items: PublicPost[]; next_cursor: string | null }>(
      `/api/catalog/posts/store/${encodeURIComponent(slug)}`, { requireAuth: false, query: { before: q.before, limit: q.limit } })),
  forProduct: (productId: string) =>
    unwrap(fetchJson<{ items: PublicPost[] }>(`/api/catalog/posts/product/${productId}`, { requireAuth: false })).then((d) => d.items),
  /** Newest posts tagging any of these products (search results, category pages). */
  forProducts: (productIds: string[], limit = 10) =>
    unwrap(fetchJson<{ items: PublicPost[] }>("/api/catalog/posts/for-products", {
      requireAuth: false, query: { ids: productIds.slice(0, 40).join(","), limit },
    })).then((d) => d.items),
  /** Ranked Runway feed (reels + posts) with seen/affinity personalization. */
  feed: async (q: { offset?: number; limit?: number; kind?: "reel" | "all" } = {}) => {
    const viewer_id = await getPostViewerId();
    const data = await unwrap(fetchJson<{ items: PublicPost[]; next_offset: number | null; suggested_stores: FeedStore[] }>(
      "/api/catalog/posts/feed",
      { requireAuth: false, optionalAuth: true, query: { offset: q.offset, limit: q.limit, kind: q.kind, viewer_id } },
    ));
    // Normalize a missing cursor (old backend) so callers never loop on page 1.
    return { ...data, next_offset: typeof data.next_offset === "number" ? data.next_offset : null };
  },
  get: (id: string) => unwrap(fetchJson<{ post: PublicPost }>(`/api/catalog/posts/${id}`, { requireAuth: false })).then((d) => d.post),
};
