import { getVariantAvailableStock } from "@/lib/inventory";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import type { Product } from "@/lib/types";

export function mapStore<
  T extends { logo_url?: string | null; banner_url?: string | null } | null | undefined,
>(store: T): T {
  if (!store) return store;
  return {
    ...store,
    logo_url: store.logo_url ? resolveImageUrl(store.logo_url) : store.logo_url,
    banner_url: store.banner_url ? resolveImageUrl(store.banner_url) : store.banner_url,
  };
}

export function mapBrand<
  T extends { logo_url?: string | null; banner_url?: string | null } | null | undefined,
>(brand: T): T {
  if (!brand) return brand;
  return {
    ...brand,
    logo_url: brand.logo_url ? resolveImageUrl(brand.logo_url) : brand.logo_url,
    banner_url: brand.banner_url ? resolveImageUrl(brand.banner_url) : brand.banner_url,
  };
}

export function mapProduct(p: any): Product {
  if (!p) return p;

  const images = p.images?.map((img: any) => ({
    ...img,
    url: resolveImageUrl(img.url),
  }));

  const variants = p.variants?.map((v: any) => {
    const stock = getVariantAvailableStock(v, v.stock ?? 0);
    return { ...v, stock };
  });

  return {
    ...p,
    images,
    variants,
    store: mapStore(p.store),
    brand: mapBrand(p.brand),
  };
}

export function mapProducts(products: any[]): Product[] {
  if (!products) return [];
  return products.map(mapProduct);
}

/**
 * Normalises a flat RPC row (`product_id` + `image_url` instead of the full
 * `id`/`images[]` product shape) into a `Product` the rail components can
 * render. Used for personalisation/trending RPCs that return a denormalised
 * row rather than the full catalog product.
 */
export function mapFlatProductRow(row: any): Product {
  const id = row.id ?? row.product_id;
  return {
    id,
    store_id: row.store_id ?? "",
    brand_id: row.brand_id ?? undefined,
    category_id: row.category_id ?? undefined,
    name: row.name,
    slug: row.slug,
    mrp: Number(row.mrp ?? row.price ?? 0),
    price: Number(row.price ?? row.mrp ?? 0),
    currency: row.currency ?? "LKR",
    discount_pct: 0,
    tax_rate: 0,
    status: "active",
    product_type: "simple",
    images: row.image_url
      ? [{ url: resolveImageUrl(row.image_url), is_primary: true, position: 0 }]
      : [],
    rating: row.rating ?? 0,
    total_sales: row.total_sales ?? 0,
    created_at: row.created_at ?? new Date().toISOString(),
    tags: [],
    is_featured: false,
    is_active: true,
    total_reviews: 0,
    view_count: 0,
    wishlist_count: 0,
  } as unknown as Product;
}

export function mapFlatProductRows(rows: any[]): Product[] {
  if (!rows) return [];
  return rows.map(mapFlatProductRow);
}

export function mapCategory<T extends { image_url?: string | null }>(category: T): T {
  return {
    ...category,
    image_url: category.image_url ? resolveImageUrl(category.image_url) : category.image_url,
  };
}

export function mapBanner<T extends { image_url?: string | null }>(banner: T): T {
  return {
    ...banner,
    image_url: banner.image_url ? resolveImageUrl(banner.image_url) : banner.image_url,
  };
}
