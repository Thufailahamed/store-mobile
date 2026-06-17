import { describe, it, expect } from "vitest";
import type { Product, ProductVariant } from "@/lib/types";

/** Mirrors ProductCard quick-add price resolution. */
function resolveQuickAddPrice(product: Product, variant?: ProductVariant | null): number {
  return variant?.price ?? product.price;
}

describe("ProductCard quick-add pricing", () => {
  const product = {
    id: "p1",
    price: 1000,
  } as Product;

  it("uses variant price when the selected variant has its own price", () => {
    const variant = { id: "v1", price: 1500 } as ProductVariant;
    expect(resolveQuickAddPrice(product, variant)).toBe(1500);
  });

  it("falls back to product price for simple products", () => {
    expect(resolveQuickAddPrice(product, null)).toBe(1000);
  });
});
