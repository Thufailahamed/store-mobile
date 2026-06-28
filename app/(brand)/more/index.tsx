import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { router } from "expo-router";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  tone?: "default" | "accent" | "warn";
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const MENU: MenuGroup[] = [
  {
    title: "Insights",
    items: [
      { label: "Analytics", icon: "analytics-outline", href: "/(brand)/more/analytics" },
      { label: "Payouts", icon: "wallet-outline", href: "/(brand)/more/payouts" },
      { label: "Inventory", icon: "layers-outline", href: "/(brand)/more/inventory" },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", icon: "receipt-outline", href: "/(brand)/more/orders" },
      { label: "Returns", icon: "return-down-back-outline", href: "/(brand)/more/returns" },
      { label: "Reviews", icon: "star-outline", href: "/(brand)/more/reviews" },
      { label: "Coupons", icon: "pricetag-outline", href: "/(brand)/more/coupons" },
    ],
  },
  {
    title: "Audience",
    items: [
      { label: "Followers", icon: "people-outline", href: "/(brand)/more/followers" },
      { label: "Influencers", icon: "megaphone-outline", href: "/(brand)/more/influencers" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Campaigns", icon: "rocket-outline", href: "/(brand)/more/campaigns" },
      { label: "Collections", icon: "albums-outline", href: "/(brand)/more/collections" },
      { label: "Notifications", icon: "notifications-outline", href: "/(brand)/more/notifications" },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Branding", icon: "color-palette-outline", href: "/(brand)/more/branding" },
      { label: "Team", icon: "people-circle-outline", href: "/(brand)/more/team" },
      { label: "Storefront", icon: "globe-outline", href: "/(brand)/more/storefront" },
      { label: "Shipping", icon: "car-outline", href: "/(brand)/more/shipping" },
    ],
  },
];

export default function BrandMoreMenu() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader eyebrow="Brand HQ" title="More" subtitle="Tools to run your brand" />
      {MENU.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.card}>
            {group.items.map((item, i) => (
              <MenuRow key={item.label} item={item} last={i === group.items.length - 1} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function MenuRow({ item, last }: { item: MenuItem; last: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(item.href as never)}
      android_ripple={{ color: colors.light.muted }}
      style={[styles.row, !last && styles.rowDivider]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={20} color={colors.light.primary} />
      </View>
      <Text style={styles.rowLabel}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  group: { paddingHorizontal: 20, marginTop: 16 },
  groupTitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden" as ViewStyle["overflow"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
});
