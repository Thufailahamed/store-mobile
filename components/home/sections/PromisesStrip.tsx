import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, spacing } from "@/lib/theme/tokens";
import type { HomepagePromise } from "@/lib/types";

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi"];

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  Truck: "car-outline",
  RotateCcw: "refresh-outline",
  ShieldCheck: "shield-checkmark-outline",
  Leaf: "leaf-outline",
  Sparkles: "sparkles-outline",
  Package: "cube-outline",
  Heart: "heart-outline",
  Globe: "globe-outline",
};

const DEFAULT_ITEMS: HomepagePromise[] = [
  { n: "i", title: "Shipped slow, shipped right", description: "Carbon-conscious carriers. Free over LKR 15,000.", icon: "Truck" },
  { n: "ii", title: "Thirty days to change your mind", description: "Returns are part of the design, not a bug.", icon: "RotateCcw" },
  { n: "iii", title: "Paid for in full, encrypted end-to-end", description: "We never store your card. Stripe, Apple, Google.", icon: "ShieldCheck" },
  { n: "iv", title: "Sourced from people we've met", description: "Every atelier is named, located, and verified.", icon: "Leaf" },
];

interface PromisesStripProps {
  items?: HomepagePromise[];
  kicker?: string;
  subtitle?: string;
}

export function PromisesStrip({
  items = DEFAULT_ITEMS,
  kicker = "House rules · 12",
  subtitle = "No fine print",
}: PromisesStripProps) {
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Label style={styles.kickerText}>{kicker}</Label>
          <View style={styles.headerRule} />
          {subtitle ? <Label style={styles.subtitleText}>{subtitle}</Label> : null}
        </View>
        <View style={styles.list}>
          {items.map((p, i) => {
            const iconName = ICON_MAP[p.icon ?? "ShieldCheck"] ?? "shield-checkmark-outline";
            return (
              <View key={`${p.n}-${i}`} style={styles.item}>
                <Display italic size="lg" style={styles.itemNum}>
                  {p.n ?? ROMAN[i]}.
                </Display>
                <View style={styles.itemBody}>
                  <View style={styles.itemIcon}>
                    <Ionicons name={iconName} size={18} color={colors.light.primary} />
                  </View>
                  <View style={styles.itemCopy}>
                    <Display size="md" style={styles.itemTitle}>
                      {p.title}
                    </Display>
                    <Body size="xs" style={styles.itemDesc}>
                      {p.description}
                    </Body>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.olive[50], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.light.border },
  inner: { paddingHorizontal: 20, paddingVertical: spacing[10], gap: spacing[6] },
  header: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  kickerText: { color: colors.light.primary },
  headerRule: { flex: 1, height: 1, backgroundColor: colors.light.border },
  subtitleText: { color: colors.light.mutedForeground },
  list: { gap: 0 },
  item: { paddingTop: spacing[5], paddingBottom: spacing[5], borderTopWidth: 1, borderTopColor: colors.light.border, gap: spacing[3] },
  itemNum: { color: colors.light.primary, fontSize: 22 },
  itemBody: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3] },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.olive[100], alignItems: "center", justifyContent: "center" },
  itemCopy: { flex: 1, gap: 4 },
  itemTitle: { color: colors.light.foreground, fontSize: 18, lineHeight: 22 },
  itemDesc: { color: colors.light.mutedForeground, lineHeight: 18 },
});
