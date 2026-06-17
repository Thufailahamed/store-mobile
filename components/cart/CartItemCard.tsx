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
import Ionicons from "@expo/vector-icons/Ionicons";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { CartItem } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";
import { SizePickerSheet } from "@/components/cart/SizePickerSheet";
import {
  buildAvailableSizeOptions,
  getVariantStock,
} from "@/components/cart/variant-utils";

const ACCENT = "#E02020";
const INK = "#161823";
const MUTED = "#8A8B91";
const PILL_BG = "#F1F1F2";
const DEAL_BG = "#FFF0F3";
const DEAL_TEXT = "#E02020";

const CHECKBOX_SIZE = 22;
const MEDIA_GAP = 10;
const IMAGE_SIZE = 88;
const LEADING_OFFSET = CHECKBOX_SIZE + MEDIA_GAP;

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

  const mrp = activeVariant?.mrp || product?.mrp || item.price * 1.5;
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
    <View style={[styles.card, isUnavailable && styles.cardUnavailable, style]}>
      {unavailableMessage ? (
        <View style={styles.unavailableBanner}>
          <Ionicons name="alert-circle" size={14} color="#B45309" />
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
                  <Ionicons name="checkmark" size={14} color="#fff" />
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
            <Ionicons name="chevron-down" size={12} color={INK} />
          </TouchableOpacity>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="car-outline" size={11} color={INK} />
              <Text style={styles.badgeText}>Free Returns</Text>
            </View>
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
              onPress={item.quantity <= 1 ? onRemove : onDecrement}
              activeOpacity={0.7}
              hitSlop={6}
            >
              <Ionicons
                name={item.quantity <= 1 ? "trash-outline" : "remove"}
                size={16}
                color={INK}
              />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={onIncrement}
              activeOpacity={0.7}
              disabled={atMaxQty || isUnavailable}
              hitSlop={6}
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
          <Text style={styles.deleteText}>Delete</Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardUnavailable: {
    opacity: 0.72,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
  },
  unavailableBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
  },
  unavailableText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    lineHeight: 16,
    color: "#92400E",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: MEDIA_GAP,
    width: LEADING_OFFSET + IMAGE_SIZE,
  },
  checkboxHit: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSpacer: {
    width: CHECKBOX_SIZE,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: CHECKBOX_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderWidth: 0,
  },
  checkboxUnselected: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#C4C4C4",
  },
  imageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: PILL_BG,
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
    paddingTop: 2,
    gap: 6,
  },
  title: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    lineHeight: 19,
    color: INK,
  },
  soldByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  soldByText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
    flexShrink: 1,
  },
  variantPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: PILL_BG,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  variantText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 16,
    color: INK,
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
    backgroundColor: PILL_BG,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 14,
    color: INK,
  },
  dealBadge: {
    backgroundColor: DEAL_BG,
  },
  dealBadgeText: {
    color: DEAL_TEXT,
    fontFamily: fontFamilies.sans.medium,
  },
  urgencyRed: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    lineHeight: 16,
    color: ACCENT,
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
    gap: 6,
    marginTop: 2,
  },
  priceCurrent: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    lineHeight: 20,
    color: ACCENT,
  },
  priceOriginal: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 17,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  priceDiscount: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    lineHeight: 17,
    color: ACCENT,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingLeft: LEADING_OFFSET,
    gap: 12,
  },
  stepperSlot: {
    width: IMAGE_SIZE,
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PILL_BG,
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 2,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: INK,
    minWidth: 20,
    textAlign: "center",
  },
  deleteBtn: {
    backgroundColor: PILL_BG,
    borderRadius: 8,
    paddingHorizontal: 18,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  deleteText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    lineHeight: 18,
    color: INK,
  },
});
