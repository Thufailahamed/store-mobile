import { type ClassValue, clsx } from "clsx";

export { resolveImageUrl } from "./resolve-image-url";
export { uuidv4 } from "./uuid";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(
  value: number,
  currency: string = "LKR",
  locale: string = "en-LK"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * @deprecated Delivery is now always charged (only free-shipping coupons
 * waive it). Kept for legacy callers; do not use for pricing.
 */
export const FREE_SHIPPING_THRESHOLD = 15000;

/**
 * Buyer fees, admin-editable on web /admin/settings and served by
 * GET /api/checkout/pricing (see useCheckoutPricing). These defaults only
 * apply until it loads. The platform fee is stored in `orders.tax`.
 */
export type CheckoutPricing = {
  platform_fee_pct: number;
  delivery_fee: number;
  express_fee: number;
  overnight_fee: number;
};

export const DEFAULT_CHECKOUT_PRICING: CheckoutPricing = {
  platform_fee_pct: 8,
  delivery_fee: 500,
  express_fee: 1500,
  overnight_fee: 3500,
};

/** @deprecated Use `pricing.platform_fee_pct / 100`. */
export const TAX_RATE = DEFAULT_CHECKOUT_PRICING.platform_fee_pct / 100;
export const DEFAULT_SHIPPING_FEE = DEFAULT_CHECKOUT_PRICING.delivery_fee;

export const SHIPPING_OPTIONS = [
  { key: "standard" as const, label: "Standard", desc: "5–7 business days", fee: DEFAULT_CHECKOUT_PRICING.delivery_fee, minDays: 5, maxDays: 7 },
  { key: "express" as const, label: "Express", desc: "1–2 business days", fee: DEFAULT_CHECKOUT_PRICING.express_fee, minDays: 1, maxDays: 2 },
  { key: "overnight" as const, label: "Overnight", desc: "Next business day", fee: DEFAULT_CHECKOUT_PRICING.overnight_fee, minDays: 1, maxDays: 1 },
];

export type ShippingKey = (typeof SHIPPING_OPTIONS)[number]["key"];

export function discountPct(mrp: number, price: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** Stored tax_rate is a 0–1 fraction. Values > 1 are treated as a legacy percent. */
export function taxRateToPercent(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const pct = rate <= 1 ? rate * 100 : rate;
  return Math.round(pct * 10) / 10;
}

/** Convert a 0–100 percent field into the stored 0–1 tax_rate. */
export function percentToTaxRate(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}
