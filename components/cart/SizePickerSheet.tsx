import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { useTheme } from "@/lib/hooks/useTheme";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import {
  buildAvailableSizeOptions,
  type AvailableSizeOption,
} from "@/components/cart/variant-utils";

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

  const handleDone = () => {
    if (!pendingOption) return;
    onConfirm(pendingOption.variantId, pendingOption.variantLabel);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={[
          styles.backdrop,
          { backgroundColor: theme.isDark ? "rgba(0,0,0,0.65)" : "rgba(22, 23, 15, 0.42)" },
        ]}
        onPress={onClose}
      />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            paddingBottom: Math.max(insets.bottom, spacing[5]),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Display size="xl" style={{ color: theme.colors.foreground }}>
              Select Size
            </Display>
            {sizeOptions.length > 0 ? (
              <Label style={{ color: theme.colors.primary, marginTop: 4 }}>
                {sizeOptions.length} size{sizeOptions.length === 1 ? "" : "s"} available
              </Label>
            ) : (
              <Label style={{ color: theme.colors.destructive, marginTop: 4 }}>
                No sizes in stock
              </Label>
            )}
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={[styles.closeBtn, { backgroundColor: theme.colors.secondary }]}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={theme.colors.foreground} />
          </TouchableOpacity>
        </View>

        {sizeOptions.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sizeRow}
          >
            {sizeOptions.map((option) => (
              <SizeChip
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
                backgroundColor: `${theme.colors.destructive}14`,
                borderColor: `${theme.colors.destructive}30`,
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={theme.colors.destructive} />
            <Body size="sm" style={{ color: theme.colors.destructive, flex: 1 }}>
              All sizes are currently out of stock.
            </Body>
          </View>
        )}

        {pendingOption && (
          <View style={[styles.productInfo, { borderTopColor: theme.colors.border }]}>
            <View style={styles.priceRow}>
              <Price size="lg" style={{ color: theme.colors.foreground }}>
                {formatPrice(price)}
              </Price>
              {hasDiscount && (
                <>
                  <Body style={[styles.mrp, { color: theme.colors.mutedForeground }]}>
                    {formatPrice(mrp)}
                  </Body>
                  <Body
                    style={[
                      styles.discount,
                      { color: theme.isDark ? theme.olive[400] : theme.olive[600] },
                    ]}
                  >
                    {discount}% Off
                  </Body>
                </>
              )}
            </View>
            {sellerName ? (
              <Body size="sm" muted style={styles.seller}>
                Seller: {sellerName}
              </Body>
            ) : null}
          </View>
        )}

        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Button
            variant="brand"
            size="lg"
            onPress={handleDone}
            disabled={!canConfirm}
            style={styles.doneBtn}
          >
            Done
          </Button>
        </View>
      </View>
    </Modal>
  );
}

function SizeChip({
  option,
  selected,
  onPress,
}: {
  option: AvailableSizeOption;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.sizeCircle,
        {
          borderColor: selected ? theme.colors.foreground : theme.colors.border,
          backgroundColor: selected ? theme.colors.foreground : theme.colors.background,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Size ${option.size}`}
    >
      <Body
        style={[
          styles.sizeText,
          {
            color: selected ? theme.colors.primaryForeground : theme.colors.foreground,
          },
        ]}
      >
        {option.size}
      </Body>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing[3],
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeRow: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
  },
  sizeCircle: {
    minWidth: 54,
    height: 54,
    paddingHorizontal: spacing[2],
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
  },
  emptyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginHorizontal: spacing[5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  productInfo: {
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    gap: spacing[2],
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  mrp: {
    textDecorationLine: "line-through",
    fontSize: 14,
  },
  discount: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
  },
  seller: {
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    marginTop: spacing[4],
    borderTopWidth: 1,
  },
  doneBtn: {
    width: "100%",
    borderRadius: radii.full,
  },
});
