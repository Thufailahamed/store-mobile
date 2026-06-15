import React, { useState, useMemo } from "react";
import { View, Pressable, StyleSheet, type ViewStyle, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { CartItem } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";
import { QuantityPickerSheet } from "@/components/cart/QuantityPickerSheet";
import { SizePickerSheet } from "@/components/cart/SizePickerSheet";
import {
  buildAvailableSizeOptions,
  getVariantStock,
} from "@/components/cart/variant-utils";

interface CartItemCardProps {
  item: CartItem;
  product?: Product;
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
  selected = true,
  onToggleSelect,
  onIncrement,
  onDecrement,
  onRemove,
  onUpdateQuantity,
  onUpdateVariant,
  style,
}: CartItemCardProps) {
  const router = useRouter();
  const theme = useTheme();

  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [sizeModalVisible, setSizeModalVisible] = useState(false);

  const goToProduct = () => {
    if (item.productId) {
      router.push({
        pathname: "/(main)/products/[slug]",
        params: { slug: item.productId },
      });
    }
  };

  // Available sizes (in stock only)
  const availableSizes = useMemo(
    () => buildAvailableSizeOptions(product?.variants, item.variantId),
    [product?.variants, item.variantId]
  );

  const activeVariant = useMemo(() => {
    if (!product?.variants || !item.variantId) return null;
    return product.variants.find((v) => v.id === item.variantId) || null;
  }, [product, item.variantId]);

  const availableStock = useMemo(
    () => getVariantStock(activeVariant, item.stock ?? 99),
    [activeVariant, item.stock]
  );

  const handleSelectSize = (variantId: string, variantLabel: string) => {
    onUpdateVariant?.(variantId, variantLabel);
  };

  const mrp = activeVariant?.mrp || product?.mrp || item.price * 1.5;
  const discount = Math.round(((mrp - item.price) / mrp) * 100);

  // Extract size part from variantLabel (e.g. "Black 32" -> "32")
  const sizeLabel = useMemo(() => {
    if (!item.variantLabel) return "Free";
    const parts = item.variantLabel.split(" ");
    return parts[parts.length - 1] || "Free";
  }, [item.variantLabel]);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, style]}>
      {/* Top Right Close Button */}
      <TouchableOpacity onPress={onRemove} style={styles.closeBtn}>
        <Ionicons name="close" size={18} color={theme.colors.mutedForeground} />
      </TouchableOpacity>

      {/* Left Checkbox */}
      {onToggleSelect && (
        <TouchableOpacity onPress={onToggleSelect} style={styles.checkboxContainer}>
          <View style={[
            styles.checkbox,
            {
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              backgroundColor: selected ? theme.colors.primary : "transparent"
            }
          ]}>
            {selected && <Ionicons name="checkmark" size={12} color={theme.colors.primaryForeground} />}
          </View>
        </TouchableOpacity>
      )}

      {/* Image */}
      <Pressable onPress={goToProduct} style={[styles.imageWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={styles.image}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name="image-outline"
              size={20}
              color={theme.colors.mutedForeground}
            />
          </View>
        )}
      </Pressable>

      {/* Right Info Section */}
      <View style={styles.info}>
        {/* Brand */}
        <Body style={[styles.brand, { color: theme.colors.foreground }]} numberOfLines={1}>
          {product?.brand?.name || "Luxe Boutique"}
        </Body>

        {/* Product Description */}
        <Body style={[styles.name, { color: theme.colors.mutedForeground }]} numberOfLines={1}>
          {item.name}
        </Body>

        {/* Dropdown Selectors Row */}
        <View style={styles.selectorRow}>
          {/* Size Selector */}
          {(availableSizes.length > 0 || item.variantLabel) && (
            <TouchableOpacity
              onPress={() => {
                if (availableSizes.length > 0) {
                  setSizeModalVisible(true);
                }
              }}
              disabled={availableSizes.length === 0}
              style={[
                styles.selectorChip,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                }
              ]}
            >
              <Body style={[styles.selectorText, { color: theme.colors.foreground }]}>
                Size: {sizeLabel}
              </Body>
              <Ionicons name="chevron-down" size={12} color={theme.colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {/* Qty Selector */}
          <TouchableOpacity
            onPress={() => setQtyModalVisible(true)}
            style={[
              styles.selectorChip,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              }
            ]}
          >
            <Body style={[styles.selectorText, { color: theme.colors.foreground }]}>
              Qty: {item.quantity}
            </Body>
            <Ionicons name="chevron-down" size={12} color={theme.colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Price & Discount Row */}
        <View style={styles.priceRow}>
          <Price size="md" style={{ color: theme.colors.foreground }}>
            {formatPrice(item.price)}
          </Price>
          {mrp > item.price && (
            <>
              <Body style={[styles.originalPrice, { color: theme.colors.mutedForeground }]}>
                {formatPrice(mrp)}
              </Body>
              <Body style={[styles.discountText, { color: theme.isDark ? theme.olive[400] : theme.olive[600] }]}>
                {discount}% Off
              </Body>
            </>
          )}
          <Ionicons name="information-circle-outline" size={13} color={theme.colors.mutedForeground} style={{ marginLeft: 4 }} />
        </View>

        {/* Return policy */}
        <View style={styles.returnContainer}>
          <Ionicons name="arrow-undo-outline" size={11} color={theme.colors.mutedForeground} />
          <Body style={[styles.returnText, { color: theme.colors.mutedForeground }]}>7 days return</Body>
        </View>
      </View>

      {/* Picker Modals */}
      <QuantityPickerSheet
        visible={qtyModalVisible}
        currentQuantity={item.quantity}
        stock={availableStock}
        onConfirm={onUpdateQuantity}
        onClose={() => setQtyModalVisible(false)}
      />

      <SizePickerSheet
        visible={sizeModalVisible}
        product={product}
        currentVariantId={item.variantId}
        sellerName={product?.store?.name}
        onConfirm={handleSelectSize}
        onClose={() => setSizeModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  checkboxContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrap: {
    width: 76,
    height: 96,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
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
    paddingLeft: 12,
    gap: 2,
  },
  brand: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 14,
    marginRight: 24, // Leave space for close btn
  },
  name: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 16,
  },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  selectorChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  selectorText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  originalPrice: {
    textDecorationLine: "line-through",
    fontSize: 12.5,
    marginLeft: 6,
  },
  discountText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 12.5,
    marginLeft: 6,
  },
  returnContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  returnText: {
    fontSize: 11,
  },
});
