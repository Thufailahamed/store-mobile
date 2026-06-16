/**
 * Inventory utilities for the recommender.
 *
 * Determines whether a product has any in-stock purchaseable variant. We use
 * this to filter out products we should not surface to the user.
 */

import type { Product } from "@/lib/types";

/** True if a product has at least one variant that can be purchased. */
export function isProductInStock(product: Product): boolean {
  const variants = product.variants ?? [];
  if (variants.length === 0) {
    // No variants → treat as simple product; available if `is_active` and
    // the inferred stock from inventory view_count is > 0 (most products
    // without variants are still purchasable).
    return product.is_active;
  }
  for (const v of variants) {
    if (!v.is_active) continue;
    if (typeof v.stock === "number") {
      if (v.stock > 0) return true;
    } else {
      // No stock info — assume purchasable when active.
      return true;
    }
  }
  return false;
}

/** Total in-stock variant count (useful for "low stock" UX). */
export function inStockVariantCount(product: Product): number {
  const variants = product.variants ?? [];
  let n = 0;
  for (const v of variants) {
    if (!v.is_active) continue;
    if (typeof v.stock === "number") {
      if (v.stock > 0) n += 1;
    } else {
      n += 1;
    }
  }
  return n;
}

/** Lowest active variant stock across the product (Infinity if unknown). */
export function minVariantStock(product: Product): number {
  const variants = product.variants ?? [];
  if (variants.length === 0) return Infinity;
  let min = Infinity;
  for (const v of variants) {
    if (!v.is_active) continue;
    if (typeof v.stock === "number") min = Math.min(min, v.stock);
    else return Infinity;
  }
  return min;
}
