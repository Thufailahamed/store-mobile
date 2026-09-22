import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Text,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useTheme } from "@/lib/hooks/useTheme";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import {
  buildAvailableSizeOptions,
  type AvailableSizeOption,
} from "@/components/cart/variant-utils";

const LOW_STOCK = 5;

interface SizePickerSheetProps {
  visible: boolean;
  product?: Product;
  currentVariantId: string | null;
  sellerName?: string;
  onClose: () => void;
  onConfirm: (variantId: string, variantLabel: string) => void;
}

export function SizePickerSheet({
  visible,
  product,
  currentVariantId,
  sellerName,
  onClose,
  onConfirm,
}: SizePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [pendingVariantId, setPendingVariantId] = useState<string | null>(currentVariantId);

  const sizeOptions = useMemo(
    () => buildAvailableSizeOptions(product?.variants, currentVariantId),
    [product?.variants, currentVariantId]
  );

  useEffect(() => {
    if (visible) {
      const currentInList = sizeOptions.some((o) => o.variantId === currentVariantId);
      setPendingVariantId(
        currentInList && currentVariantId
          ? currentVariantId
          : sizeOptions[0]?.variantId ?? null
      );
    }
  }, [visible, currentVariantId, sizeOptions]);

  const pendingOption = useMemo(
    () => sizeOptions.find((o) => o.variantId === pendingVariantId) ?? null,
    [sizeOptions, pendingVariantId]
  );

  const mrp = pendingOption?.mrp ?? product?.mrp;
  const price = pendingOption?.price ?? product?.price ?? 0;
  const hasDiscount = mrp != null && mrp > price;
  const discount = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const canConfirm = !!pendingOption;

  const productImage =
    product?.images?.find((i) => i.is_primary)?.url || product?.images?.[0]?.url;
  const pendingVariant = product?.variants?.find((v) => v.id === pendingVariantId);
  const colorLabel = pendingVariant?.color ?? null;
  const pendingLowStock =
    pendingOption != null && pendingOption.stock > 0 && pendingOption.stock <= LOW_STOCK;

  const handleDone = () => {
    if (!pendingOption) return;
    onConfirm(pendingOption.variantId, pendingOption.variantLabel);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={[
            styles.backdrop,
            { backgroundColor: theme.isDark ? "rgba(0,0,0,0.72)" : "rgba(18, 19, 13, 0.48)" },
          ]}
          onPress={onClose}
          accessibilityLabel="Dismiss sheet"
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, spacing[4]),
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Product Header Card */}
          <View style={styles.header}>
            <View style={[styles.thumbWrap, { borderColor: theme.colors.border }]}>
              {productImage ? (
                <Image
                  source={{ uri: productImage }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbPh, { backgroundColor: theme.colors.secondary }]}>
                  <Ionicons name="shirt-outline" size={20} color={theme.colors.mutedForeground} />
                </View>
              )}
            </View>

            <View style={styles.headerCopy}>
              <Text
                style={[styles.productTitle, { color: theme.colors.foreground }]}
                numberOfLines={2}
              >
                {product?.name ?? "Select size"}
              </Text>

              <View style={styles.metaRow}>
                {colorLabel ? (
                  <View style={[styles.metaChip, { backgroundColor: theme.colors.secondary }]}>
                    <View style={[styles.colorDot, { backgroundColor: colorLabel.toLowerCase() }]} />
                    <Text style={[styles.metaChipText, { color: theme.colors.foreground }]}>
                      {colorLabel}
                    </Text>
                  </View>
                ) : null}

                {sellerName ? (
                  <View style={[styles.metaChip, { backgroundColor: theme.colors.secondary }]}>
                    <Ionicons name="storefront-outline" size={11} color={theme.colors.mutedForeground} />
                    <Text
                      style={[styles.metaChipText, { color: theme.colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {sellerName}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                },
              ]}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={18} color={theme.colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Size Section */}
          <View style={styles.sectionBody}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabelRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
                  Select Size
                </Text>
                {sizeOptions.length > 0 ? (
                  <View style={[styles.countBadge, { backgroundColor: theme.colors.secondary }]}>
                    <Text style={[styles.countBadgeText, { color: theme.colors.mutedForeground }]}>
                      {sizeOptions.length} available
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {sizeOptions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sizeGrid}
              >
                {sizeOptions.map((option) => (
                  <SizeTile
                    key={option.variantId}
                    option={option}
                    selected={pendingVariantId === option.variantId}
                    onPress={() => setPendingVariantId(option.variantId)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View
                style={[
                  styles.emptyNotice,
                  {
                    backgroundColor: `${theme.colors.destructive}12`,
                    borderColor: `${theme.colors.destructive}28`,
                  },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={18} color={theme.colors.destructive} />
                <Text style={[styles.emptyText, { color: theme.colors.destructive }]}>
                  All sizes are currently out of stock for this item.
                </Text>
              </View>
            )}

            {/* Low stock notice */}
            {pendingLowStock ? (
              <View style={styles.stockUrgencyBanner}>
                <Ionicons name="flash" size={13} color={colors.accent2.rust} />
                <Text style={styles.stockUrgencyText}>
                  Hurry, only {pendingOption?.stock} units left in size {pendingOption?.size}!
                </Text>
              </View>
            ) : (
              <View style={styles.stockSafeRow}>
                <Ionicons name="checkmark-circle-outline" size={13} color={colors.olive[700]} />
                <Text style={styles.stockSafeText}>In stock & ready to dispatch</Text>
              </View>
            )}
          </View>

          {/* Footer Bar */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <View style={styles.footerInfoRow}>
              <View style={styles.priceBlock}>
                <Text style={styles.priceLabel}>Price</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceText, { color: theme.colors.foreground }]}>
                    {formatPrice(price)}
                  </Text>
                  {hasDiscount ? (
                    <>
                      <Text style={[styles.mrpText, { color: theme.colors.mutedForeground }]}>
                        {formatPrice(mrp)}
                      </Text>
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{discount}% OFF</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleDone}
                disabled={!canConfirm}
                activeOpacity={0.85}
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: theme.colors.primary,
                  },
                  !canConfirm && styles.confirmBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Confirm size"
              >
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={theme.colors.primaryForeground}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.confirmBtnText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  {pendingOption ? `Select Size ${pendingOption.size}` : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SizeTile({
  option,
  selected,
  onPress,
}: {
  option: AvailableSizeOption;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const low = option.stock > 0 && option.stock <= LOW_STOCK;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        styles.sizeTile,
        {
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.primary : theme.colors.card,
        },
        selected && styles.sizeTileSelected,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Size ${option.size}`}
    >
      <Text
        style={[
          styles.sizeTileText,
          {
            color: selected ? theme.colors.primaryForeground : theme.colors.foreground,
          },
        ]}
      >
        {option.size}
      </Text>

      {low ? (
        <View
          style={[
            styles.stockTag,
            {
              backgroundColor: selected
                ? "rgba(255,255,255,0.22)"
                : "rgba(184,92,58,0.1)",
            },
          ]}
        >
          <Text
            style={[
              styles.stockTagText,
              {
                color: selected ? theme.colors.primaryForeground : colors.accent2.rust,
              },
            ]}
          >
            {option.stock} left
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    ...shadows.editorial,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[5],
    paddingTop: 8,
    paddingBottom: 14,
  },
  thumbWrap: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumb: {
    width: 52,
    height: 66,
  },
  thumbPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  productTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.15)",
  },
  metaChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing[5],
  },
  sectionBody: {
    paddingTop: 14,
    paddingBottom: 12,
  },
  sectionHeader: {
    paddingHorizontal: spacing[5],
    marginBottom: 12,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  countBadgeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  sizeGrid: {
    flexDirection: "row",
    paddingHorizontal: spacing[5],
    gap: 10,
    paddingVertical: 4,
  },
  sizeTile: {
    minWidth: 64,
    height: 54,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    position: "relative",
  },
  sizeTileSelected: {
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  sizeTileText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  stockTag: {
    position: "absolute",
    bottom: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  stockTagText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8,
    letterSpacing: 0.2,
  },
  emptyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing[5],
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    flex: 1,
  },
  stockUrgencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: spacing[5],
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: "rgba(184,92,58,0.08)",
  },
  stockUrgencyText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.accent2.rust,
  },
  stockSafeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginHorizontal: spacing[5],
    marginTop: 10,
  },
  stockSafeText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.olive[700],
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: spacing[5],
  },
  footerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  priceBlock: {
    gap: 1,
  },
  priceLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.ink.mute,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  priceText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    letterSpacing: -0.3,
  },
  mrpText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: "rgba(184,92,58,0.12)",
  },
  discountText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: colors.accent2.rust,
    letterSpacing: 0.2,
  },
  confirmBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
