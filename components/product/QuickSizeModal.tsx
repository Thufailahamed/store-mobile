import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { getVariantAvailableStock } from "@/lib/inventory";
import type { Product, ProductVariant } from "@/lib/types";

interface QuickSizeModalProps {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
  onSelectVariant: (variant: ProductVariant) => void;
}

export function QuickSizeModal({
  visible,
  onClose,
  product,
  onSelectVariant,
}: QuickSizeModalProps) {
  const insets = useSafeAreaInsets();
  if (!product) return null;

  const variants = (product.variants ?? []).filter((v) => v.is_active && v.size);
  const primaryImage = product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Product Header */}
          <View style={styles.header}>
            <View style={styles.imageWrap}>
              {primaryImage ? (
                <Image source={{ uri: primaryImage }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              {product.brand && (
                <Label style={styles.brandName}>{product.brand.name}</Label>
              )}
              <Display size="sm" numberOfLines={1} style={styles.title}>
                {product.name}
              </Display>
              <Price size="sm" style={styles.price}>
                {formatPrice(product.price, product.currency)}
              </Price>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Size Picker */}
          <View style={styles.content}>
            <View style={styles.labelRow}>
              <Label style={styles.sectionLabel}>SELECT SIZE</Label>
              <Body size="xs" muted>Quick Add to Basket</Body>
            </View>

            <View style={styles.sizeGrid}>
              {variants.map((v) => {
                const stock = getVariantAvailableStock(v, v.stock ?? 0);
                const isSoldOut = stock <= 0;
                const isLow = !isSoldOut && stock <= 3;

                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.sizeChip, isSoldOut && styles.sizeChipDisabled]}
                    disabled={isSoldOut}
                    onPress={() => {
                      onSelectVariant(v);
                      onClose();
                    }}
                    activeOpacity={0.75}
                  >
                    <Body
                      size="sm"
                      style={[styles.sizeText, isSoldOut && styles.sizeTextDisabled]}
                    >
                      {v.size}
                    </Body>
                    {isLow && <View style={styles.lowDot} />}
                    {isSoldOut && <View style={styles.strikeLine} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(22, 23, 15, 0.55)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    borderWidth: 1,
    borderColor: `${colors.light.primary}18`,
    ...shadows.editorial,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginTop: spacing[2.5],
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[3.5],
  },
  imageWrap: {
    width: 52,
    height: 64,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.light.muted,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    color: colors.olive[600],
    fontSize: 9.5,
    letterSpacing: 1.5,
  },
  title: {
    color: colors.light.foreground,
  },
  price: {
    color: colors.olive[600],
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${colors.light.primary}08`,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: `${colors.light.primary}10`,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    gap: spacing[3],
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.light.foreground,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2.5],
  },
  sizeChip: {
    position: "relative",
    minWidth: 54,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
  },
  sizeChipDisabled: {
    opacity: 0.4,
    backgroundColor: "transparent",
  },
  sizeText: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
    fontSize: 13,
  },
  sizeTextDisabled: {
    color: colors.light.mutedForeground,
  },
  lowDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2.rust,
  },
  strikeLine: {
    position: "absolute",
    width: "70%",
    height: 1,
    backgroundColor: colors.light.mutedForeground,
  },
});
