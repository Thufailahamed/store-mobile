import { View, TouchableOpacity, StyleSheet, Dimensions, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCart, useWishlist } from "@/lib/stores";
import { Label, Price, Body } from "@/components/ui/Typography";
import { colors, typography, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Align card width precisely with products/index.tsx grid (GRID_PADDING = 16, GRID_COL_GAP = 12)
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;
const IMAGE_HEIGHT = CARD_WIDTH * (4 / 3);

interface ProductCardProps {
  product: Product;
  /** Horizontal-rail card (fixed width, scrollable). */
  horizontal?: boolean;
  /** Full-width list card (image-left, info-right). */
  listMode?: boolean;
}

export function ProductCard({ product, horizontal, listMode }: ProductCardProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { toggle, items: wishlistItems } = useWishlist();
  const isWishlisted = !!wishlistItems[product.id];
  const primaryImage = product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const storeOrBrandName = product.store?.name || product.brand?.name;
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

  const handlePress = () => {
    router.push(`/(main)/products/${product.slug}`);
  };

  const handleAdd = () => {
    const variant = product.variants?.[0];
    addItem({
      productId: product.id,
      variantId: variant?.id ?? null,
      storeId: product.store_id,
      name: product.name,
      variantLabel: variant ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim() : undefined,
      price: product.price,
      image: primaryImage,
      stock: variant?.stock ?? 99,
      quantity: 1,
    });
  };

  if (listMode) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.listCard}>
        <View style={styles.listImageWrap}>
          {primaryImage ? (
            <Image source={{ uri: primaryImage }} style={styles.listImage} contentFit="cover" transition={300} />
          ) : (
            <View style={styles.placeholderWrap}>
              <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
            </View>
          )}
          {discount > 0 ? (
            <View style={[styles.discountBadge, { top: 6, right: 6 }]}>
              <Label style={styles.discountText}>{discount}% OFF</Label>
            </View>
          ) : null}
        </View>
        <View style={styles.listInfo}>
          <View>
            <Body size="sm" numberOfLines={1} style={[styles.listName, { fontFamily: fontFamilies.sans.bold, fontWeight: "700" }]}>
              {product.name || "Untitled Piece"}
            </Body>
            {storeOrBrandName ? (
              <View style={styles.storeRow}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {storeOrBrandName}
                </Text>
              </View>
            ) : null}
            {product.short_description ? (
              <Body muted size="xs" numberOfLines={1} style={styles.listDesc}>
                {product.short_description}
              </Body>
            ) : null}
          </View>
          <View style={styles.listPriceRow}>
            <View style={styles.priceRow}>
              {discount > 0 ? (
                <>
                  <Body muted size="xs" style={styles.mrp}>{formatPrice(product.mrp)}</Body>
                  <Price size="base">{product.price ? formatPrice(product.price) : "Price on Request"}</Price>
                  <Body size="xs" style={styles.discountPct}>{discount}% OFF</Body>
                </>
              ) : (
                <Price size="base">{product.price ? formatPrice(product.price) : "Price on Request"}</Price>
              )}
            </View>
            <View style={styles.listActions}>
              <TouchableOpacity
                style={styles.listActionBtn}
                onPress={() => toggle(product.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isWishlisted ? "heart" : "heart-outline"}
                  size={16}
                  color={isWishlisted ? colors.light.destructive : colors.light.foreground}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.listAddBtn} onPress={handleAdd} activeOpacity={0.8}>
                <Ionicons name="add" size={18} color={colors.light.primaryForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (horizontal) {
    const w = 160;
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={[styles.horizontalCard, { width: w }]}>
        <View style={[styles.imageWrap, { width: w, height: 200 }]}>
          {primaryImage ? (
            <Image source={{ uri: primaryImage }} style={styles.image} contentFit="cover" transition={300} />
          ) : (
            <View style={styles.placeholderWrap}>
              <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
            </View>
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Label style={styles.discountText}>{discount}% OFF</Label>
            </View>
          )}
          <TouchableOpacity
            style={styles.wishlistBtn}
            onPress={() => toggle(product.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={14}
              color={isWishlisted ? colors.light.destructive : colors.light.foreground}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.info}>
          <Body size="sm" numberOfLines={1} style={[styles.productName, { fontFamily: fontFamilies.sans.bold, fontWeight: "700" }]}>
            {product.name || "Untitled Piece"}
          </Body>
          {storeOrBrandName ? (
            <View style={styles.storeRow}>
              <Text style={styles.storeName} numberOfLines={1}>
                {storeOrBrandName}
              </Text>
            </View>
          ) : null}
          <View style={styles.priceRow}>
            {discount > 0 ? (
              <>
                <Body muted size="xs" style={styles.mrp}>{formatPrice(product.mrp)}</Body>
                <Price size="base">{product.price ? formatPrice(product.price) : "Price on Request"}</Price>
                <Body size="xs" style={styles.discountPct}>{discount}% OFF</Body>
              </>
            ) : (
              <Price size="base">{product.price ? formatPrice(product.price) : "Price on Request"}</Price>
            )}
          </View>
          {product.rating > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={colors.olive[600]} />
              <Body size="xs" style={styles.rating}>{product.rating.toFixed(1)}</Body>
              <Body muted size="xs">({product.total_reviews})</Body>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.card}>
      <View style={styles.imageWrap}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={styles.image} contentFit="cover" transition={300} />
        ) : (
          <View style={styles.placeholderWrap}>
            <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
          </View>
        )}
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Label style={styles.discountText}>{discount}% OFF</Label>
          </View>
        )}
        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={() => toggle(product.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={16}
            color={isWishlisted ? colors.light.destructive : colors.light.foreground}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={colors.light.primaryForeground} />
        </TouchableOpacity>
      </View>
      <View style={styles.info}>
        <Body size="sm" numberOfLines={1} style={[styles.productName, { fontFamily: fontFamilies.sans.bold, fontWeight: "700" }]}>
          {product.name || "Untitled Piece"}
        </Body>
        {storeOrBrandName ? (
          <View style={styles.storeRow}>
            <Text style={styles.storeName} numberOfLines={1}>
              {storeOrBrandName}
            </Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          {discount > 0 ? (
            <>
              <Body muted size="xs" style={styles.mrp}>{formatPrice(product.mrp)}</Body>
              <Price size="base">{product.price ? formatPrice(product.price) : "Price on Request"}</Price>
              <Body size="xs" style={styles.discountPct}>{discount}% OFF</Body>
            </>
          ) : (
            <Price size="base">{product.price ? formatPrice(product.price) : "Price on Request"}</Price>
          )}
        </View>
        {colorSwatches.length > 0 && (
          <View style={styles.swatches}>
            {colorSwatches.map((hex) => (
              <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
            ))}
          </View>
        )}
        {product.rating > 0 && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={colors.olive[600]} />
            <Body size="xs" style={styles.rating}>{product.rating.toFixed(1)}</Body>
            <Body muted size="xs">({product.total_reviews})</Body>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: 24,
  },
  imageWrap: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 0.5,
    borderColor: "rgba(200, 200, 184, 0.4)",
    overflow: "hidden",
    marginBottom: 8,
    position: "relative",
    ...shadows.soft,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderWrap: {
    width: "100%",
    height: "100%",
    backgroundColor: "#eaeade",
    alignItems: "center",
    justifyContent: "center",
  },
  discountBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colors.accent2.rust,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  discountText: {
    color: "#fff",
    fontSize: 9,
    letterSpacing: typography.letterSpacing.wide,
  },
  wishlistBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  info: {
    paddingHorizontal: 4,
    gap: 4,
  },
  brandName: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: 1,
  },
  productName: {
    fontFamily: fontFamilies.sans.medium,
    lineHeight: 18,
    color: colors.light.foreground,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  },
  mrp: {
    fontSize: 11,
    textDecorationLine: "line-through",
    color: colors.light.mutedForeground,
  },
  swatches: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(22, 26, 10, 0.15)",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  rating: {
    color: colors.olive[600],
  },
  horizontalCard: {
    marginRight: 12,
  },
  listCard: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 0.5,
    borderColor: "rgba(200, 200, 184, 0.4)",
    overflow: "hidden",
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  listImageWrap: {
    width: 110,
    height: 140,
    position: "relative",
    backgroundColor: colors.light.muted,
  },
  listImage: {
    width: "100%",
    height: "100%",
  },
  listInfo: {
    flex: 1,
    padding: spacing[3],
    justifyContent: "space-between",
  },
  listName: {
    fontFamily: fontFamilies.sans.medium,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 4,
  },
  listDesc: {
    marginTop: 2,
  },
  listPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[2],
  },
  listActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  listAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.glow,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  storeName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  discountPct: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.accent2.rust,
    marginLeft: 4,
  },
});
