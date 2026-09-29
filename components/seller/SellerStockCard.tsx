import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { SELLER_CREAM, SELLER_INK, SELLER_RUST } from "./chrome";
import type { SellerInventoryRow } from "@/lib/seller-inventory";
import { sellerStatus } from "@/lib/seller-inventory";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

interface Props {
  row: SellerInventoryRow;
  selectMode: boolean;
  selected: boolean;
  saving: boolean;
  last?: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
  onOpenProduct: () => void;
  onStep: (nextOnHand: number) => void;
  onEdit: () => void;
  onQuickRestock: () => void;
}

export function toneMeta(status: ReturnType<typeof sellerStatus>) {
  if (status === "out") return { label: "Out of stock", color: SELLER_RUST, bg: "rgba(184,92,58,0.1)" };
  if (status === "low") return { label: "Low stock", color: "#8a6a2a", bg: "rgba(200,164,74,0.16)" };
  if (status === "ok") return { label: "Healthy", color: colors.olive[800], bg: "rgba(83,94,44,0.1)" };
  return { label: "Unknown", color: colors.ink.mute, bg: colors.olive[50] };
}

const MAX_STOCK = 9999;

export function SellerStockCard(props: Props) {
  const { row, selectMode, selected, saving } = props;
  const status = sellerStatus(row.available);
  const meta = toneMeta(status);
  const variantLabel = [row.size, row.color].filter(Boolean).join(" · ") || "Standard";
  const canEdit = row.onHand != null || row.available != null;
  const onHand = row.onHand ?? 0;

  return (
    <View style={[styles.card, props.last && styles.cardLast, selected && styles.cardSelected]}>
      <TouchableOpacity
        style={styles.infoRow}
        onPress={selectMode ? props.onToggleSelect : props.onOpenProduct}
        onLongPress={props.onLongPress}
        delayLongPress={350}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={`${variantLabel}, ${row.sku}, ${meta.label}, ${row.available ?? "unknown"} available`}
      >
        {selectMode ? (
          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={22}
            color={selected ? colors.olive[700] : colors.light.mutedForeground}
          />
        ) : (
          <View style={[styles.statusMark, { backgroundColor: meta.color }]} />
        )}
        <View style={styles.variantInfo}>
          <Text style={styles.variantLabel} numberOfLines={1}>{variantLabel}</Text>
          <Text style={styles.sku} numberOfLines={1}>{row.sku}</Text>
        </View>
        <Text style={styles.price}>{row.price != null ? formatPrice(row.price, row.currency) : "—"}</Text>
      </TouchableOpacity>

      {!selectMode ? (
        <View style={styles.stockRow}>
          <View style={styles.stockNumbers}>
            <Text style={[styles.availValue, { color: meta.color }]}>{row.available ?? "—"}</Text>
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <Text style={[styles.availLabel, { color: meta.color }]} numberOfLines={1}>
                {status === "out" ? "Sold out" : status === "low" ? "Running low" : "Available"}
              </Text>
              <Text style={styles.subStat} numberOfLines={1}>
                {row.onHand ?? "—"} on hand{row.reserved > 0 ? ` · ${row.reserved} held` : ""}
              </Text>
            </View>
          </View>

          {canEdit ? (
            <View style={styles.controls}>
              {status === "out" && !saving ? (
                <TouchableOpacity
                  style={styles.restockButton}
                  onPress={props.onQuickRestock}
                  accessibilityLabel="Quick restock"
                >
                  <Ionicons name="add" size={12} color={SELLER_CREAM} />
                  <Text style={styles.restockText}>Restock</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.stepper}>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed, (saving || onHand <= 0) && styles.stepBtnDisabled]}
                  onPress={() => props.onStep(onHand - 1)}
                  disabled={saving || onHand <= 0}
                  hitSlop={6}
                  accessibilityLabel="Decrease on-hand"
                >
                  <Ionicons name="remove" size={14} color={SELLER_INK} />
                </Pressable>
                <Pressable
                  style={styles.stepValue}
                  onPress={props.onEdit}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`On-hand ${onHand}. Tap to set exact stock`}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={meta.color} />
                  ) : (
                    <Text style={styles.stepValueText}>{onHand}</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed, (saving || onHand >= MAX_STOCK) && styles.stepBtnDisabled]}
                  onPress={() => props.onStep(onHand + 1)}
                  disabled={saving || onHand >= MAX_STOCK}
                  hitSlop={6}
                  accessibilityLabel="Increase on-hand"
                >
                  <Ionicons name="add" size={14} color={SELLER_INK} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.unknownQty}>Stock unavailable</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SELLER_CREAM,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardLast: { borderBottomWidth: 0 },
  cardSelected: { backgroundColor: colors.olive[50] },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusMark: { width: 8, height: 8, borderRadius: 4 },
  variantInfo: { flex: 1, minWidth: 0, gap: 2 },
  variantLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground, textTransform: "capitalize" },
  sku: { fontFamily: fontFamilies.mono.regular, fontSize: 10, letterSpacing: 0.3, color: colors.ink.mute },
  price: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.ink.soft, fontVariant: ["tabular-nums"] },
  stockRow: { marginTop: 10, marginLeft: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  stockNumbers: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  availValue: { fontFamily: fontFamilies.display.semibold, fontSize: 24, lineHeight: 28, minWidth: 18, fontVariant: ["tabular-nums"] },
  availLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 11 },
  subStat: { marginTop: 1, fontFamily: fontFamilies.sans.regular, fontSize: 10, color: colors.ink.mute },
  controls: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 3,
  },
  stepBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepBtnPressed: { backgroundColor: colors.olive[50] },
  stepBtnDisabled: { opacity: 0.3 },
  stepValue: { minWidth: 34, height: 30, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  stepValueText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: SELLER_INK,
    fontVariant: ["tabular-nums"],
  },
  restockButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: radii.full,
    backgroundColor: SELLER_RUST,
  },
  restockText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: SELLER_CREAM },
  unknownQty: { fontFamily: fontFamilies.sans.medium, fontSize: 10, color: colors.ink.mute },
});
