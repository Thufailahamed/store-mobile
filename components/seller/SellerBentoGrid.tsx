import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { SELLER_CREAM, sellerBorder } from "@/components/seller/chrome";

export interface SellerBentoItem {
  key: string;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number | null;
  tone?: "default" | "warn" | "critical";
  onPress: () => void;
}

/**
 * Dashboard-only bento quick-action grid (web `QuickActionBento` feel).
 * Do NOT reuse for the More screen — that keeps `SellerShortcutGrid`.
 */
export function SellerBentoGrid({ items }: { items: SellerBentoItem[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.tile}
          onPress={item.onPress}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={
            item.badge != null && item.badge > 0
              ? `${item.label}, ${item.badge} pending`
              : item.label
          }
        >
          <View style={styles.topRow}>
            <View style={styles.iconBadge}>
              <Ionicons name={item.icon} size={20} color={colors.olive[800]} />
              {item.badge != null && item.badge > 0 ? (
                <View
                  style={[
                    styles.badge,
                    item.tone === "critical" && { backgroundColor: colors.accent2.rust },
                    item.tone === "warn" && { backgroundColor: colors.accent2.ochre },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {item.badge > 99 ? "99+" : String(item.badge)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} />
          </View>
          <View>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.hint}>{item.hint.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "47.5%",
    flexGrow: 1,
    minHeight: 108,
    backgroundColor: SELLER_CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: sellerBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
    gap: 12,
    ...shadows.soft,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: sellerBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.olive[800],
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, color: SELLER_CREAM },
  label: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.olive[950] },
  hint: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 1.2, color: colors.ink.mute, marginTop: 2 },
});
