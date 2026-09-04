import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getAdminOverviewStats } from "@/lib/api";
import { Card, StatusDot } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  group: "Catalogue" | "People" | "Engagement" | "Operations" | "Insights" | "System";
  badge?: number | string;
  tone?: "default" | "primary" | "amber" | "danger";
}

const ICON_BG: Record<string, string> = {
  Catalogue: "#e6e6d0",
  People: "#d4d4b5",
  Engagement: "#efece2",
  Operations: "#fbe5dc",
  Insights: "#d4d4c8",
  System: "#c8c8b8",
};

export default function AdminMore() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const statsQuery = useQuery({
    queryKey: ["admin-overview-stats"],
    queryFn: async () => {
      const r = await getAdminOverviewStats();
      return r.ok ? r.data : null;
    },
  });

  const s = statsQuery.data;

  const items: MenuItem[] = useMemo(
    () => [
      { key: "products", label: "Products", description: "Catalogue moderation", icon: "cube-outline", route: "/(admin)/products", group: "Catalogue" },
      { key: "brands", label: "Brands", description: "Approve brand applications", icon: "pricetag-outline", route: "/(admin)/brands", group: "Catalogue", badge: s?.pendingBrands },
      { key: "categories", label: "Categories", description: "Tree, ordering, active", icon: "albums-outline", route: "/(admin)/categories", group: "Catalogue" },
      { key: "banners", label: "Banners", description: "Hero, grid, marquee", icon: "images-outline", route: "/(admin)/banners", group: "Catalogue" },
      { key: "coupons", label: "Coupons", description: "Discounts & promotions", icon: "ticket-outline", route: "/(admin)/coupons", group: "Catalogue" },
      { key: "campaigns", label: "Campaigns", description: "Seasonal pushes", icon: "megaphone-outline", route: "/(admin)/campaigns", group: "Catalogue" },
      { key: "gift-cards", label: "Gift Cards", description: "Issue & balance", icon: "gift-outline", route: "/(admin)/gift-cards", group: "Catalogue" },
      { key: "users", label: "Users", description: "Roles & access", icon: "people-outline", route: "/(admin)/users", group: "People" },
      { key: "stores", label: "Stores", description: "Seller approvals", icon: "storefront-outline", route: "/(admin)/stores", group: "People", badge: s?.pendingStores, tone: "primary" },
      { key: "content", label: "Content", description: "Reviews & Q&A", icon: "chatbubbles-outline", route: "/(admin)/content", group: "Engagement" },
      { key: "notifications", label: "Notifications", description: "Broadcasts & pushes", icon: "notifications-outline", route: "/(admin)/notifications", group: "Engagement" },
      { key: "blog", label: "Blog", description: "Editorial posts", icon: "document-text-outline", route: "/(admin)/blog", group: "Engagement" },
      { key: "courier", label: "Courier Providers", description: "External delivery partners", icon: "bicycle-outline", route: "/(admin)/courier", group: "Operations" },
      { key: "delivery", label: "Delivery", description: "Delivery companies", icon: "car-outline", route: "/(admin)/delivery", group: "Operations" },
      { key: "commissions", label: "Commissions", description: "Tier management", icon: "wallet-outline", route: "/(admin)/commissions", group: "Operations" },
      { key: "homepage", label: "Homepage CMS", description: "Sections & ordering", icon: "globe-outline", route: "/(admin)/homepage", group: "Operations" },
      { key: "contact", label: "Contact", description: "Inbox submissions", icon: "mail-outline", route: "/(admin)/contact", group: "Operations" },
      { key: "analytics", label: "Analytics", description: "Revenue & funnels", icon: "analytics-outline", route: "/(admin)/analytics", group: "Insights" },
      { key: "reports", label: "Reports", description: "Exports & snapshots", icon: "download-outline", route: "/(admin)/reports", group: "Insights" },
      { key: "audit-log", label: "Audit Log", description: "Admin activity", icon: "time-outline", route: "/(admin)/audit-log", group: "Insights" },
      { key: "settings", label: "Settings", description: "Platform configuration", icon: "settings-outline", route: "/(admin)/settings", group: "System" },
    ],
    [s?.pendingBrands, s?.pendingStores]
  );

  const groups = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const i of items) {
      (map[i.group] ??= []).push(i);
    }
    return map;
  }, [items]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>All platform sections. {items.length} destinations.</Text>
      </View>

      {/* Profile card */}
      <Card style={styles.profile}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.user_metadata?.full_name ?? user?.email ?? "A").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.user_metadata?.full_name ?? "Admin"}
            </Text>
            <Text style={styles.profileEmail}>{user?.email ?? "—"}</Text>
            <View style={styles.profileMeta}>
              <StatusDot tone="live" />
              <Text style={styles.profileRole}>Platform Administrator</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Grouped grid */}
      {(Object.entries(groups) as [string, MenuItem[]][]).map(([groupName, groupItems]) => (
        <View key={groupName} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupLabel}>{groupName.toUpperCase()}</Text>
            <Text style={styles.groupCount}>{groupItems.length}</Text>
          </View>
          <View style={styles.grid}>
            {groupItems.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                <View style={[styles.tileIconWrap, { backgroundColor: ICON_BG[groupName] ?? colors.light.muted }]}>
                  <Ionicons name={item.icon} size={18} color={colors.light.foreground} />
                </View>
                <Text style={styles.tileLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.tileDesc} numberOfLines={1}>{item.description}</Text>
                {typeof item.badge === "number" && item.badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Pressable onPress={signOut} style={styles.signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.light.destructive} />
        <Text style={styles.signOutText}>Sign out of Console</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },
  hero: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  profile: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  profileRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#fff",
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
  },
  profileEmail: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  profileMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  profileRole: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[600],
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  group: { marginTop: 20, paddingHorizontal: 16 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  groupLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
  },
  groupCount: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    gap: 3,
    minHeight: 90,
  },
  tilePressed: { opacity: 0.7 },
  tileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tileLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  tileDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.light.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#fff",
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 28,
    marginBottom: 16,
    paddingVertical: 14,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  signOutText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.destructive,
    letterSpacing: 0.5,
  },
});
