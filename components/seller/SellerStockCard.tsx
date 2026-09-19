import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { QtyStepper } from "@/components/ui";
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

export function SellerStockCard(props: Props) {
  const { row, selectMode, selected, saving } = props;
  const status = sellerStatus(row.available);
  const meta = toneMeta(status);
  const variantLabel = [row.size, row.color].filter(Boolean).join(" · ") || "Standard variant";
  const canEdit = row.onHand != null || row.available != null;

  return (
    <View style={[styles.card, props.last && styles.cardLast, selected && styles.cardSelected]}>
      <TouchableOpacity
        style={styles.infoRow}
        onPress={selectMode ? props.onToggleSelect : props.onOpenProduct}
        onLongPress={props.onLongPress}
        delayLongPress={350}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={`${row.sku}, ${meta.label}`}
      >
        {selectMode ? (
          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={23}
            color={selected ? colors.olive[700] : colors.light.mutedForeground}
          />
        ) : (
          <View style={[styles.statusMark, { backgroundColor: meta.color }]} />
        )}
        <View style={styles.variantInfo}>
          <View style={styles.variantTopRow}>
            <Text style={styles.sku} numberOfLines={1}>{row.sku}</Text>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <View style={styles.variantMetaRow}>
            <Text style={styles.variantMeta} numberOfLines={1}>{variantLabel}</Text>
            <Text style={styles.price}>{row.price != null ? formatPrice(row.price, row.currency) : "—"}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} />
      </TouchableOpacity>

      {!selectMode ? (
        <View style={styles.stockRow}>
          <View style={styles.stockNumbers}>
            <View>
              <Text style={styles.stockLabel}>ON HAND</Text>
              <Text style={styles.stockValue}>{row.onHand ?? "—"}</Text>
            </View>
            <View style={styles.stockDivider} />
            <View>
              <Text style={styles.stockLabel}>AVAILABLE</Text>
              <Text style={[styles.stockValue, { color: meta.color }]}>{row.available ?? "—"}</Text>
            </View>
            {row.reserved > 0 ? (
              <View style={styles.heldPill}>
                <Text style={styles.heldText}>{row.reserved} held</Text>
              </View>
            ) : null}
          </View>

          {canEdit ? (
            <View style={styles.controls}>
              {saving ? (
                <View style={styles.savingWrap}>
                  <ActivityIndicator size="small" color={meta.color} />
                </View>
              ) : (
                <QtyStepper value={row.onHand ?? 0} min={0} max={9999} size="sm" onChange={props.onStep} />
              )}
              <TouchableOpacity
                style={styles.editButton}
                onPress={props.onEdit}
                disabled={saving}
                accessibilityLabel="Set exact stock"
              >
                <Ionicons name="create-outline" size={15} color={SELLER_INK} />
              </TouchableOpacity>
              {status === "out" ? (
                <TouchableOpacity
                  style={styles.restockButton}
                  onPress={props.onQuickRestock}
                  disabled={saving}
                  accessibilityLabel="Quick restock"
                >
                  <Text style={styles.restockText}>+10</Text>
                </TouchableOpacity>
              ) : null}
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
    paddingVertical: 13,
  },
  cardLast: { borderBottomWidth: 0 },
  cardSelected: { backgroundColor: colors.olive[50] },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusMark: { width: 7, height: 7, borderRadius: 4 },
  variantInfo: { flex: 1, minWidth: 0, gap: 5 },
  variantTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sku: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  badge: { borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 0.7, textTransform: "uppercase" },
  variantMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  variantMeta: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "capitalize" },
  price: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.ink.mute },
  stockRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  stockNumbers: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  stockLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 7, letterSpacing: 0.8, color: colors.ink.mute },
  stockValue: { marginTop: 1, fontFamily: fontFamilies.display.semibold, fontSize: 17, lineHeight: 20, color: SELLER_INK, fontVariant: ["tabular-nums"] },
  stockDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: "rgba(83,94,44,0.16)" },
  heldPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: radii.full, backgroundColor: "rgba(200,164,74,0.14)" },
  heldText: { fontFamily: fontFamilies.sans.semibold, fontSize: 9, color: "#8a6a2a" },
  controls: { flexDirection: "row", alignItems: "center", gap: 7 },
  savingWrap: { minWidth: 104, height: 36, alignItems: "center", justifyContent: "center" },
  editButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(83,94,44,0.18)", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  restockButton: { minWidth: 42, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(184,92,58,0.1)" },
  restockText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: SELLER_RUST },
  unknownQty: { fontFamily: fontFamilies.sans.medium, fontSize: 10, color: colors.ink.mute },
});
