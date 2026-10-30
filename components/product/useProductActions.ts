import { useState } from "react";
import { useCart, useWishlist } from "@/lib/stores";
import { useTrackEvent } from "@/lib/recommender";
import { getVariantAvailableStock } from "@/lib/inventory";
import { useToast } from "@/components/ui";
import type { Product, ProductVariant } from "@/lib/types";

/**
 * Shared card behaviour: derived display data (primary image, discount,
 * swatches, stock) plus quick-add-to-basket and wishlist toggling.
 * Render `<QuickSizeModal {...quickSize} product={product} />` alongside
 * the card so multi-size products can pick a size.
 */
export function useProductActions(product: Product) {
  const { toast } = useToast();
  const addItem = useCart((s) => s.addItem);
  const isWishlisted = useWishlist((s) => !!s.items[product.id]);
  const toggle = useWishlist((s) => s.toggle);
  const tracker = useTrackEvent();
  const [showQuickSize, setShowQuickSize] = useState(false);

  const primaryImage = product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  const colorSwatches = Array.from(
    new Map(
      (product.variants ?? [])
        .filter((v) => v.color_hex)
        .map((v) => [v.color_hex as string, v.color as string])
    ).keys()
  ).slice(0, 4);

  /** Aggregate stock across every variant. If no variants exist we assume the
   *  product is always available (matches web WishlistPage.totalStock). */
  const aggregateStock = (product.variants ?? []).reduce(
    (sum, v) => sum + getVariantAvailableStock(v, v.stock ?? 0),
    0,
  );
  const isSoldOut = (product.variants?.length ?? 0) > 0 && aggregateStock <= 0;
  const sizeVariants = (product.variants ?? []).filter((v) => v.is_active && v.size);

  const addVariantToCart = (variant: ProductVariant) => {
    const stock = getVariantAvailableStock(variant, variant.stock ?? 0);
    if (stock <= 0) {
      toast("Out of stock", "error");
      return;
    }
    addItem({
      productId: product.id,
      variantId: variant.id,
      storeId: product.store_id,
      name: product.name,
      variantLabel: `${variant.color ?? ""} ${variant.size ?? ""}`.trim() || undefined,
      price: variant.price ?? product.price,
      image: primaryImage,
      stock,
      quantity: 1,
    });
    tracker.cartAdd(product);
    toast(`Added size ${variant.size} to basket`, "success");
  };

  const handleAdd = () => {
    if (isSoldOut) {
      toast("Out of stock", "error");
      return;
    }
    if (sizeVariants.length > 1) {
      setShowQuickSize(true);
      return;
    }
    const variants = product.variants ?? [];
    const variant =
      variants.find((v) => getVariantAvailableStock(v, v.stock ?? 0) > 0) ?? variants[0];
    const stock = variant ? getVariantAvailableStock(variant, variant.stock ?? 0) : 0;
    if (stock <= 0) {
      toast("Out of stock", "error");
      return;
    }
    addItem({
      productId: product.id,
      variantId: variant?.id ?? null,
      storeId: product.store_id,
      name: product.name,
      variantLabel: variant ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim() : undefined,
      price: variant?.price ?? product.price,
      image: primaryImage,
      stock,
      quantity: 1,
    });
    tracker.cartAdd(product);
    toast("Added to basket", "success");
  };

  const handleWishlist = () => {
    tracker.wishlist(product, isWishlisted ? "remove" : "add");
    toggle(product.id);
  };

  return {
    primaryImage,
    discount,
    colorSwatches,
    isSoldOut,
    isWishlisted,
    handleAdd,
    handleWishlist,
    quickSize: {
      visible: showQuickSize,
      onClose: () => setShowQuickSize(false),
      onSelectVariant: addVariantToCart,
    },
  };
}
