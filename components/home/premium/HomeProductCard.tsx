import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useWishlist } from "@/lib/stores";
import { useTrackEvent } from "@/lib/recommender";
import { colors, radii } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { useWishlistToggle } from "@/lib/hooks/useWishlistToggle";

export const HOME_PRODUCT_CARD_WIDTH = 148;
export const HOME_PRODUCT_CARD_WIDTH_LARGE = 178;
/** Inner padding of the white card frame around the image. */
const CARD_PAD = 7;

interface HomeProductCardProps {
  product: Product;
  showSaleBadge?: boolean;
  /**
   * Index in the rail. Card 0..2 are above the fold; expo-image uses
   * `priority` on those so the OS image cache fills before paint.
   */
  index?: number;
  /** Small disclosure pill (e.g. "Sponsored") shown opposite the sale badge. */
  badgeLabel?: string;
  /** "large" is used by feature/spotlight rails so their cards read as a step up from plain listing rails. */
  size?: "default" | "large";
}

function HomeProductCardInner({
  product,
  showSaleBadge = true,
  index = 99,
  badgeLabel,
  size = "default",
}: HomeProductCardProps) {
  const router = useRouter();
  const isWishlisted = useWishlist((s) => !!s.items[product.id]);
  const toggleWishlist = useWishlistToggle();
  const tracker = useTrackEvent();
  const primaryImage = product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const onSale = product.mrp > product.price;
  const storeOrBrandName = product.store?.name || product.brand?.name;
  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const isLarge = size === "large";
  const cardWidth = isLarge ? HOME_PRODUCT_CARD_WIDTH_LARGE : HOME_PRODUCT_CARD_WIDTH;
  const imageWidth = cardWidth - CARD_PAD * 2;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      activeOpacity={0.85}
      onPress={() => router.push(`/(main)/products/${product.slug}`)}
    >
      <View style={[styles.imageWrap, { width: imageWidth, height: Math.round(imageWidth * 1.12) }]}>
        {primaryImage ? (
          <Image
            source={{ uri: primaryImage }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            // Above-the-fold cards skip the fade so the first frame
            // already shows the product. expo-image prefetches when
            // priority is set.
            priority={index < 3 ? "high" : "normal"}
            cachePolicy="memory-disk"
            recyclingKey={product.id}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
          </View>
        )}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => {
            tracker.wishlist(product, isWishlisted ? "remove" : "add");
            toggleWishlist(product);
          }}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={16}
            color={isWishlisted ? colors.light.destructive : colors.light.foreground}
          />
        </TouchableOpacity>
        {showSaleBadge && onSale ? (
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>
              {discount > 0 ? `-${discount}%` : "SALE"}
            </Text>
          </View>
        ) : null}
        {badgeLabel ? (
          <View style={styles.disclosureBadge}>
            <Text style={styles.disclosureText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>

      {storeOrBrandName ? (
        <View style={styles.storeRow}>
          {product.store?.logo_url || product.brand?.logo_url ? (
            <Image
              source={{ uri: product.store?.logo_url || product.brand?.logo_url }}
              style={styles.storeLogo}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={`logo-${product.id}`}
            />
          ) : (
            <View style={styles.storeLogoFallback}>
              <Text style={styles.storeInitial}>{storeOrBrandName.charAt(0)}</Text>
            </View>
          )}
          {product.brand?.slug ? (
            <Link href={`/(main)/brands/${product.brand.slug}` as never} asChild>
              <TouchableOpacity onPress={(e) => e.stopPropagation()} hitSlop={4} style={{ flex: 1 }}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {storeOrBrandName}
                </Text>
              </TouchableOpacity>
            </Link>
          ) : (
            <Text style={styles.storeName} numberOfLines={1}>
              {storeOrBrandName}
            </Text>
          )}
        </View>
      ) : null}

      <Text style={[styles.productName, isLarge && styles.productNameLarge]} numberOfLines={1}>
        {product.name || "Untitled Piece"}
      </Text>

      <View style={styles.priceRow}>
        {/* Discount is shown once — as the badge on the image — so the
            price row is just selling price + struck-through MRP. */}
        <Text style={[styles.sellingPrice, isLarge && styles.sellingPriceLarge]}>
          {product.price ? formatPrice(product.price) : "Price on request"}
        </Text>
        {discount > 0 ? <Text style={styles.originalPrice}>{formatPrice(product.mrp)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Memoised card. The only props that change across the same `product.id`
 * are `isWishlisted` (subscribed inside the card) and `index`. A custom
 * comparator skips re-render when the product reference is stable and
 * index is unchanged — the common case during scroll.
 */
export const HomeProductCard = React.memo(
  HomeProductCardInner,
  (prev, next) =>
    prev.product === next.product &&
    prev.showSaleBadge === next.showSaleBadge &&
    prev.index === next.index &&
    prev.badgeLabel === next.badgeLabel &&
    prev.size === next.size,
);

const styles = StyleSheet.create({
  card: {
    width: HOME_PRODUCT_CARD_WIDTH,
    padding: CARD_PAD,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  imageWrap: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0ede2",
    marginBottom: 9,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heartBtn: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  saleBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  saleBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10.5,
    color: C.lime,
  },
  disclosureBadge: {
    position: "absolute",
    right: 7,
    bottom: 7,
    backgroundColor: "rgba(22,23,15,0.6)",
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  disclosureText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 9,
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
    paddingHorizontal: 3,
  },
  storeLogo: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  storeLogoFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  storeInitial: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8,
    color: C.accent,
  },
  storeName: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: C.accent,
  },
  productName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: C.text,
    marginBottom: 3,
    lineHeight: 18,
    paddingHorizontal: 3,
  },
  productNameLarge: {
    fontSize: 14.5,
    lineHeight: 19,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
    paddingHorizontal: 3,
  },
  sellingPrice: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: C.text,
  },
  sellingPriceLarge: {
    fontSize: 14,
  },
  originalPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    textDecorationLine: "line-through",
    color: C.muted,
  },
});
