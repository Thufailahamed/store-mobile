import { PRICE_BOUNDS, type ProductFilters } from "@/lib/api/facets";
import { discountPct } from "@/lib/utils";
import type { Product } from "@/lib/types";

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
    const wanted = filters.colors.map((c) => c.toLowerCase());
    list = list.filter((p) => {
      const pColors = (p.variants ?? []).map((v) => (v.color ?? "").toLowerCase()).filter(Boolean);
      return wanted.some((cl) => pColors.some((pc) => pc.includes(cl) || cl.includes(pc)));
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
    // Unisex pieces satisfy a men/women filter too.
    list = list.filter(
      (p) => p.gender === filters.gender || (p.gender === "unisex" && filters.gender !== "kids"),
    );
  }

  if (filters.occasion) {
    const want = filters.occasion.toLowerCase();
    list = list.filter((p) => (p as { ai_attrs?: { occasion?: string | null } }).ai_attrs?.occasion?.toLowerCase() === want);
  }

  if (filters.material) {
    const want = filters.material.toLowerCase();
    list = list.filter((p) => (p as { ai_attrs?: { material?: string | null } }).ai_attrs?.material?.toLowerCase() === want);
  }

  if (filters.minRating && filters.minRating > 0) {
    list = list.filter((p) => p.rating >= filters.minRating!);
  }

  if (filters.minDiscount && filters.minDiscount > 0) {
    list = list.filter((p) => discountPct(p.mrp, p.price) >= filters.minDiscount!);
  }

  return list;
}
