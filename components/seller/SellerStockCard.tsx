import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { QtyStepper, ProgressBar } from "@/components/ui";
import { SELLER_RUST, SELLER_INK, SELLER_CREAM } from "./chrome";
import type { SellerInventoryRow } from "@/lib/seller-inventory";
import { sellerStatus, sellerBarPct } from "@/lib/seller-inventory";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

interface Props {
  row: SellerInventoryRow;
  selectMode: boolean;
  selected: boolean;
  saving: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
  onOpenProduct: () => void;
  onStep: (nextOnHand: number) => void;
  onEdit: () => void;
  onQuickRestock: () => void;
}

export function toneMeta(status: ReturnType<typeof sellerStatus>) {
  if (status === "out") return { label: "Out", color: SELLER_RUST, bg: "rgba(184,92,58,0.12)" };
  if (status === "low") return { label: "Low", color: "#8a6a2a", bg: "rgba(200,164,74,0.18)" };
  if (status === "ok") return { label: "In stock", color: colors.olive[800], bg: "rgba(83,94,44,0.1)" };
  return { label: "—", color: colors.ink.mute, bg: colors.olive[50] };
}

export function SellerStockCard(props: Props) {
  const { row, selectMode, selected, saving } = props;
  const status = sellerStatus(row.available);
  const meta = toneMeta(status);
  const variantLabel = [row.size, row.color].filter(Boolean).join(" · ");
  const badge = status === "unknown" ? "—" : status === "out" ? `OUT • ${row.available}` : status === "low" ? `LOW • ${row.available}` : `IN STOCK • ${row.available}`;
  const canEdit = row.onHand != null || row.available != null;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={[styles.toneBar, { backgroundColor: meta.color }]} />
      <View style={styles.cardRow}>
        {selectMode && (
          <TouchableOpacity style={styles.checkbox} onPress={props.onToggleSelect} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
            <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.olive[700] : colors.light.mutedForeground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cardMain} onPress={selectMode ? props.onToggleSelect : props.onOpenProduct} onLongPress={props.onLongPress} delayLongPress={350} activeOpacity={0.75}>
          {row.image ? (
            <Image source={{ uri: row.image }} style={styles.thumb} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="image-outline" size={16} color={colors.light.mutedForeground} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                <Text style={[styles.badgeText, { color: meta.color }]}>{badge}</Text>
              </View>
              {row.reserved > 0 ? <Text style={styles.held}>{row.reserved} held</Text> : null}
            </View>
            <Text style={styles.cardSku} numberOfLines={1}>{row.sku}</Text>
            {variantLabel ? <Text style={styles.cardMeta}>{variantLabel}</Text> : null}
            <Text style={styles.cardPrice}>{row.price != null ? formatPrice(row.price, row.currency) : "—"}</Text>
          </View>
        </TouchableOpacity>
        {!selectMode && canEdit && (
          <View style={styles.stockPanel}>
            <ProgressBar value={sellerBarPct(row.available)} fillColor={meta.color} style={styles.bar} />
            {saving ? (
              <ActivityIndicator size="small" color={meta.color} />
            ) : (
              <QtyStepper value={row.onHand ?? 0} min={0} max={9999} size="sm" onChange={props.onStep} />
            )}
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={props.onEdit} disabled={saving} accessibilityLabel="Edit stock">
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              {status === "out" ? (
                <TouchableOpacity onPress={props.onQuickRestock} disabled={saving} accessibilityLabel="Quick restock to 10">
                  <Text style={styles.restockText}>+10</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
        {!selectMode && !canEdit && <Text style={styles.unknownQty}>—</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: SELLER_CREAM, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(83,94,44,0.12)", overflow: "hidden", marginBottom: 8 },
  cardSelected: { borderColor: colors.olive[700], borderWidth: 2 },
  toneBar: { height: 4 },
  cardRow: { flexDirection: "row", padding: 12, gap: 10 },
  checkbox: { justifyContent: "center" },
  cardMain: { flex: 1, flexDirection: "row", gap: 10, minWidth: 0 },
  thumb: { width: 56, height: 72, borderRadius: radii.md },
  thumbEmpty: { backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, minWidth: 0, gap: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  badgeText: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, letterSpacing: typography.letterSpacing.wide, textTransform: "uppercase" },
  held: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  cardSku: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  cardMeta: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  cardPrice: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  stockPanel: { justifyContent: "center", gap: 6, minWidth: 118 },
  bar: { marginBottom: 2 },
  cardActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  editText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: SELLER_INK },
  restockText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: SELLER_RUST },
  unknownQty: { alignSelf: "center", fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.lg, color: colors.ink.mute },
});
