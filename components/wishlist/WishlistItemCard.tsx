import React, { useState } from "react";
import { View, Pressable, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { useCart, useWishlist } from "@/lib/stores";
import { useToast } from "@/components/ui/Toast";
import type { Product } from "@/lib/types";
import { WISHLIST_CARD_WIDTH, WISHLIST_IMAGE_HEIGHT } from "@/components/wishlist/layout";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "#e5e5e5";

interface WishlistItemCardProps {
  product: Product;
}

function getStock(product: Product) {
  return product.variants?.[0]?.stock ?? 0;
}

export function WishlistItemCard({ product }: WishlistItemCardProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { toggle } = useWishlist();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const primary =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const variant = product.variants?.[0];
  const stock = getStock(product);
  const isOutOfStock = stock <= 0;
  const brandLabel = (product.store?.name || product.brand?.name || "LUXE").toUpperCase();

  const open = () =>
    router.push({
      pathname: "/(main)/products/[slug]",
      params: { slug: product.slug || product.id },
    });

  const moveToBag = async () => {
    if (adding || isOutOfStock) return;
    setAdding(true);
    try {
      addItem({
        productId: product.id,
        variantId: variant?.id ?? null,
        storeId: product.store_id,
        name: product.name,
        variantLabel: variant
          ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim()
          : undefined,
        price: product.price,
        image: primary,
        stock: stock || 99,
        quantity: 1,
      });
      toggle(product.id);
      toast(`Moved ${product.name} to bag`, "success");
    } finally {
      setAdding(false);
    }
  };

  const notifyMe = () => {
    toast("We'll notify you when this piece is back", "success");
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.98 }]}
    >
      <View style={styles.imageWrap}>
        {primary ? (
          <Image source={{ uri: primary }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={24} color={MUTED} />
          </View>
        )}

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggle(product.id);
          }}
          hitSlop={8}
          accessibilityLabel="Remove from wishlist"
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="trash-outline" size={15} color={INK} />
        </Pressable>

        {isOutOfStock ? (
          <View style={styles.oosBanner}>
            <Text style={styles.oosBannerText}>OUT OF STOCK</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.brandName} numberOfLines={1}>
          {brandLabel}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>{formatPrice(product.price, product.currency)}</Text>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={isOutOfStock ? notifyMe : moveToBag}
        disabled={adding}
        activeOpacity={0.8}
      >
        <Text style={[styles.actionText, isOutOfStock && styles.actionTextMuted]}>
          {isOutOfStock ? "NOTIFY ME" : adding ? "ADDING…" : "MOVE TO BAG"}
        </Text>
      </TouchableOpacity>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: WISHLIST_CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: spacing[4],
  },
  imageWrap: {
    width: "100%",
    height: WISHLIST_IMAGE_HEIGHT,
    position: "relative",
    backgroundColor: "#f5f5f5",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  oosBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#c0392b",
    paddingVertical: 6,
    alignItems: "center",
  },
  oosBannerText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
  info: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
  },
  brandName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    color: MUTED,
    letterSpacing: 0.8,
  },
  productName: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 13,
    color: INK,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  price: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: INK,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
  },
  actionBtn: {
    width: "100%",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  actionText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    color: INK,
    letterSpacing: 1,
  },
  actionTextMuted: {
    color: MUTED,
  },
});
