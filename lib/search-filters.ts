import { PRICE_BOUNDS, type ProductFilters } from "@/lib/api/facets";
import { discountPct } from "@/lib/utils";
import {
  productColorFamilies, productOccasion, productMaterial,
  resolveColorParam, resolveOccasionParam, resolveMaterialParam,
} from "@/lib/facet-vocab";
import type { Product } from "@/lib/types";

/** Unisex pieces satisfy a men/women filter too (never kids). */
export function productMatchesGender(p: Pick<Product, "gender">, gender: string): boolean {
  return p.gender === gender || (p.gender === "unisex" && gender !== "kids");
}

/**
 * Client-side facet filter for search results. Shared by the Search screen
 * (to render the grid) and SearchFilterSheet (to preview "Show N results"
 * for the draft) so the two can never disagree.
 */
export function applySearchFilters(products: Product[], filters: ProductFilters): Product[] {
  let list = products;

  const price = filters.price;
  if (price && (price[0] > PRICE_BOUNDS.min || price[1] < PRICE_BOUNDS.max)) {
    list = list.filter((p) => p.price >= price[0] && p.price <= price[1]);
  }

  if (filters.colors && filters.colors.length > 0) {
    // Family match: "blue" covers Cobalt Blue / Ice Blue; legacy "Olive" → green.
    const wanted = filters.colors.map(resolveColorParam).filter((c): c is string => !!c);
    list = list.filter((p) => {
      const have = productColorFamilies(p);
      return wanted.some((c) => have.includes(c));
    });
  }

  if (filters.sizes && filters.sizes.length > 0) {
    const wanted = filters.sizes.map((s) => s.toUpperCase());
    list = list.filter((p) => {
      const pSizes = (p.variants ?? []).map((v) => (v.size ?? "").toUpperCase());
      return wanted.some((s) => pSizes.includes(s));
    });
  }

  if (filters.brands && filters.brands.length > 0) {
    const wanted = new Set(filters.brands);
    list = list.filter((p) => {
      const id = p.brand_id ?? p.brand?.id;
      return !!id && wanted.has(id);
    });
  }

  if (filters.categories && filters.categories.length > 0) {
    const wanted = new Set(filters.categories);
    list = list.filter((p) => {
      const id = p.category_id ?? p.category?.id;
      return !!id && wanted.has(id);
    });
  }

  if (filters.gender) {
    list = list.filter((p) => productMatchesGender(p, filters.gender!));
  }

  if (filters.occasion) {
    const want = resolveOccasionParam(filters.occasion);
    list = list.filter((p) => productOccasion(p) === want);
  }

  if (filters.material) {
    const want = resolveMaterialParam(filters.material);
    list = list.filter((p) => productMaterial(p) === want);
  }

  if (filters.minRating && filters.minRating > 0) {
    list = list.filter((p) => p.rating >= filters.minRating!);
  }

  if (filters.minDiscount && filters.minDiscount > 0) {
    list = list.filter((p) => discountPct(p.mrp, p.price) >= filters.minDiscount!);
  }

  return list;
}
