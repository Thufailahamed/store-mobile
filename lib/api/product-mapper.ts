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
