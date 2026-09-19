import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface SellerBentoItem {
  key: string;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number | null;
  tone?: "default" | "warn" | "critical";
  onPress: () => void;
}

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
          accessibilityLabel={item.badge != null && item.badge > 0 ? `${item.label}, ${item.badge} pending` : item.label}
        >
          <View style={styles.iconBadge}>
            <Ionicons name={item.icon} size={18} color={colors.olive[900]} />
            {item.badge != null && item.badge > 0 ? (
              <View
                style={[
                  styles.badge,
                  item.tone === "critical" && styles.badgeCritical,
                  item.tone === "warn" && styles.badgeWarn,
                ]}
              >
                <Text style={styles.badgeText}>{item.badge > 99 ? "99+" : String(item.badge)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.copy}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.hint}>{item.hint}</Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="chevron-forward" size={13} color={colors.ink.mute} />
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
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...shadows.soft,
  },
  iconBadge: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[950] },
  hint: { fontFamily: fontFamilies.sans.regular, fontSize: 9, color: colors.ink.mute },
  arrow: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper.warm, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.olive[800], alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#FFFFFF" },
  badgeCritical: { backgroundColor: colors.accent2.rust },
  badgeWarn: { backgroundColor: colors.accent2.ochre },
  badgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, color: "#FFFFFF" },
});
