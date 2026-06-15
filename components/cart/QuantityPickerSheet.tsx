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
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { useTheme } from "@/lib/hooks/useTheme";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii } from "@/lib/theme/tokens";

interface QuantityPickerSheetProps {
  visible: boolean;
  currentQuantity: number;
  stock: number;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

export function QuantityPickerSheet({
  visible,
  currentQuantity,
  stock,
  onClose,
  onConfirm,
}: QuantityPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [pendingQty, setPendingQty] = useState(currentQuantity);

  useEffect(() => {
    if (visible) {
      setPendingQty(currentQuantity);
    }
  }, [visible, currentQuantity]);

  const quantities = useMemo(() => {
    const max = Math.min(20, Math.max(10, stock, currentQuantity));
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [stock, currentQuantity]);

  const overStock = stock > 0 && pendingQty > stock;
  const outOfStock = stock <= 0;
  const canConfirm = !outOfStock && !overStock && pendingQty >= 1;
  const lowStock = stock > 0 && stock <= 5;

  const handleDone = () => {
    if (!canConfirm) return;
    onConfirm(pendingQty);
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
              Select Quantity
            </Display>
            {stock > 0 ? (
              <Label style={{ color: theme.colors.primary, marginTop: 4 }}>
                {stock} in stock
              </Label>
            ) : (
              <Label style={{ color: theme.colors.destructive, marginTop: 4 }}>
                Out of stock
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.qtyRow}
        >
          {quantities.map((qty) => {
            const selected = pendingQty === qty;
            const unavailable = stock > 0 && qty > stock;
            return (
              <TouchableOpacity
                key={qty}
                onPress={() => setPendingQty(qty)}
                activeOpacity={0.8}
                style={[
                  styles.qtyCircle,
                  {
                    borderColor: selected ? theme.colors.foreground : theme.colors.border,
                    backgroundColor: selected ? theme.colors.foreground : theme.colors.background,
                  },
                  unavailable && !selected && styles.qtyCircleUnavailable,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Body
                  style={[
                    styles.qtyText,
                    {
                      color: selected
                        ? theme.colors.primaryForeground
                        : unavailable
                          ? theme.colors.mutedForeground
                          : theme.colors.foreground,
                    },
                  ]}
                >
                  {qty}
                </Body>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {(outOfStock || overStock || lowStock) && (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: overStock || outOfStock
                  ? `${theme.colors.destructive}14`
                  : `${theme.colors.primary}12`,
                borderColor: overStock || outOfStock
                  ? `${theme.colors.destructive}30`
                  : `${theme.colors.primary}25`,
              },
            ]}
          >
            <Ionicons
              name={overStock || outOfStock ? "alert-circle-outline" : "cube-outline"}
              size={16}
              color={overStock || outOfStock ? theme.colors.destructive : theme.colors.primary}
            />
            <Body
              size="sm"
              style={{
                color: overStock || outOfStock
                  ? theme.colors.destructive
                  : theme.colors.mutedForeground,
                flex: 1,
              }}
            >
              {outOfStock
                ? "This item is currently unavailable."
                : overStock
                  ? `Only ${stock} ${stock === 1 ? "item" : "items"} left — choose a lower quantity.`
                  : `Selling fast — only ${stock} left.`}
            </Body>
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
  qtyRow: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
  },
  qtyCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyCircleUnavailable: {
    opacity: 0.45,
  },
  qtyText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
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
