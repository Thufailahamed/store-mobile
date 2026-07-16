import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useWishlist } from "@/lib/stores";
import { useTrackEvent } from "@/lib/recommender";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

export const HOME_PRODUCT_CARD_WIDTH = 148;

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
}

function HomeProductCardInner({ product, showSaleBadge = true, index = 99, badgeLabel }: HomeProductCardProps) {
  const router = useRouter();
  const isWishlisted = useWishlist((s) => !!s.items[product.id]);
  const toggle = useWishlist((s) => s.toggle);
  const tracker = useTrackEvent();
  const primaryImage = product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const onSale = product.mrp > product.price;
  const storeOrBrandName = product.store?.name || product.brand?.name;
  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(main)/products/${product.slug}`)}
    >
      <View style={styles.imageWrap}>
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
            toggle(product.id);
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
            <Text style={styles.saleText}>Sale</Text>
          </View>
        ) : null}
        {badgeLabel ? (
          <View style={styles.disclosureBadge}>
            <Text style={styles.disclosureText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.productName} numberOfLines={1}>
        {product.name || "Untitled Piece"}
      </Text>

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

      <View style={styles.priceRow}>
        {discount > 0 ? (
          <>
            <Text style={styles.originalPrice}>
              {formatPrice(product.mrp)}
            </Text>
            <Text style={styles.sellingPrice}>
              {product.price ? formatPrice(product.price) : "Price on request"}
            </Text>
            <Text style={styles.discountPct}>
              {discount}% OFF
            </Text>
          </>
        ) : (
          <Text style={styles.sellingPrice}>
            {product.price ? formatPrice(product.price) : "Price on request"}
          </Text>
        )}
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
    prev.badgeLabel === next.badgeLabel,
);

const styles = StyleSheet.create({
  card: {
    width: HOME_PRODUCT_CARD_WIDTH,
  },
  imageWrap: {
    width: HOME_PRODUCT_CARD_WIDTH,
    height: HOME_PRODUCT_CARD_WIDTH,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[50],
    marginBottom: spacing[2],
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
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  saleBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saleText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.light.destructive,
  },
  disclosureBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
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
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  storeInitial: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8,
    color: colors.light.primary,
  },
  storeName: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  productName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
    marginBottom: 2,
    lineHeight: 17,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  sellingPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  originalPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    textDecorationLine: "line-through",
    color: colors.light.mutedForeground,
  },
  discountPct: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: colors.accent2.rust,
  },
});
