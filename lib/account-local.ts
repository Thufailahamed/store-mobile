import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Product, Review } from "@/lib/types";

export type PaymentBrand = "visa" | "mastercard" | "amex";

export type PaymentCard = {
  id: string;
  brand: PaymentBrand;
  last4: string;
  exp: string;
  holder: string;
  is_default: boolean;
  added: string;
  charges: number;
};

export const PAYMENT_BRAND_META: Record<
  PaymentBrand,
  { label: string; shortLabel: string; color: string }
> = {
  visa: { label: "VISA", shortLabel: "Visa", color: "#1a1f71" },
  mastercard: { label: "MASTERCARD", shortLabel: "Mastercard", color: "#eb001b" },
  amex: { label: "AMEX", shortLabel: "Amex", color: "#016fd0" },
};

/** Detect card brand from the leading digits (BIN). */
export function detectPaymentBrand(raw: string): PaymentBrand | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("4")) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^5[1-5]/.test(digits)) return "mastercard";
  // Mastercard 2-series BIN range (2221–2720)
  if (/^2(?:2(?:2[1-9]\d{2}|[3-9]\d{3})|[3-6]\d{4}|7(?:0\d{3}|1\d{3}|20\d{2}))/.test(digits)) {
    return "mastercard";
  }
  return null;
}

export function cardNumberMaxLength(brand: PaymentBrand | null): number {
  return brand === "amex" ? 15 : 16;
}

export function formatCardNumberInput(value: string, brand?: PaymentBrand | null): string {
  const digits = value.replace(/\D/g, "");
  const detected = brand ?? detectPaymentBrand(digits);
  const max = cardNumberMaxLength(detected);
  const trimmed = digits.slice(0, max);

  if (detected === "amex") {
    const parts = [trimmed.slice(0, 4), trimmed.slice(4, 10), trimmed.slice(10, 15)].filter(Boolean);
    return parts.join(" ");
  }

  return trimmed.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatCardNumberDisplay(raw: string, brand?: PaymentBrand | null): string {
  const digits = raw.replace(/\D/g, "");
  const detected = brand ?? detectPaymentBrand(digits);

  if (detected === "amex") {
    const slots = [
      digits.slice(0, 4).padEnd(4, "•"),
      digits.slice(4, 10).padEnd(6, "•"),
      digits.slice(10, 15).padEnd(5, "•"),
    ];
    return `${slots[0]} ${slots[1]} ${slots[2]}`;
  }

  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const chunk = digits.slice(i * 4, i * 4 + 4);
    if (!chunk) {
      parts.push("••••");
    } else if (chunk.length < 4) {
      parts.push(chunk + "•".repeat(4 - chunk.length));
    } else {
      parts.push(chunk);
    }
  }
  return parts.join(" ");
}

export function isValidCardNumber(raw: string, brand?: PaymentBrand | null): boolean {
  const digits = raw.replace(/\D/g, "");
  const detected = brand ?? detectPaymentBrand(digits);
  if (!detected) return false;
  const len = cardNumberMaxLength(detected);
  return digits.length === len;
}

export function cvvMaxLength(brand: PaymentBrand | null): number {
  return brand === "amex" ? 4 : 3;
}

export type MobileReview = {
  id: string;
  product: string;
  productSlug?: string;
  variant: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  helpful: number;
  photos: number;
  status: "published" | "pending";
  isVerifiedPurchase?: boolean;
};

export type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "refunded";

export type ReturnRequest = {
  id: string;
  return_group_id: string;
  return_number: string;
  order_id: string;
  order_number: string;
  order_status: string;
  currency: string;
  reason: string;
  status: ReturnStatus;
  refund_amount: number;
  created_at: string;
  updated_at: string;
  received_at: string | null;
  seller_note: string | null;
  cancelled_at?: string | null;
  items: {
    return_id: string;
    order_item_id: string;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price: number;
    refund_amount: number;
  }[];
};

export type RecentlyViewedProduct = Pick<Product, "id" | "name" | "slug" | "price" | "currency" | "images">;

const guestId = "guest";

export function accountStorageKey(userId: string | null | undefined, suffix: string) {
  return `luxe:${userId ?? guestId}:${suffix}`;
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getStoredPayments(userId?: string | null): Promise<PaymentCard[]> {
  return readJson<PaymentCard[]>(accountStorageKey(userId, "payments"), []);
}

export async function setStoredPayments(userId: string | null | undefined, payments: PaymentCard[]) {
  await writeJson(accountStorageKey(userId, "payments"), payments);
}

export async function getStoredReviews(userId?: string | null): Promise<MobileReview[]> {
  return readJson<MobileReview[]>(accountStorageKey(userId, "reviews"), []);
}

export async function setStoredReviews(userId: string | null | undefined, reviews: MobileReview[]) {
  await writeJson(accountStorageKey(userId, "reviews"), reviews);
}

export async function getRecentlyViewedIds(userId?: string | null): Promise<string[]> {
  const raw = await readJson<Array<string | RecentlyViewedProduct>>(
    accountStorageKey(userId, "recently_viewed"),
    []
  );
  return raw
    .map((entry) => (typeof entry === "string" ? entry : entry?.id))
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** @deprecated Use getRecentlyViewedIds — product rows are loaded from the database. */
export async function getRecentlyViewed(userId?: string | null): Promise<RecentlyViewedProduct[]> {
  return readJson<RecentlyViewedProduct[]>(accountStorageKey(userId, "recently_viewed"), []);
}

export async function recordRecentlyViewed(userId: string | null | undefined, productId: string) {
  const existing = await getRecentlyViewedIds(userId);
  const next = [productId, ...existing.filter((id) => id !== productId)].slice(0, 10);
  await writeJson(accountStorageKey(userId, "recently_viewed"), next);
}

export function mapReview(row: Review & { product?: { name?: string | null; slug?: string | null } | null }): MobileReview {
  return {
    id: row.id,
    product: row.product?.name ?? "Product",
    productSlug: row.product?.slug ?? undefined,
    variant: "Standard",
    rating: row.rating,
    title: row.title ?? "",
    body: row.content ?? "",
    date: row.created_at,
    helpful: row.helpful_count ?? 0,
    photos: row.photos?.length ?? 0,
    status: row.status === "approved" ? "published" : "pending",
    isVerifiedPurchase: row.is_verified_purchase,
  };
}
