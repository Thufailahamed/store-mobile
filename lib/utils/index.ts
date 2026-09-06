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

export const FREE_SHIPPING_THRESHOLD = 15000;
export const TAX_RATE = 0.08;
export const DEFAULT_SHIPPING_FEE = 350;

export const SHIPPING_OPTIONS = [
  { key: "standard" as const, label: "Standard", desc: "5–7 business days", fee: 0, minDays: 5, maxDays: 7 },
  { key: "express" as const, label: "Express", desc: "1–2 business days", fee: 1500, minDays: 1, maxDays: 2 },
  { key: "overnight" as const, label: "Overnight", desc: "Next business day", fee: 3500, minDays: 1, maxDays: 1 },
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
