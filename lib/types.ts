/* ------------------------------------------------------------------ */
/*  LUXE Mobile — shared types (mirrors web/src/types/index.ts)       */
/* ------------------------------------------------------------------ */

export type UserRole = "customer" | "store_owner" | "brand_owner" | "admin" | "influencer" | "delivery" | "delivery_company";
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected" | "active" | "suspended" | "banned";
export type ProductStatus = "draft" | "pending" | "active" | "archived" | "rejected";
export type ProductType = "simple" | "variable";
export type Gender = "men" | "women" | "kids" | "unisex";
export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "returned" | "refunded" | "failed_attempt";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
export type PaymentMethod = "stripe" | "payhere" | "paypal" | "cod" | "wallet" | "gift_card" | "koko";
export type CouponType = "percentage" | "fixed" | "free_shipping" | "bxgy";

export interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  loyalty_points?: number;
  referral_code?: string;
  created_at: string;
}

export interface Category {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  icon?: string;
  gender?: Gender;
  position: number;
  is_active: boolean;
  children?: Category[];
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  status: ApprovalStatus;
  rating: number;
  total_reviews: number;
  total_followers: number;
  total_products: number;
  total_sales: number;
  is_featured?: boolean;
  homepage_order?: number;
  created_at?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number_last4?: string | null;
  is_online?: boolean;
}

export interface Brand {
  id: string;
  owner_id?: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  status: ApprovalStatus;
  rating: number;
  total_followers: number;
  total_products: number;
  is_featured?: boolean;
  homepage_order?: number;
}

export interface Product {
  id: string;
  store_id: string;
  brand_id?: string;
  category_id?: string;
  name: string;
  slug: string;
  sku?: string;
  product_type: ProductType;
  description?: string;
  short_description?: string;
  mrp: number;
  price: number;
  currency: string;
  discount_pct: number;
  tax_rate: number;
  status: ProductStatus;
  gender?: Gender;
  material?: string;
  pattern?: string;
  fit?: string;
  sleeve?: string;
  occasion?: string;
  season?: string;
  care_instructions?: string;
  tags: string[];
  attributes?: Record<string, unknown>;
  is_featured: boolean;
  is_active: boolean;
  risk_score?: number | null;
  is_flagged?: boolean | null;
  auto_approved?: boolean | null;
  suspicious_reasons?: { rule_id: string; message: string; weight: number; blocking: boolean }[] | null;
  rating: number;
  total_reviews: number;
  total_sales: number;
  view_count: number;
  wishlist_count: number;
  created_at: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  brand?: Brand;
  store?: Store;
  category?: Category;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku?: string;
  size?: string;
  color?: string;
  color_hex?: string;
  material?: string;
  mrp?: number;
  price?: number;
  image_url?: string;
  position: number;
  is_active: boolean;
  stock?: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text?: string;
  media_type: "image" | "video" | "360";
  position: number;
  is_primary: boolean;
}

export interface Review {
  id: string;
  user_id: string;
  product_id: string;
  order_item_id?: string | null;
  rating: number;
  title?: string;
  content?: string;
  photos: string[];
  videos?: string[];
  is_verified_purchase: boolean;
  helpful_count: number;
  status: ApprovalStatus;
  created_at: string;
  user?: Pick<User, "id" | "full_name" | "avatar_url">;
}

export interface EligibleReviewOrder {
  order_item_id: string;
  order_id: string;
  order_number: string;
  delivered_at: string | null;
  quantity: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  store_id: string;
  quantity: number;
  unit_price: number;
  saved_for_later?: boolean;
  product?: Product;
  variant?: ProductVariant;
}

export interface Address {
  id: string;
  user_id: string;
  type: "home" | "work" | "other";
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  notes?: string;
  delivered_at?: string | null;
  placed_at: string;
  items?: OrderItem[];
  address?: Address;
  route_id?: string | null;
  delivery_person_id?: string | null;
  shipping_address?: {
    full_name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  /* ---- Failure-recovery fields (Phase 14) ------------------------- *
   * All optional — server may not yet return them. Mobile reads with  *
   * `??` defaults and degrades gracefully.                             */
  /** Categorical reason for the most-recent failure. */
  failure_reason?: import("@/lib/utils/delivery-format").IssueReason | null;
  /** Free-text elaboration on the failure. */
  failure_notes?: string | null;
  /** Public URL of the uploaded failure-evidence photo (if any). */
  failure_evidence_url?: string | null;
  /** ISO timestamp when the order was most recently marked failed. */
  failed_at?: string | null;
  /** Number of fail_delivery transitions on this order so far. */
  attempt_count?: number | null;
  /** Number of reschedules from `returned` to `out_for_delivery`. */
  reschedule_count?: number | null;
  /** ISO timestamp the buyer / system proposed for the next retry. */
  next_retry_at?: string | null;
  /** Previous rider id, set when admin reassigned the package. */
  handoff_rider_id?: string | null;
  /** ISO timestamp of the most recent rider handoff. */
  handoff_at?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  store_id: string;
  product_name: string;
  variant_label?: string;
  quantity: number;
  unit_price: number;
  total: number;
  status: OrderStatus;
  product?: Product;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  link?: string;
  position: string;
  cta_text?: string;
  display_order: number;
  is_active: boolean;
  accent_color?: string | null;
  text_color?: string | null;
  bg_color?: string | null;
}

/* -------------------- Delivery driver shapes -------------------- */

export type DriverType = "pickup" | "last_mile" | "both";

export interface DriverProfile {
  member_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  company_role: "owner" | "manager" | "driver";
  driver_type: DriverType;
  vehicle_type: string | null;
  capacity_max: number;
  is_active: boolean;
  joined_at: string | null;
  last_known_lat: number | null;
  last_known_lng: number | null;
  last_ping_at: string | null;
  serviceable_postal_codes: string[];
  home_warehouse_id: string | null;
  home_warehouse: { id: string; name: string } | null;
  company: { id: string; name: string; slug: string; status: string } | null;
}

export interface DriverMetrics {
  delivered: number;
  failed: number;
  returned: number;
  cancelled: number;
  total_assigned: number;
  success_rate: number;
  cod_collected: number;
  avg_delivery_minutes: number;
  daily: { date: string; delivered: number; failed: number; cod: number }[];
}

export interface HomepageSection {
  slug: string;
  label: string;
  kicker?: string;
  title?: string;
  subtitle?: string;
  enabled: boolean;
  position: number;
}

export type HomepageProductSection =
  | "todays_edit"
  | "trending_rail"
  | "new_arrivals_rail"
  | "editors_picks_rail"
  | "parallax_grid";

export interface HomepagePromise {
  n: string;
  title: string;
  description: string;
  icon?: string;
}

export interface Testimonial {
  id: string;
  body: string;
  name: string;
  place: string;
  piece: string;
  accent?: string;
  display_order?: number;
}

export interface Tenet {
  id: string;
  n: string;
  title: string;
  body: string;
  tag: string;
  display_order?: number;
}

export interface HeroMeta {
  issue_no: string;
  top_caption: string;
  kpi_ateliers_n: string;
  kpi_ateliers_l: string;
  kpi_pieces_n: string;
  kpi_pieces_l: string;
  kpi_members_n: string;
  kpi_members_l: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  cover_image?: string;
  published_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Virtual wardrobe                                                    */
/* ------------------------------------------------------------------ */

export type GarmentType =
  | "top"
  | "bottom"
  | "dress"
  | "footwear"
  | "bag"
  | "accessory"
  | "jewelry"
  | "watch"
  | "beauty"
  | "other";

export type WardrobeItemSource = "order" | "manual";
export type WardrobeItemStatus = "active" | "archived" | "sold" | "donated";
export type OutfitSlot =
  | "top"
  | "bottom"
  | "shoes"
  | "accessory"
  | "outerwear"
  | "dress"
  | "other";

export interface WardrobeHeader {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface WardrobeItem {
  id: string;
  user_id: string;
  wardrobe_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  store_id: string | null;
  brand_name: string | null;
  name: string;
  image_url: string | null;
  category_slug: string | null;
  garment_type: GarmentType;
  size: string | null;
  color: string | null;
  status: WardrobeItemStatus;
  season: string | null;
  occasion: string | null;
  tags: string[];
  notes: string | null;
  source: WardrobeItemSource;
  purchase_price: number | null;
  currency: string;
  purchased_at: string | null;
  wear_count: number;
  last_worn_at: string | null;
  cost_per_wear: number | null;
  created_at: string;
  updated_at: string;
}

export interface WardrobeOutfitItemLink {
  id: string;
  outfit_id: string;
  wardrobe_item_id: string;
  slot: OutfitSlot;
  position: number;
  item?: WardrobeItem | null;
}

export interface WardrobeOutfit {
  id: string;
  wardrobe_id: string;
  name: string;
  occasion: string | null;
  season: string | null;
  notes: string | null;
  is_public: boolean;
  share_token: string | null;
  scheduled_for?: string | null; // YYYY-MM-DD
  weather?: string | null;
  times_logged?: number;
  created_at: string;
  updated_at: string;
  items?: WardrobeOutfitItemLink[];
}

/* ---- Wardrobe v2 (migration 0182) ---- */

export type OutfitWeather = "sunny" | "rainy" | "cold" | "warm" | "mild" | string;

export interface WardrobeOverlapItem {
  product_id: string;
  wardrobe_item_id: string;
  garment_type: GarmentType | string;
  wear_count: number;
  cost_per_wear: number | null;
  last_worn_at: string | null;
  purchased_at: string | null;
}

export interface AutoOutfitPiece {
  wardrobe_item_id: string;
  product_id: string | null;
  garment_type: GarmentType | string;
  image_url: string | null;
  name: string;
  wear_count: number;
}

export interface AutoOutfit {
  slot_rule: "dress+shoes" | "top+bottom+shoes";
  occasion: string | null;
  season: string | null;
  pieces: AutoOutfitPiece[];
}

export interface AutoOutfitResult {
  generated_at: string;
  count: number;
  outfits: AutoOutfit[];
}

export interface WardrobeInsightsCounts {
  never_worn: number;
  underused: number;
  care_due: number;
  recent: number;
}

export interface WardrobeInsights {
  as_of: string;
  counts: WardrobeInsightsCounts;
  never_worn: WardrobeItem[];
  underused: WardrobeItem[];
  care_due: WardrobeItem[];
  recent_wears: WardrobeItem[];
}

export interface WardrobeStatsTotals {
  total_items: number;
  total_wears: number;
  total_spent: number;
  avg_cost_per_wear: number | null;
}

export interface WardrobeStatsByGarment {
  garment_type: GarmentType;
  n: number;
  total_spent: number;
}

export interface WardrobeStatsTopWorn {
  id: string;
  name: string;
  image_url: string | null;
  garment_type: GarmentType;
  wear_count: number;
}

export interface WardrobeStats {
  totals: WardrobeStatsTotals;
  byGarment: WardrobeStatsByGarment[];
  topWorn: WardrobeStatsTopWorn[];
}

export interface PublicWardrobeItem {
  id: string;
  name: string;
  image_url: string | null;
  garment_type: GarmentType;
  color: string | null;
  wear_count: number;
}

export interface PublicWardrobeOutfitLink {
  id: string;
  name: string;
  occasion: string | null;
  season: string | null;
  slot: string | null;
  item: { name: string; wear_count: number } | null;
}

export interface PublicWardrobePayload {
  type: "wardrobe";
  wardrobe: { id: string; name: string; created_at: string };
  items: PublicWardrobeItem[];
  outfits: PublicWardrobeOutfitLink[];
}

export interface PublicOutfitPayload {
  type: "outfit";
  outfit: {
    id: string;
    name: string;
    occasion: string | null;
    season: string | null;
    created_at: string;
  };
  items: Array<{
    id: string;
    slot: string | null;
    item: PublicWardrobeItem | null;
  }>;
}

export type PublicWardrobeResponse = PublicWardrobePayload | PublicOutfitPayload;
