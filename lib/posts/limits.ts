/**
 * Seller Posts & Reels limits.
 *
 * MIRRORED: store-backend/src/modules/posts/limits.ts ⇄ store-mobile/lib/posts/limits.ts
 * (mobile is the only seller/buyer client). Keep both files identical; the
 * DB triggers in 20261113120000_seller_posts.sql enforce the same counts.
 */
export const POST_LIMITS = {
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 200 * 1024 * 1024,
  videoMinDurationMs: 3_000,
  videoMaxDurationMs: 90_000,
  mediaMax: 10,
  carouselMin: 2,
  tagsMax: 10,
  captionMax: 1000,
  altTextMax: 300,
  postsPerDay: 10,
  pinsMax: 3,
  imageTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  videoTypes: ["video/mp4", "video/quicktime"],
  aspects: ["1:1", "4:5", "9:16"],
  kinds: ["poster", "carousel", "reel"],
  ctas: ["shop", "view_store", "none"],
  /** Seller-selectable placements. 'followers_push' arrives later. */
  placements: ["store", "product", "discover"],
} as const;

export type PostKind = (typeof POST_LIMITS.kinds)[number];
export type PostAspect = (typeof POST_LIMITS.aspects)[number];
export type PostCta = (typeof POST_LIMITS.ctas)[number];
export type PostPlacement = (typeof POST_LIMITS.placements)[number];
export type PostStatus = "draft" | "processing" | "in_review" | "published" | "rejected" | "archived";
