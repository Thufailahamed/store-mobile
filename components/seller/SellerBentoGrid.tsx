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
              <Ionicons name={item.icon} size={18} color="#141311" />
              {item.badge != null && item.badge > 0 ? (
                <View
                  style={[
                    styles.badge,
                    item.tone === "critical" && { backgroundColor: "#B85C3A" },
                    item.tone === "warn" && { backgroundColor: "#C8A44A" },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {item.badge > 99 ? "99+" : String(item.badge)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={13} color="#A49E93" />
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
    minHeight: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
    gap: 12,
    ...shadows.soft,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F7F5EE",
    borderWidth: 1,
    borderColor: "#ECE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#C8A44A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, color: "#141311" },
  label: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "#141311" },
  hint: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.2, color: "#8E8B82", marginTop: 2 },
});
