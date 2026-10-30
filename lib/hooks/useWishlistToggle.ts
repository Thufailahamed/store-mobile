import { useCallback } from "react";
import { useWishlist } from "@/lib/stores";
import { useToast } from "@/components/ui";

type WishlistProduct = {
  id: string;
  name?: string | null;
  images?: { url: string; is_primary?: boolean | null }[] | null;
};

/**
 * Toggle a product in the wishlist and announce it with the island
 * notification ("Saved to wishlist" / "Removed from wishlist" + thumbnail).
 */
export function useWishlistToggle() {
  const toggle = useWishlist((s) => s.toggle);
  const { toast } = useToast();

  return useCallback(
    (product: WishlistProduct, image?: string | null) => {
      const wasSaved = !!useWishlist.getState().items[product.id];
      toggle(product.id);
      const img =
        image || product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url || undefined;
      toast(wasSaved ? "Removed from wishlist" : "Saved to wishlist", wasSaved ? "info" : "success", {
        image: img,
        subtitle: product.name ?? undefined,
      });
    },
    [toggle, toast],
  );
}
