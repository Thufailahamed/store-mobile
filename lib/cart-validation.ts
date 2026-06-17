import { supabase } from "@/lib/supabase/client";
import { mapProducts } from "@/lib/api/product-mapper";
import { getCatalogVisibleStoreIds, isPublicCatalogProduct } from "@/lib/catalog-visibility";
import { getVariantStock } from "@/components/cart/variant-utils";
import type { CartItem } from "@/lib/stores/cart-store";
import { useCart } from "@/lib/stores/cart-store";
import type { Product, ProductVariant } from "@/lib/types";

export type CartInvalidReason =
  | "product_removed"
  | "product_unavailable"
  | "store_unavailable"
  | "variant_removed"
  | "variant_unavailable"
  | "out_of_stock";

export interface CartItemIssue {
  key: string;
  reason: CartInvalidReason;
  message: string;
}

export interface CartItemPatch {
  key: string;
  price?: number;
  stock?: number;
  quantity?: number;
  name?: string;
  variantLabel?: string;
}

export interface CartReconciliation {
  remove: CartItemIssue[];
  update: CartItemPatch[];
}

const PRODUCT_SNAPSHOT_SELECT =
  "*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)";

/** Fetch current product rows for cart validation (includes inactive/deleted gaps). */
export async function fetchCartProductSnapshots(
  productIds: string[],
): Promise<Record<string, Product>> {
  if (productIds.length === 0) return {};

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SNAPSHOT_SELECT)
    .in("id", productIds);

  if (error || !data) return {};

  const byId: Record<string, Product> = {};
  mapProducts(data as Product[]).forEach((product) => {
    byId[product.id] = product;
  });
  return byId;
}

function variantLabel(variant: ProductVariant): string | undefined {
  const label = `${variant.color ?? ""} ${variant.size ?? ""}`.trim();
  return label || undefined;
}

/**
 * Pure assessment of cart rows against live catalog data.
 * Does not mutate the cart — callers apply via applyCartReconciliation.
 */
export function buildCartReconciliation(
  items: Record<string, CartItem>,
  productsById: Record<string, Product>,
  catalogVisibleStoreIds: Set<string>,
): CartReconciliation {
  const remove: CartItemIssue[] = [];
  const update: CartItemPatch[] = [];

  for (const [key, item] of Object.entries(items)) {
    const product = productsById[item.productId];

    if (!product) {
      remove.push({
        key,
        reason: "product_removed",
        message: `${item.name} is no longer available and was removed from your bag.`,
      });
      continue;
    }

    if (!isPublicCatalogProduct(product, catalogVisibleStoreIds)) {
      const reason: CartInvalidReason =
        product.status !== "active" || product.is_active === false
          ? "product_unavailable"
          : "store_unavailable";
      remove.push({
        key,
        reason,
        message: `${item.name} is no longer available and was removed from your bag.`,
      });
      continue;
    }

    const variants = product.variants ?? [];
    const variant = item.variantId
      ? variants.find((v) => v.id === item.variantId)
      : null;

    if (item.variantId && !variant) {
      remove.push({
        key,
        reason: "variant_removed",
        message: `${item.name} (${item.variantLabel ?? "selected option"}) is no longer available.`,
      });
      continue;
    }

    if (variant?.is_active === false) {
      remove.push({
        key,
        reason: "variant_unavailable",
        message: `${item.name} (${item.variantLabel ?? "selected option"}) is no longer available.`,
      });
      continue;
    }

    const stock = variant
      ? getVariantStock(variant, 0)
      : variants.length > 0
        ? 0
        : 99;

    if (variants.length > 0 && !variant) {
      remove.push({
        key,
        reason: "variant_removed",
        message: `${item.name} requires a variant selection and was removed.`,
      });
      continue;
    }

    if (stock <= 0) {
      remove.push({
        key,
        reason: "out_of_stock",
        message: `${item.name} is out of stock and was removed from your bag.`,
      });
      continue;
    }

    const currentPrice = variant?.price ?? product.price;
    const patch: CartItemPatch = { key };
    let hasPatch = false;

    if (currentPrice !== item.price) {
      patch.price = currentPrice;
      hasPatch = true;
    }
    if (stock !== item.stock) {
      patch.stock = stock;
      hasPatch = true;
    }
    if (item.quantity > stock) {
      patch.quantity = stock;
      hasPatch = true;
    }
    if (product.name !== item.name) {
      patch.name = product.name;
      hasPatch = true;
    }
    if (variant) {
      const nextLabel = variantLabel(variant);
      if (nextLabel && nextLabel !== item.variantLabel) {
        patch.variantLabel = nextLabel;
        hasPatch = true;
      }
    }

    if (hasPatch) update.push(patch);
  }

  return { remove, update };
}

export function applyCartReconciliation(reconciliation: CartReconciliation): void {
  useCart.getState().applyReconciliation(reconciliation);
}

/** Load catalog data, reconcile the cart, and return what changed. */
export async function refreshCartFromCatalog(): Promise<CartReconciliation> {
  const items = useCart.getState().items;
  const productIds = [...new Set(Object.values(items).map((item) => item.productId))];

  if (productIds.length === 0) {
    return { remove: [], update: [] };
  }

  const [productsById, catalogVisibleStoreIds] = await Promise.all([
    fetchCartProductSnapshots(productIds),
    getCatalogVisibleStoreIds(),
  ]);

  const reconciliation = buildCartReconciliation(
    items,
    productsById,
    catalogVisibleStoreIds,
  );

  if (reconciliation.remove.length > 0 || reconciliation.update.length > 0) {
    applyCartReconciliation(reconciliation);
  }

  return reconciliation;
}

export type CartCheckoutValidation =
  | { ok: true }
  | { ok: false; error: string; reconciliation: CartReconciliation };

/**
 * Validate cart immediately before checkout. Reconciles stale rows and blocks
 * checkout when items were removed or the bag is empty.
 */
export async function validateCartForCheckout(): Promise<CartCheckoutValidation> {
  const reconciliation = await refreshCartFromCatalog();
  const remaining = Object.keys(useCart.getState().items).length;

  if (reconciliation.remove.length > 0) {
    const names = reconciliation.remove.map((issue) => issue.message).slice(0, 2);
    const suffix =
      reconciliation.remove.length > 2
        ? ` (+${reconciliation.remove.length - 2} more)`
        : "";
    return {
      ok: false,
      error: `${names.join(" ")}${suffix}`,
      reconciliation,
    };
  }

  if (remaining === 0) {
    return {
      ok: false,
      error: "Your bag is empty. Unavailable items were removed.",
      reconciliation,
    };
  }

  return { ok: true };
}

/** Assess a single cart row for UI warnings (does not mutate cart). */
export function assessCartItemIssue(
  item: CartItem,
  product: Product | undefined,
  catalogVisibleStoreIds: Set<string>,
): CartItemIssue | null {
  const reconciliation = buildCartReconciliation(
    { [`${item.productId}-${item.variantId ?? "default"}`]: item },
    product ? { [product.id]: product } : {},
    catalogVisibleStoreIds,
  );
  return reconciliation.remove[0] ?? null;
}
