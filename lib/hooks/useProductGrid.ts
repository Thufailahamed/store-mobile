import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import type { Product } from "@/lib/types";
import { getPersonalizedSearch } from "@/lib/recommender";
import { useAuth } from "@/lib/supabase/auth";
import { EMPTY_FILTERS, type ProductFilters, type SortOption, type ViewMode } from "@/lib/api/facets";

const LIMIT = 20;

export interface ProductGridScope {
  category?: string;
  brand?: string;
  search?: string;
  initialSort?: SortOption["value"] | string;
}

/**
 * Fetch/pagination/filter/sort mechanics shared by any screen that renders a
 * paginated, refinable product grid (Shop's own page, and Home's appended
 * "browse everything" section). Scope params (category/brand/search) drive
 * the server-side query; `filters` drives client-side refinement of the
 * loaded page, mirroring the split used by the Shop screen.
 */
export function useProductGrid(scope: ProductGridScope = {}) {
  const { category, brand, search, initialSort = "newest" } = scope;
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<string>(initialSort);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({ ...EMPTY_FILTERS });
  const [view, setView] = useState<ViewMode>("grid");

  // Filtered list — server applies the primary filter (category, brand,
  // gender, search, sort). Refinement facets (price/color/size/rating/
  // discount/brand-multi/category-multi) run on the loaded page so the
  // server stays simple and the response is fast.
  const refined = useMemo(() => {
    let list = products;
    if (filters.brands?.length) {
      list = list.filter((p) => p.brand_id && filters.brands!.includes(p.brand_id));
    }
    if (filters.categories?.length) {
      list = list.filter(
        (p) => p.category_id && filters.categories!.includes(p.category_id)
      );
    }
    if (filters.colors?.length) {
      list = list.filter((p) => {
        const pColors = (p.variants ?? []).map((v) => (v.color ?? "").toLowerCase());
        return filters.colors!.some((c) => {
          const cl = c.toLowerCase();
          return pColors.some((pc) => pc.includes(cl) || cl.includes(pc));
        });
      });
    }
    if (filters.sizes?.length) {
      list = list.filter((p) => {
        const pSizes = (p.variants ?? []).map((v) => (v.size ?? "").toUpperCase());
        return filters.sizes!.some((s) => pSizes.includes(s.toUpperCase()));
      });
    }
    if (filters.minRating && filters.minRating > 0) {
      list = list.filter((p) => p.rating >= filters.minRating!);
    }
    if (filters.minDiscount && filters.minDiscount > 0) {
      list = list.filter(
        (p) =>
          p.mrp > p.price &&
          Math.round(((p.mrp - p.price) / p.mrp) * 100) >= filters.minDiscount!
      );
    }
    if (filters.price && (filters.price[0] > 0 || filters.price[1] < 500000)) {
      list = list.filter(
        (p) => p.price >= filters.price![0] && p.price <= filters.price![1]
      );
    }
    return list;
  }, [products, filters]);

  const fetchProducts = useCallback(
    // `explicitOffset` lets loadMore pass the just-computed next page offset
    // directly — reading the `offset` state here instead would still see
    // the pre-update value (setOffset hasn't flushed yet in the same tick),
    // re-fetching the current page and appending duplicate products.
    async (reset = false, explicitOffset?: number) => {
      const off = reset ? 0 : explicitOffset ?? offset;
      // "for_you" is a client-side re-rank — fetch a server sort first
      // (newest gives stable, full set), then personalize the loaded page.
      const serverSort: string = sort === "for_you" ? "newest" : sort;
      const res = await api.getProducts({
        limit: LIMIT,
        offset: off,
        sort: serverSort as any,
        categorySlug: category,
        brandSlug: brand,
        gender: filters.gender,
        search: search,
      });
      if (res.ok) {
        let page = res.data.products;
        if (sort === "for_you") {
          // Re-rank the loaded page using the recommender. When no user
          // signal, the ranker still returns a popularity-sorted fallback.
          const reranked = await getPersonalizedSearch(user?.id ?? null, page);
          page = reranked.ok ? reranked.data : page;
        }
        setProducts((prev) => {
          if (reset) return page;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.filter((p) => !seen.has(p.id))];
        });
        setTotal(res.data.total);
      } else {
        if (reset) {
          setProducts([]);
          setTotal(0);
        }
      }
      setLoading(false);
      setLoadingMore(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, category, brand, search, filters.gender, offset, user?.id]
  );

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    setProducts([]);
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, category, brand, search, filters.gender]);

  const loadMore = () => {
    if (loadingMore || products.length >= total) return;
    setLoadingMore(true);
    const nextOffset = offset + LIMIT;
    setOffset(nextOffset);
    fetchProducts(false, nextOffset);
  };

  return {
    products,
    refined,
    total,
    loading,
    loadingMore,
    sort,
    setSort,
    filters,
    setFilters,
    view,
    setView,
    loadMore,
  };
}
