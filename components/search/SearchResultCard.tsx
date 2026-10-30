import React, { useRef } from "react";
import { Animated as RNAnimated, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { QuickSizeModal } from "@/components/product/QuickSizeModal";
import { useProductActions } from "@/components/product/useProductActions";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

const INK = colors.ink.DEFAULT;

type SearchProduct = Product & { match_reason?: string | null };

interface SearchResultCardProps {
  product: SearchProduct;
  width: number;
  index: number;
  onPress: (p: Product) => void;
}

/** Spring-scale on press — the card "gives" under the thumb. */
function usePressScale() {
  const scale = useRef(new RNAnimated.Value(1)).current;
  const to = (v: number) =>
    RNAnimated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return { scale, onPressIn: () => to(0.97), onPressOut: () => to(1) };
}

/** The backend sends e.g. "Category match · shirt · Colour match · black".
 *  The generic "… match" labels are noise on a card — keep the matched terms. */
function matchLabel(reason?: string | null) {
  if (!reason) return null;
  const parts = reason.split("·").map((s) => s.trim()).filter(Boolean);
  const terms = parts.filter((p) => !/\bmatch$/i.test(p));
  if (terms.length) return `Matches ${terms.join(" · ")}`;
  return parts[0] ?? null;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Grid card                                                            */
/* ─────────────────────────────────────────────────────────────────── */

export function SearchResultCard({ product, width, index, onPress }: SearchResultCardProps) {
  const { primaryImage, discount, colorSwatches, isSoldOut, isWishlisted, handleAdd, handleWishlist, quickSize } =
    useProductActions(product);
  const press = usePressScale();
  const brand = product.brand?.name || product.store?.name;
  const reason = matchLabel(product.match_reason);
  const imageHeight = width * 1.3;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(420)} style={{ width }}>
      <Pressable
        onPress={() => onPress(product)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
      >
        <RNAnimated.View style={[styles.card, { transform: [{ scale: press.scale }] }]}>
          {/* Image stage */}
          <View style={[styles.stage, { height: imageHeight }]}>
            {primaryImage ? (
              <Image source={{ uri: primaryImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="shirt-outline" size={28} color={colors.light.mutedForeground} />
              </View>
            )}
            <LinearGradient
              colors={["rgba(22,23,15,0)", "rgba(22,23,15,0.14)"]}
              style={styles.stageScrim}
              pointerEvents="none"
            />

            {/* Top row: discount + wishlist */}
            <View style={styles.topRow} pointerEvents="box-none">
              {discount > 0 ? (
                <View style={styles.discountPill}>
                  <Text style={styles.discountText}>−{discount}%</Text>
                </View>
              ) : (
                <View />
              )}
              <TouchableOpacity
                onPress={handleWishlist}
                hitSlop={8}
                activeOpacity={0.8}
                style={[styles.glassBtn, isWishlisted && styles.glassBtnOn]}
                accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
              >
                <Ionicons
                  name={isWishlisted ? "heart" : "heart-outline"}
                  size={16}
                  color={isWishlisted ? colors.paper.cream : INK}
                />
              </TouchableOpacity>
            </View>

            {/* Bottom row: rating + quick add */}
            <View style={styles.bottomRow} pointerEvents="box-none">
              {product.rating > 0 ? (
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={10} color={colors.accent2.ochre} />
                  <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
                </View>
              ) : (
                <View />
              )}
              {!isSoldOut ? (
                <TouchableOpacity
                  onPress={handleAdd}
                  hitSlop={8}
                  activeOpacity={0.85}
                  style={styles.addBtn}
                  accessibilityLabel="Add to basket"
                >
                  <Ionicons name="add" size={20} color={colors.paper.cream} />
                </TouchableOpacity>
              ) : null}
            </View>

            {isSoldOut ? (
              <View style={styles.soldOut}>
                <Text style={styles.soldOutText}>Sold out</Text>
              </View>
            ) : null}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.brandRow}>
              {brand ? (
                <Text style={styles.brand} numberOfLines={1}>
                  {brand}
                </Text>
              ) : null}
              {colorSwatches.length > 0 ? (
                <View style={styles.swatches}>
                  {colorSwatches.map((hex, i) => (
                    <View key={hex} style={[styles.swatch, { backgroundColor: hex, marginLeft: i ? -3 : 0 }]} />
                  ))}
                </View>
              ) : null}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {product.name || "Untitled piece"}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price} numberOfLines={1}>
                {product.price ? formatPrice(product.price) : "On request"}
              </Text>
              {discount > 0 ? (
                <Text style={styles.mrp} numberOfLines={1}>
                  {formatPrice(product.mrp)}
                </Text>
              ) : null}
            </View>
            {reason ? (
              <View style={styles.reason}>
                <Ionicons name="sparkles" size={9} color={colors.olive[600]} />
                <Text style={styles.reasonText} numberOfLines={1}>
                  {reason}
                </Text>
              </View>
            ) : null}
          </View>
        </RNAnimated.View>
      </Pressable>
      <QuickSizeModal {...quickSize} product={product} />
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* List row                                                             */
/* ─────────────────────────────────────────────────────────────────── */

export function SearchResultRow({ product, index, onPress }: Omit<SearchResultCardProps, "width">) {
  const { primaryImage, discount, isSoldOut, isWishlisted, handleAdd, handleWishlist, quickSize } =
    useProductActions(product);
  const press = usePressScale();
  const brand = product.brand?.name || product.store?.name;
  const reason = matchLabel(product.match_reason);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(380)}>
      <Pressable
        onPress={() => onPress(product)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
      >
        <RNAnimated.View style={[styles.row, { transform: [{ scale: press.scale }] }]}>
          <View style={styles.rowImage}>
            {primaryImage ? (
              <Image source={{ uri: primaryImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="shirt-outline" size={22} color={colors.light.mutedForeground} />
              </View>
            )}
            {discount > 0 ? (
              <View style={[styles.discountPill, styles.rowDiscount]}>
                <Text style={styles.discountText}>−{discount}%</Text>
              </View>
            ) : null}
            {isSoldOut ? (
              <View style={styles.soldOut}>
                <Text style={styles.soldOutText}>Sold out</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.rowInfo}>
            <View>
              {brand ? (
                <Text style={styles.brand} numberOfLines={1}>
                  {brand}
                </Text>
              ) : null}
              <Text style={[styles.name, styles.rowName]} numberOfLines={2}>
                {product.name || "Untitled piece"}
              </Text>
              {product.rating > 0 || product.total_sales > 0 ? (
                <View style={styles.rowMeta}>
                  {product.rating > 0 ? (
                    <>
                      <Ionicons name="star" size={10} color={colors.accent2.ochre} />
                      <Text style={styles.rowMetaText}>{product.rating.toFixed(1)}</Text>
                    </>
                  ) : null}
                  {product.rating > 0 && product.total_sales > 0 ? <Text style={styles.rowMetaDot}>·</Text> : null}
                  {product.total_sales > 0 ? <Text style={styles.rowMetaText}>{product.total_sales} sold</Text> : null}
                </View>
              ) : null}
              {reason ? (
                <View style={[styles.reason, { marginTop: 6 }]}>
                  <Ionicons name="sparkles" size={9} color={colors.olive[600]} />
                  <Text style={styles.reasonText} numberOfLines={1}>
                    {reason}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.rowFooter}>
              <View style={{ flex: 1 }}>
                <Text style={styles.price} numberOfLines={1}>
                  {product.price ? formatPrice(product.price) : "On request"}
                </Text>
                {discount > 0 ? (
                  <Text style={styles.mrp} numberOfLines={1}>
                    {formatPrice(product.mrp)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={handleWishlist}
                hitSlop={6}
                activeOpacity={0.8}
                style={[styles.rowIconBtn, isWishlisted && styles.glassBtnOn]}
                accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
              >
                <Ionicons
                  name={isWishlisted ? "heart" : "heart-outline"}
                  size={15}
                  color={isWishlisted ? colors.paper.cream : INK}
                />
              </TouchableOpacity>
              {!isSoldOut ? (
                <TouchableOpacity
                  onPress={handleAdd}
                  hitSlop={6}
                  activeOpacity={0.85}
                  style={styles.addBtn}
                  accessibilityLabel="Add to basket"
                >
                  <Ionicons name="add" size={20} color={colors.paper.cream} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </RNAnimated.View>
      </Pressable>
      <QuickSizeModal {...quickSize} product={product} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* Grid */
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[900]}14`,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  stage: {
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
  },
  stageScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "38%",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomRow: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  discountPill: {
    paddingHorizontal: 8,
    height: 22,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: INK,
  },
  discountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.olive[200],
  },
  glassBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,241,0.88)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.9)",
  },
  glassBtnOn: {
    backgroundColor: colors.accent2.rust,
    borderColor: colors.accent2.rust,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: radii.full,
    backgroundColor: "rgba(22,23,15,0.55)",
  },
  ratingText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    color: colors.paper.cream,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK,
    borderWidth: 1.5,
    borderColor: "rgba(250,248,241,0.9)",
  },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,248,241,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldOutText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: INK,
    backgroundColor: colors.paper.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  info: {
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 3,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  brand: {
    flexShrink: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  swatches: {
    flexDirection: "row",
  },
  swatch: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.18)",
  },
  name: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    lineHeight: 18,
    color: INK,
  },
  priceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 6,
    marginTop: 3,
  },
  price: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: INK,
  },
  mrp: {
    flexShrink: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  reason: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive[200],
  },
  reasonText: {
    flexShrink: 1,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9.5,
    color: colors.olive[700],
  },

  /* List */
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 8,
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[900]}14`,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  rowImage: {
    width: 100,
    height: 130,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
  },
  rowDiscount: {
    position: "absolute",
    top: 6,
    left: 6,
  },
  rowInfo: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingRight: 4,
  },
  rowName: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 19,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  rowMetaText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  rowMetaDot: {
    color: colors.light.mutedForeground,
    fontSize: 11,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[900]}22`,
  },
});
