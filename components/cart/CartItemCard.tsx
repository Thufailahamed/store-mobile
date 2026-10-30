import React, { useMemo } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  TouchableOpacity,
  Text,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { CartItem } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";
import { SizePickerSheet } from "@/components/cart/SizePickerSheet";
import {
  buildAvailableSizeOptions,
  getVariantStock,
} from "@/components/cart/variant-utils";

const INK = colors.light.foreground;
const MUTED = colors.light.mutedForeground;
const DEAL_BG = `${colors.accent2.rust}12`;
const DEAL_TEXT = colors.accent2.rust;

const CHECKBOX_SIZE = 24;
const IMAGE_SIZE = 96;

interface CartItemCardProps {
  item: CartItem;
  product?: Product;
  unavailableMessage?: string;
  selected?: boolean;
  onToggleSelect?: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateVariant?: (newVariantId: string, newVariantLabel: string) => void;
  style?: ViewStyle;
}

export function CartItemCard({
  item,
  product,
  unavailableMessage,
  selected = true,
  onToggleSelect,
  onIncrement,
  onDecrement,
  onRemove,
  onUpdateVariant,
  style,
}: CartItemCardProps) {
  const router = useRouter();
  const [sizeModalVisible, setSizeModalVisible] = React.useState(false);

  const goToProduct = () => {
    const slug = product?.slug ?? item.productId;
    router.push(`/(main)/products/${slug}`);
  };

  const goToStore = () => {
    const slug = product?.store?.slug;
    if (slug) router.push(`/(main)/stores/${slug}`);
  };

  const availableSizes = useMemo(
    () => buildAvailableSizeOptions(product?.variants, item.variantId),
    [product?.variants, item.variantId],
  );

  const activeVariant = useMemo(() => {
    if (!product?.variants || !item.variantId) return null;
    return product.variants.find((v) => v.id === item.variantId) || null;
  }, [product, item.variantId]);

  const availableStock = useMemo(
    () => getVariantStock(activeVariant, item.stock ?? 99),
    [activeVariant, item.stock],
  );

  const handleSelectSize = (variantId: string, variantLabel: string) => {
    onUpdateVariant?.(variantId, variantLabel);
  };

  const mrp = activeVariant?.mrp || product?.mrp || item.price;
  const discount =
    mrp > item.price ? Math.round(((mrp - item.price) / mrp) * 100) : 0;

  const variantDisplay = useMemo(() => {
    if (activeVariant?.color && activeVariant?.size) {
      return `${activeVariant.color}, ${activeVariant.size}`;
    }
    if (item.variantLabel) return item.variantLabel;
    if (activeVariant?.size) return activeVariant.size;
    if (activeVariant?.color) return activeVariant.color;
    return "1PC";
  }, [activeVariant, item.variantLabel]);

  const imageUrl =
    activeVariant?.image_url ||
    product?.images?.find((i) => i.is_primary)?.url ||
    product?.images?.[0]?.url ||
    item.image;

  const storeName = product?.store?.name || "Luxe Boutique";
  const isFlashSale = discount >= 30;
  const lowStock = availableStock > 0 && availableStock <= 10;
  const socialProof =
    !lowStock && (product?.total_sales ?? 0) > 0
      ? `${Math.max(1, (product?.total_sales ?? 0) % 99)} purchased yesterday`
      : null;

  const atMaxQty = item.quantity >= availableStock;
  const isUnavailable = Boolean(unavailableMessage);

  return (
    <View style={[styles.card, selected && styles.cardSelected, isUnavailable && styles.cardUnavailable, style]}>
      {unavailableMessage ? (
        <View style={styles.unavailableBanner}>
          <Ionicons name="alert-circle" size={14} color={colors.accent2.rust} />
          <Text style={styles.unavailableText}>{unavailableMessage}</Text>
        </View>
      ) : null}
      <View style={styles.topRow}>
        <View style={styles.mediaRow}>
          {onToggleSelect ? (
            <TouchableOpacity
              onPress={onToggleSelect}
              style={styles.checkboxHit}
              activeOpacity={0.8}
              hitSlop={6}
            >
              <View
                style={[
                  styles.checkbox,
                  selected
                    ? styles.checkboxSelected
                    : styles.checkboxUnselected,
                ]}
              >
                {selected ? (
                  <Ionicons name="checkmark" size={13} color="#c8e08a" />
                ) : null}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.checkboxSpacer} />
          )}

          <Pressable onPress={goToProduct} style={styles.imageWrap}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={22} color={MUTED} />
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.info}>
          <Pressable onPress={goToProduct}>
            <Text style={styles.title} numberOfLines={2}>
              {item.name}
            </Text>
          </Pressable>

          <TouchableOpacity
            style={styles.soldByRow}
            activeOpacity={0.7}
            onPress={goToStore}
          >
            <Text style={styles.soldByText} numberOfLines={1}>
              Sold by {storeName}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={MUTED} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.variantPill}
            activeOpacity={0.8}
            onPress={() => {
              if (availableSizes.length > 0) setSizeModalVisible(true);
            }}
            disabled={availableSizes.length === 0}
          >
            <Text style={styles.variantText} numberOfLines={1}>
              {variantDisplay}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.olive[800]} />
          </TouchableOpacity>

          <View style={styles.badgeRow}>
            {/* 0357 — final-sale stores don't take returns. Unknown = available. */}
            {product?.store?.accepts_returns === false ? (
              <View style={[styles.badge, styles.dealBadge]} accessibilityLabel="Returns not available">
                <Ionicons name="ban-outline" size={11} color={DEAL_TEXT} />
                <Text style={[styles.badgeText, styles.dealBadgeText]}>Returns not available</Text>
              </View>
            ) : (
              <View style={styles.badge} accessibilityLabel="Returns available">
                <Ionicons name="refresh-outline" size={11} color={INK} />
                <Text style={styles.badgeText}>Returns available</Text>
              </View>
            )}
            {isFlashSale ? (
              <View style={[styles.badge, styles.dealBadge]}>
                <Ionicons name="flash" size={11} color={DEAL_TEXT} />
                <Text style={[styles.badgeText, styles.dealBadgeText]}>
                  Flash Sale
                </Text>
              </View>
            ) : discount > 0 ? (
              <View style={[styles.badge, styles.dealBadge]}>
                <Text style={[styles.badgeText, styles.dealBadgeText]}>
                  New customer deal
                </Text>
              </View>
            ) : null}
          </View>

          {lowStock ? (
            <Text style={styles.urgencyRed}>Only {availableStock} left</Text>
          ) : socialProof ? (
            <Text style={styles.urgencyMuted}>{socialProof}</Text>
          ) : null}

          <View style={styles.priceRow}>
            <Text style={styles.priceCurrent}>{formatPrice(item.price)}</Text>
            {mrp > item.price ? (
              <>
                <Text style={styles.priceOriginal}>{formatPrice(mrp)}</Text>
                <Text style={styles.priceDiscount}>(-{discount}%)</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.stepperSlot}>
          <View style={styles.qtyStepper}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={onDecrement}
              activeOpacity={0.7}
              disabled={item.quantity <= 1 || isUnavailable}
              hitSlop={6}
              accessibilityLabel="Decrease quantity"
            >
              <Ionicons
                name="remove"
                size={16}
                color={item.quantity <= 1 || isUnavailable ? MUTED : INK}
              />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={onIncrement}
              activeOpacity={0.7}
              disabled={atMaxQty || isUnavailable}
              hitSlop={6}
              accessibilityLabel="Increase quantity"
            >
              <Ionicons
                name="add"
                size={16}
                color={atMaxQty || isUnavailable ? MUTED : INK}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color={colors.accent2.rust} />
          <Text style={styles.deleteText}>Remove</Text>
        </TouchableOpacity>
      </View>

      <SizePickerSheet
        visible={sizeModalVisible}
        product={product}
        currentVariantId={item.variantId}
        sellerName={storeName}
        onConfirm={handleSelectSize}
        onClose={() => setSizeModalVisible(false)}
      />
    </View>
  );
}

const LINE = "rgba(22,23,15,0.07)";
const SOFT = colors.olive[50];
const IMG_BG = "#f0ede2";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  cardSelected: {
    borderColor: `${colors.olive[600]}33`,
  },
  cardUnavailable: {
    opacity: 0.75,
    borderColor: `${colors.accent2.rust}55`,
  },
  unavailableBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: `${colors.accent2.rust}12`,
  },
  unavailableText: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.accent2.rust,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  mediaRow: {
    position: "relative",
    width: IMAGE_SIZE,
  },
  checkboxHit: {
    position: "absolute",
    top: 7,
    left: 7,
    zIndex: 2,
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSpacer: {
    display: "none",
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: CHECKBOX_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: INK,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  checkboxUnselected: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(22,23,15,0.25)",
  },
  imageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE * 1.18,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: IMG_BG,
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
  info: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
    gap: 7,
  },
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: INK,
  },
  soldByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginTop: -3,
  },
  soldByText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 16,
    color: MUTED,
    flexShrink: 1,
  },
  variantPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: SOFT,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 26,
    maxWidth: "100%",
  },
  variantText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.olive[800],
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f3ec",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 22,
  },
  badgeText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    lineHeight: 14,
    color: INK,
  },
  dealBadge: {
    backgroundColor: DEAL_BG,
  },
  dealBadgeText: {
    color: DEAL_TEXT,
    fontFamily: fontFamilies.sans.semibold,
  },
  urgencyRed: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.accent2.rust,
  },
  urgencyMuted: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 1,
  },
  priceCurrent: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  priceOriginal: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  priceDiscount: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.olive[600],
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
    gap: 12,
  },
  stepperSlot: {
    width: 116,
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f3ec",
    borderRadius: radii.full,
    height: 38,
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  qtyValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    lineHeight: 18,
    color: INK,
    minWidth: 22,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${colors.accent2.rust}10`,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    height: 38,
    justifyContent: "center",
    flexShrink: 0,
  },
  deleteText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.accent2.rust,
  },
});
