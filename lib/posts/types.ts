/** Seller Posts & Reels — shapes returned by the backend (store-backend/src/modules/posts). */
import type { PostAspect, PostCta, PostKind, PostPlacement, PostStatus } from "./limits";

export type { PostAspect, PostCta, PostKind, PostPlacement, PostStatus };

/** Public (shopper) post — /api/catalog/posts/*. */
export interface PublicPostMedia {
  id: string;
  type: "image" | "video";
  url: string;
  poster_url: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  blurhash: string | null;
  alt: string | null;
}

export interface PublicPostProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  mrp: number | null;
  currency: string | null;
  image_url: string | null;
  in_stock: boolean;
  media_id: string | null;
  x: number | null;
  y: number | null;
}

export interface PublicPost {
  id: string;
  kind: PostKind;
  aspect: PostAspect;
  caption: string | null;
  cta: PostCta;
  published_at: string;
  pinned: boolean;
  /** `followers` is only filled by the reels feed. */
  store: { id: string; slug: string; name: string; logo_url: string | null; followers?: number };
  media: PublicPostMedia[];
  products: PublicPostProduct[];
}

/** Store suggestion shown at the end of the reels feed. */
export interface FeedStore {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  total_followers: number | null;
  total_products: number | null;
}

/** Seller shapes — /api/seller/posts*. */
export interface SellerPostMedia {
  id: string;
  post_id: string;
  position: number;
  media_type: "image" | "video";
  source_key: string | null;
  url: string | null;
  poster_url: string | null;
  provider_uid: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  bytes: number | null;
  state: "uploaded" | "processing" | "ready" | "failed";
  error: string | null;
  alt_text: string | null;
}

export interface SellerPostTag {
  product_id: string;
  media_id: string | null;
  x: number | null;
  y: number | null;
  position: number;
  source: "seller" | "ai_suggested";
  product: { id: string; name: string; slug: string; price: number; mrp: number | null; status: string; image_url: string | null } | null;
}

export interface SellerPost {
  id: string;
  store_id: string;
  kind: PostKind;
  status: PostStatus;
  caption: string | null;
  cta: PostCta;
  placements: PostPlacement[];
  publish_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  pinned_at: string | null;
  cover_media_id: string | null;
  aspect: PostAspect;
  moderation: {
    reasons?: { code: string; message: string }[];
    suggestions?: { product_id: string; score: number }[];
  } & Record<string, unknown>;
  rejection_reason: string | null;
  views_count: number;
  clicks_count: number;
  created_at: string;
  updated_at: string;
}

export interface SellerPostListItem extends SellerPost {
  cover: { id: string; media_type: "image" | "video"; url: string | null; poster_url: string | null; state: SellerPostMedia["state"] } | null;
  media_count: number;
  tag_count: number;
  hidden_reason: "all_products_unavailable" | null;
}

export interface SellerPostDetail extends SellerPost {
  media: SellerPostMedia[];
  tags: SellerPostTag[];
}

export interface PostUploadTarget { method: "PUT"; url: string; headers: Record<string, string> }

export interface PostUploadTicket {
  media: SellerPostMedia;
  upload:
    | (PostUploadTarget & { expires_at?: string })
    | { method: "TUS"; url: string; expires_at: string };
  /** Reels stored in R2: the app also uploads a cover frame and 3 moderation frames. */
  poster?: PostUploadTarget;
  frames?: PostUploadTarget[];
}

export interface PostStats {
  days: number;
  series: { day: string; impressions: number; views: number; completes: number; watch_ms: number; product_clicks: number; add_to_carts: number }[];
  totals: {
    impressions: number; views: number; completes: number; watch_ms: number; product_clicks: number; add_to_carts: number;
    avg_watch_ms: number; click_rate: number;
  };
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  processing: "Processing",
  in_review: "In review",
  published: "Live",
  rejected: "Rejected",
  archived: "Archived",
};
