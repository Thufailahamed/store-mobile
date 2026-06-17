import { supabase } from "@/lib/supabase/client";

export type SkuValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export type SkuDraftVariant = {
  id?: string;
  sku?: string;
};

/** Normalize SKU for comparison (trim + uppercase). */
export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

/** True when SKU is non-empty after normalization. */
export function isValidSku(sku: string): boolean {
  const normalized = normalizeSku(sku);
  return normalized.length > 0 && normalized.length <= 64;
}

/**
 * Detect duplicate SKUs within a single product draft (product-level + variants).
 * Returns the conflicting normalized SKU, or null when clear.
 */
export function findLocalSkuDuplicate(
  productSku: string | undefined,
  variants: SkuDraftVariant[],
): string | null {
  const seen = new Set<string>();

  const productNorm = productSku?.trim() ? normalizeSku(productSku) : null;
  if (productNorm) seen.add(productNorm);

  for (const variant of variants) {
    const norm = variant.sku?.trim() ? normalizeSku(variant.sku) : null;
    if (!norm) continue;
    if (seen.has(norm)) return norm;
    seen.add(norm);
  }

  return null;
}

async function findStoreSkuConflict(
  storeId: string,
  sku: string,
  excludeProductId?: string,
  excludeVariantId?: string,
): Promise<string | null> {
  let productQuery = supabase
    .from("products")
    .select("id, name")
    .eq("store_id", storeId)
    .ilike("sku", sku);
  if (excludeProductId) productQuery = productQuery.neq("id", excludeProductId);

  const { data: productConflict, error: productError } = await productQuery.maybeSingle();
  if (productError) throw new Error(productError.message);
  if (productConflict) {
    return `SKU "${sku}" is already used by product "${productConflict.name}"`;
  }

  let variantQuery = supabase
    .from("product_variants")
    .select("id, sku, product:products!inner(id, name, store_id)")
    .eq("product.store_id", storeId)
    .ilike("sku", sku);
  if (excludeVariantId) variantQuery = variantQuery.neq("id", excludeVariantId);

  const { data: variantRows, error: variantError } = await variantQuery;
  if (variantError) throw new Error(variantError.message);

  for (const row of variantRows ?? []) {
    const product = (row as { product?: { id?: string; name?: string } }).product;
    if (excludeProductId && product?.id === excludeProductId) continue;
    return `SKU "${sku}" is already used by a variant in "${product?.name ?? "another product"}"`;
  }

  return null;
}

/**
 * Ensure SKUs are unique within the product draft and across the seller's store.
 * Scoped per store — two different stores may reuse the same SKU.
 */
export async function validateStoreSkus(opts: {
  storeId: string;
  productId?: string;
  productSku?: string;
  variants?: SkuDraftVariant[];
}): Promise<SkuValidationResult> {
  const variants = opts.variants ?? [];

  const localDuplicate = findLocalSkuDuplicate(opts.productSku, variants);
  if (localDuplicate) {
    return {
      ok: false,
      error: `Duplicate SKU "${localDuplicate}" within this product. Each SKU must be unique.`,
    };
  }

  const skusToCheck: Array<{ sku: string; excludeVariantId?: string }> = [];

  if (opts.productSku?.trim()) {
    skusToCheck.push({ sku: normalizeSku(opts.productSku) });
  }

  for (const variant of variants) {
    if (!variant.sku?.trim()) continue;
    skusToCheck.push({
      sku: normalizeSku(variant.sku),
      excludeVariantId: variant.id,
    });
  }

  for (const entry of skusToCheck) {
    const conflict = await findStoreSkuConflict(
      opts.storeId,
      entry.sku,
      opts.productId,
      entry.excludeVariantId,
    );
    if (conflict) return { ok: false, error: conflict };
  }

  return { ok: true };
}

/** Map Postgres unique-constraint errors to a friendly SKU message. */
export function formatSkuPersistenceError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "That SKU is already in use. Choose a different SKU.";
  }
  return message;
}
