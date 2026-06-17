import { getVariantAvailableStock } from "@/lib/inventory";
import type { ProductVariant } from "@/lib/types";

/** Sellable units (quantity − reserved). */
export function getVariantStock(
  variant: ProductVariant | null | undefined,
  fallback = 0
): number {
  return getVariantAvailableStock(variant, fallback);
}

export type AvailableSizeOption = {
  size: string;
  variantId: string;
  stock: number;
  price: number;
  mrp?: number;
  variantLabel: string;
};

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "FREE", "ONE SIZE"];

export function sortSizes(a: string, b: string): number {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;

  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

export function buildAvailableSizeOptions(
  variants: ProductVariant[] | undefined,
  currentVariantId: string | null
): AvailableSizeOption[] {
  if (!variants?.length) return [];

  const currentVariant = currentVariantId
    ? variants.find((v) => v.id === currentVariantId)
    : null;
  const currentColor = currentVariant?.color;

  const bySize = new Map<string, ProductVariant>();

  for (const variant of variants) {
    const size = variant.size?.trim();
    if (!size) continue;

    const stock = getVariantStock(variant, 0);
    if (stock <= 0) continue;

    const existing = bySize.get(size);
    if (!existing) {
      bySize.set(size, variant);
      continue;
    }

    if (currentColor && variant.color === currentColor) {
      bySize.set(size, variant);
      continue;
    }

    if (variant.id === currentVariantId) {
      bySize.set(size, variant);
    }
  }

  return Array.from(bySize.entries())
    .map(([size, variant]) => ({
      size,
      variantId: variant.id,
      stock: getVariantStock(variant, 0),
      price: variant.price ?? 0,
      mrp: variant.mrp,
      variantLabel: `${variant.color ?? ""} ${size}`.trim(),
    }))
    .sort((a, b) => sortSizes(a.size, b.size));
}
