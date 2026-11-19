import { formatPrice } from "@/lib/utils";
import type { Product, ProductVariant } from "@/lib/types";

/**
 * Pure wholesale helpers. Kept separate from `whatsapp-order.ts` so they can
 * be unit-tested without pulling in Expo's Linking module.
 */
export function isWholesaleProduct(
  product: Pick<Product, "catalog_channel"> | null | undefined,
): boolean {
  return product?.catalog_channel === "wholesale";
}

/** MOQ + pack-size maths shared by the quantity stepper and WhatsApp order. */
export function wholesaleQtyBounds(
  product: Pick<Product, "wholesale_moq" | "wholesale_pack_size"> | null | undefined,
): { moq: number; pack: number } {
  const moq = Math.max(1, Math.floor(Number(product?.wholesale_moq ?? 1) || 1));
  const pack = Math.max(1, Math.floor(Number(product?.wholesale_pack_size ?? 1) || 1));
  return { moq, pack };
}

/** Clamp a quantity to the nearest valid MOQ/pack multiple (never below MOQ). */
export function wholesaleQty(
  qty: number,
  product: Pick<Product, "wholesale_moq" | "wholesale_pack_size"> | null | undefined,
): number {
  const { moq, pack } = wholesaleQtyBounds(product);
  const raw = Math.max(moq, Math.floor(Number(qty) || moq));
  const steps = Math.max(0, Math.ceil((raw - moq) / pack));
  return moq + steps * pack;
}

/** Wholesale enquiry link — includes MOQ, pack size, lead time and unit price. */
export function buildWholesaleWhatsappUrl(
  number: string,
  product: Pick<
    Product,
    | "name"
    | "price"
    | "currency"
    | "sku"
    | "slug"
    | "wholesale_moq"
    | "wholesale_pack_size"
    | "wholesale_lead_time"
  >,
  opts: {
    variant?: Pick<ProductVariant, "size" | "color" | "price" | "sku"> | null;
    qty?: number;
  } = {},
): string {
  const web = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? "").replace(/\/$/, "") || "https://vestara.lk";
  const { variant, qty } = opts;
  const { moq, pack } = wholesaleQtyBounds(product);
  const quantity = wholesaleQty(qty ?? moq, product);
  const price = variant?.price ?? product.price;
  const style = [variant?.color, variant?.size].filter(Boolean).join(" / ");
  const lines = [
    "Hi VESTARA Wholesale, I'd like to place a wholesale order:",
    `• ${product.name}`,
    style ? `• Style: ${style}` : null,
    `• Qty: ${quantity} pcs (MOQ ${moq}${pack > 1 ? `, pack of ${pack}` : ""})`,
    `• Unit price: ${formatPrice(price, product.currency)}`,
    variant?.sku || product.sku ? `• Ref: ${variant?.sku || product.sku}` : null,
    product.wholesale_lead_time ? `• Lead time: ${product.wholesale_lead_time}` : null,
    `${web}/wholesale/${encodeURIComponent(product.slug)}`,
  ].filter(Boolean);
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(lines.join("\n"))}`;
}
