import React from "react";
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Text } from "react-native";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Label, Price, Body } from "@/components/ui/Typography";
import { colors, typography, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { QuickSizeModal } from "./QuickSizeModal";
import { useProductActions } from "./useProductActions";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  /** Horizontal-rail card (fixed width, scrollable). */
  horizontal?: boolean;
  /** Full-width list card (image-left, info-right). */
  listMode?: boolean;
  /** Rounded surface treatment for editorial grids such as search results. */
  surface?: boolean;
}

export function ProductCard({ product, horizontal, listMode, surface }: ProductCardProps) {
  const router = useRouter();
  // Align with products/index.tsx grid (GRID_PADDING = 16, GRID_COL_GAP = 12); reactive
  // via useWindowDimensions so it stays correct on window resize (Android split-screen, foldables).
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - 32 - 12) / 2;
  const imageHeight = cardWidth * (4 / 3);
  const {
    primaryImage,
    discount,
    colorSwatches,
    isSoldOut,
    isWishlisted,
    handleAdd,
    handleWishlist,
    quickSize,
  } = useProductActions(product);
  const storeOrBrandName = product.brand?.name || product.store?.name;

  const handlePress = () => {
    router.push(`/(main)/products/${product.slug}`);
  };

  const brandSlug = product.brand?.slug;
  const renderBrandLabel = () => {
    if (!storeOrBrandName) return null;
    if (brandSlug) {
      return (
        <Link href={`/(main)/brands/${brandSlug}` as never} asChild>
          <TouchableOpacity onPress={(e) => e.stopPropagation()} hitSlop={4}>
            <Text style={styles.storeName} numberOfLines={1}>
              {storeOrBrandName}
            </Text>
          </TouchableOpacity>
        </Link>
      );
    }
    return (
      <Text style={styles.storeName} numberOfLines={1}>
        {storeOrBrandName}
      </Text>
    );
  };

  const priceLabel = product.price ? formatPrice(product.price) : "Price on request";

  const renderPrice = (size: "sm" | "base" = "base") => (
    <View style={styles.priceRow}>
      <Price size={size} style={styles.price} numberOfLines={1}>
        {priceLabel}
      </Price>
      {discount > 0 ? (
        <Text style={styles.mrp} numberOfLines={1}>
          {formatPrice(product.mrp)}
        </Text>
      ) : null}
    </View>
  );

  const renderMetaRow = () => {
    const hasRating = product.rating > 0;
    if (colorSwatches.length === 0 && !hasRating) return null;
    return (
      <View style={styles.metaRow}>
        <View style={styles.swatches}>
          {colorSwatches.map((hex, i) => (
            <View
              key={hex}
              style={[styles.swatch, { backgroundColor: hex, marginLeft: i === 0 ? 0 : 4 }]}
            />
          ))}
        </View>
        {hasRating ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={10} color={colors.accent2.ochre} />
            <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
            {product.total_reviews ? (
              <Text style={styles.ratingCount}>({product.total_reviews})</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderDiscountTag = () =>
    discount > 0 ? (
      <View style={styles.discountTag}>
        <Text style={styles.discountText}>−{discount}%</Text>
      </View>
    ) : null;

  const renderSoldOut = () =>
    isSoldOut ? (
      <View style={styles.soldOutOverlay}>
        <View style={styles.soldOutPill}>
          <Text style={styles.soldOutText}>Sold out</Text>
        </View>
      </View>
    ) : null;

  const renderImage = (iconSize = 26) =>
    primaryImage ? (
      <Image source={{ uri: primaryImage }} style={styles.image} contentFit="cover" transition={300} />
    ) : (
      <View style={styles.placeholderWrap}>
        <Ionicons name="shirt-outline" size={iconSize} color={colors.light.mutedForeground} />
      </View>
    );

  const renderWishlist = (size = 15) => (
    <TouchableOpacity
      style={styles.wishlistBtn}
      onPress={handleWishlist}
      activeOpacity={0.7}
      hitSlop={6}
      accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
    >
      <Ionicons
        name={isWishlisted ? "heart" : "heart-outline"}
        size={size}
        color={isWishlisted ? colors.accent2.rust : colors.light.foreground}
      />
    </TouchableOpacity>
  );

  if (listMode) {
    return (
      <>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.listCard}>
        <View style={styles.listImageWrap}>
          {renderImage(24)}
          {renderDiscountTag()}
          {renderSoldOut()}
        </View>
        <View style={styles.listInfo}>
          <View>
            {storeOrBrandName ? (
              <View style={styles.storeRow}>{renderBrandLabel()}</View>
            ) : null}
            <Text numberOfLines={2} style={styles.listName}>
              {product.name || "Untitled Piece"}
            </Text>
            {product.short_description ? (
              <Text numberOfLines={1} style={styles.listDesc}>
                {product.short_description}
              </Text>
            ) : null}
            {renderMetaRow()}
          </View>
          <View style={styles.listPriceRow}>
            <View style={{ flex: 1 }}>{renderPrice("base")}</View>
            <View style={styles.listActions}>
              <TouchableOpacity
                style={styles.listActionBtn}
                onPress={handleWishlist}
                activeOpacity={0.7}
                accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
              >
                <Ionicons
                  name={isWishlisted ? "heart" : "heart-outline"}
                  size={16}
                  color={isWishlisted ? colors.accent2.rust : colors.light.foreground}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.listAddBtn, isSoldOut && styles.addBtnDisabled]}
                onPress={handleAdd}
                activeOpacity={0.8}
                disabled={isSoldOut}
                accessibilityLabel="Add to basket"
              >
                <Ionicons name="bag-add-outline" size={16} color={colors.light.primaryForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      <QuickSizeModal
        {...quickSize}
        product={product}
      />
      </>
    );
  }

  if (horizontal) {
    const w = 160;
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={[styles.horizontalCard, { width: w }]}>
        <View style={[styles.imageWrap, { width: w, height: 208 }]}>
          {renderImage(24)}
          {renderDiscountTag()}
          {renderSoldOut()}
          {renderWishlist(14)}
        </View>
        <View style={styles.info}>
          {storeOrBrandName ? (
            <View style={styles.storeRow}>{renderBrandLabel()}</View>
          ) : null}
          <Text numberOfLines={1} style={styles.productName}>
            {product.name || "Untitled Piece"}
          </Text>
          {renderPrice("sm")}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <>
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={[styles.card, surface && styles.cardSurface]}>
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {renderImage()}
        {renderDiscountTag()}
        {renderSoldOut()}
        {renderWishlist()}
        {!isSoldOut ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAdd}
            activeOpacity={0.8}
            hitSlop={6}
            accessibilityLabel="Add to basket"
          >
            <Ionicons name="bag-add-outline" size={15} color={colors.light.primaryForeground} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.info}>
        {storeOrBrandName ? (
          <View style={styles.storeRow}>{renderBrandLabel()}</View>
        ) : null}
        <Text numberOfLines={1} style={styles.productName}>
          {product.name || "Untitled Piece"}
        </Text>
        {renderPrice()}
        {renderMetaRow()}
      </View>
    </TouchableOpacity>
    <QuickSizeModal
      {...quickSize}
      product={product}
    />
    </>
  );
}

const IMAGE_BG = "#efede4";

const styles = StyleSheet.create({
  card: {
    width: "100%",
    marginBottom: spacing[6],
  },
  cardSurface: {
    marginBottom: 4,
    padding: 5,
    paddingBottom: 10,
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  imageWrap: {
    width: "100%",
    borderRadius: radii["2xl"],
    backgroundColor: IMAGE_BG,
    overflow: "hidden",
    marginBottom: spacing[2.5],
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderWrap: {
    width: "100%",
    height: "100%",
    backgroundColor: IMAGE_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  discountTag: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: colors.accent2.rust,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.md,
  },
  discountText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 0.3,
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 244, 239, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldOutPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.ink.DEFAULT,
  },
  soldOutText: {
    color: colors.paper.cream,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fontFamilies.mono.semibold,
  },
  addBtnDisabled: {
    backgroundColor: colors.light.muted,
    opacity: 0.6,
  },
  wishlistBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(250, 248, 241, 0.9)",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  info: {
    paddingHorizontal: 2,
    gap: 3,
  },
  productName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.light.foreground,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 1,
  },
  price: {
    flexShrink: 1,
  },
  mrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    textDecorationLine: "line-through",
    color: colors.light.mutedForeground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 4,
  },
  swatches: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  swatch: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22, 23, 15, 0.35)",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rating: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.foreground,
  },
  ratingCount: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },
  horizontalCard: {
    marginRight: 12,
  },
  listCard: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    padding: 8,
    gap: spacing[3],
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  listImageWrap: {
    width: 108,
    height: 136,
    borderRadius: radii.xl,
    overflow: "hidden",
    position: "relative",
    backgroundColor: IMAGE_BG,
  },
  listInfo: {
    flex: 1,
    paddingVertical: 4,
    paddingRight: 4,
    justifyContent: "space-between",
  },
  listName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.light.foreground,
  },
  listDesc: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  listPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    marginTop: spacing[2],
  },
  listActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.cream,
  },
  listAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  storeName: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
});
