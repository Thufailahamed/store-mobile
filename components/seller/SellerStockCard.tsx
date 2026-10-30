import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { SELLER_CREAM, SELLER_INK, SELLER_RUST } from "./chrome";
import type { SellerInventoryRow } from "@/lib/seller-inventory";
import { sellerStatus } from "@/lib/seller-inventory";
import { colors, radii } from "@/lib/theme/tokens";
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

const SWATCH: Record<string, string> = {
  black: "#1c1c1a", white: "#f7f6f2", ivory: "#f4efe2", cream: "#f1e9d6", beige: "#d9c7a6", tan: "#c4a276",
  brown: "#7a5134", camel: "#b98a52", grey: "#9a9a96", gray: "#9a9a96", charcoal: "#45463f", silver: "#c6c7c4",
  red: "#c0392b", maroon: "#6e1f24", burgundy: "#6b2033", pink: "#f0a8b8", rose: "#d98a96", blush: "#efc6c2",
  orange: "#e58a3a", yellow: "#e9c84a", mustard: "#c9a12f", gold: "#c8a44a", green: "#4f7a4a", olive: "#6a7639",
  sage: "#a3b18a", mint: "#a8dcc4", teal: "#2f7f7a", blue: "#3b6fb6", navy: "#1f2d4d", sky: "#9cc7ea",
  purple: "#6d4a9b", lilac: "#c6b2dc", lavender: "#b9a8d8", khaki: "#b6a774", denim: "#4f6d8f",
};

function swatchColor(name?: string): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (SWATCH[key]) return SWATCH[key];
  const word = key.split(/[\s/-]+/).find((w) => SWATCH[w]);
  return word ? SWATCH[word] : null;
}

export function SellerStockCard(props: Props) {
  const { row, selectMode, selected, saving } = props;
  const status = sellerStatus(row.available);
  const meta = toneMeta(status);
  const variantLabel = [row.size, row.color].filter(Boolean).join(" · ") || "Standard";
  const canEdit = row.onHand != null || row.available != null;
  const onHand = row.onHand ?? 0;
  const swatch = swatchColor(row.color);
  // Long sizes ("Medium 27mm", "100ml") don't fit the badge — move them to the label.
  const shortSize = row.size && row.size.trim().length <= 5 ? row.size.trim() : null;
  const label = shortSize ? row.color || variantLabel : variantLabel;

  return (
    <View style={[styles.card, props.last && styles.cardLast, selected && styles.cardSelected]}>
      <View style={[styles.statusRail, { backgroundColor: meta.color }]} />
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
          <View style={[styles.checkbox, selected && styles.checkboxOn]}>
            {selected ? <Ionicons name="checkmark" size={14} color={SELLER_CREAM} /> : null}
          </View>
        ) : null}
        <View style={styles.sizeBadge}>
          {shortSize ? (
            <Text style={styles.sizeText} numberOfLines={1} adjustsFontSizeToFit>
              {shortSize.toUpperCase()}
            </Text>
          ) : (
            <Ionicons name="pricetag-outline" size={16} color={colors.olive[700]} />
          )}
          {swatch ? (
            <View style={[styles.swatch, { backgroundColor: swatch }]} />
          ) : null}
        </View>
        <View style={styles.variantInfo}>
          <Text style={styles.variantLabel} numberOfLines={2}>{label}</Text>
          <Text style={styles.sku} numberOfLines={1}>{row.sku}</Text>
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.price}>{row.price != null ? formatPrice(row.price, row.currency) : "—"}</Text>
          <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {!selectMode ? (
        <View style={styles.stockRow}>
          <View style={styles.stockNumbers}>
            <View style={[styles.availTile, { backgroundColor: meta.bg }]}>
              <Text style={[styles.availValue, { color: meta.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {row.available ?? "—"}
              </Text>
            </View>
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <Text style={styles.availLabel} numberOfLines={1}>
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
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={12} color={SELLER_CREAM} />
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
                  <Ionicons name="remove" size={15} color={SELLER_INK} />
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
                  style={({ pressed }) => [styles.stepBtn, styles.stepBtnPlus, pressed && { opacity: 0.8 }, (saving || onHand >= MAX_STOCK) && styles.stepBtnDisabled]}
                  onPress={() => props.onStep(onHand + 1)}
                  disabled={saving || onHand >= MAX_STOCK}
                  hitSlop={6}
                  accessibilityLabel="Increase on-hand"
                >
                  <Ionicons name="add" size={15} color={SELLER_CREAM} />
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
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.12)",
    paddingLeft: 18,
    paddingRight: 14,
    paddingVertical: 14,
  },
  cardLast: { borderBottomWidth: 0 },
  cardSelected: { backgroundColor: colors.olive[50] },
  statusRail: { position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: "rgba(83,94,44,0.35)", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.olive[800], borderColor: colors.olive[800] },
  sizeBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  sizeText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: SELLER_INK },
  swatch: { position: "absolute", right: -3, bottom: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#FFFFFF" },
  variantInfo: { flex: 1, minWidth: 0, gap: 3 },
  variantLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: colors.light.foreground, textTransform: "capitalize" },
  sku: { fontFamily: fontFamilies.mono.regular, fontSize: 10, letterSpacing: 0.3, color: colors.ink.mute },
  priceWrap: { alignItems: "flex-end", gap: 5 },
  price: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.ink.soft, fontVariant: ["tabular-nums"] },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.full },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusChipText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase" },
  stockRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 8,
    borderRadius: 16,
    backgroundColor: colors.paper.DEFAULT,
  },
  stockNumbers: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  availTile: { minWidth: 40, height: 40, paddingHorizontal: 6, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  availValue: { fontFamily: fontFamilies.display.semibold, fontSize: 20, fontVariant: ["tabular-nums"] },
  availLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: SELLER_INK },
  subStat: { marginTop: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  controls: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 3,
    gap: 2,
  },
  stepBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepBtnPlus: { backgroundColor: colors.olive[900] },
  stepBtnPressed: { backgroundColor: colors.olive[50] },
  stepBtnDisabled: { opacity: 0.3 },
  stepValue: { minWidth: 34, height: 30, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  stepValueText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: SELLER_INK,
    fontVariant: ["tabular-nums"],
  },
  restockButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: SELLER_RUST,
  },
  restockText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: SELLER_CREAM },
  unknownQty: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: colors.ink.mute },
});
