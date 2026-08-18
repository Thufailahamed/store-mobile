import { useQuery } from "@tanstack/react-query";
import { getStoreBySlug, getStoreProducts } from "@/lib/api/stores";
import type { Product, Store } from "@/lib/types";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

interface StorefrontContext {
  store: Store | null;
  products: Product[];
  productsTotal: number;
}

/**
 * Lightweight products + store context for the storefront renderer.
 *
 * Fetches the first 30 products so renderer sections (hero/featured/product
 * grid) can render real data. The full product list (sortable, paginated)
 * is still owned by the route-level tab section below the renderer.
 */
export function useStorefrontContext(slug: string) {
  const storeQ = useQuery({
    queryKey: ["store-by-slug", slug],
    queryFn: async () => {
      const r = await getStoreBySlug(slug);
      return r.ok ? r.data : null;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  const productsQ = useQuery({
    queryKey: ["store-products", slug, "newest", 30],
    queryFn: async () => {
      const r = await getStoreProducts(slug, { sort: "newest", limit: 30, offset: 0 });
      return r.ok ? r.data : { products: [], total: 0 };
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  return {
    store: (storeQ.data as Store | null) ?? null,
    products: productsQ.data?.products ?? [],
    productsTotal: productsQ.data?.total ?? 0,
    isLoading: storeQ.isLoading || productsQ.isLoading,
    error: storeQ.error ?? productsQ.error,
    refetch: () => {
      void storeQ.refetch();
      void productsQ.refetch();
    },
  };
}