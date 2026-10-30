import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getAdminOverviewStats } from "@/lib/api";
import { StatusDot } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type GroupName = "Catalogue" | "People" | "Engagement" | "Operations" | "Insights" | "System";

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  group: GroupName;
  badge?: number;
}

const GROUP_ORDER: GroupName[] = ["Catalogue", "People", "Engagement", "Operations", "Insights", "System"];
const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

// Each group gets a quiet two-stop tint for its icon wells + an ink colour for the glyph.
const GROUP_TONE: Record<GroupName, { from: string; to: string; ink: string }> = {
  Catalogue: { from: "#eef0dc", to: "#dfe3c2", ink: colors.olive[700] },
  People: { from: "#f3ead3", to: "#e8d9b0", ink: "#7a5b1a" },
  Engagement: { from: "#f6e6dc", to: "#ecd0c0", ink: "#8a4529" },
  Operations: { from: "#e7ebe4", to: "#d3dacd", ink: "#3c4a3a" },
  Insights: { from: "#ecebe2", to: "#dcdacb", ink: colors.ink.soft },
  System: { from: "#e9e8df", to: "#d6d4c6", ink: colors.ink.soft },
};

const GOLD = colors.accent2.ochre;
const CREAM = colors.paper.cream;

function compact(n: number | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export default function AdminMore() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState("");

  const statsQuery = useQuery({
    queryKey: ["admin-overview-stats"],
    queryFn: async () => {
      const r = await getAdminOverviewStats();
      return r.ok ? r.data : null;
    },
  });

  const s = statsQuery.data;
  const pendingTotal = (s?.pendingStores ?? 0) + (s?.pendingBrands ?? 0) + (s?.pendingProducts ?? 0);

  const items: MenuItem[] = useMemo(
    () => [
      { key: "products", label: "Products", description: "Catalogue moderation", icon: "cube-outline", route: "/(admin)/products", group: "Catalogue", badge: s?.pendingProducts },
      { key: "brands", label: "Brands", description: "Approve brand applications", icon: "pricetag-outline", route: "/(admin)/brands", group: "Catalogue", badge: s?.pendingBrands },
      { key: "categories", label: "Categories", description: "Tree, ordering, active", icon: "albums-outline", route: "/(admin)/categories", group: "Catalogue" },
      { key: "banners", label: "Banners", description: "Hero, grid, marquee", icon: "images-outline", route: "/(admin)/banners", group: "Catalogue" },
      { key: "coupons", label: "Coupons", description: "Discounts & promotions", icon: "ticket-outline", route: "/(admin)/coupons", group: "Catalogue" },
      { key: "campaigns", label: "Campaigns", description: "Seasonal pushes", icon: "megaphone-outline", route: "/(admin)/campaigns", group: "Catalogue" },
      { key: "gift-cards", label: "Gift Cards", description: "Issue & balance", icon: "gift-outline", route: "/(admin)/gift-cards", group: "Catalogue" },
      { key: "users", label: "Users", description: "Roles & access", icon: "people-outline", route: "/(admin)/users", group: "People" },
      { key: "stores", label: "Stores", description: "Seller approvals", icon: "storefront-outline", route: "/(admin)/stores", group: "People", badge: s?.pendingStores },
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
    [s?.pendingBrands, s?.pendingStores, s?.pendingProducts]
  );

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const filtered = q
      ? items.filter((i) => `${i.label} ${i.description} ${i.group}`.toLowerCase().includes(q))
      : items;
    return GROUP_ORDER.map((g, idx) => ({
      name: g,
      numeral: NUMERALS[idx],
      items: filtered.filter((i) => i.group === g),
    })).filter((g) => g.items.length > 0);
  }, [items, q]);

  const name = user?.user_metadata?.full_name ?? "Admin";
  const initial = (user?.user_metadata?.full_name ?? user?.email ?? "A").charAt(0).toUpperCase();
  const go = (route: string) => router.push(route as any);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Masthead ─────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowRule} />
          <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
        </View>
        <Text style={styles.title}>
          The <Text style={styles.titleItalic}>Directory</Text>
        </Text>
        <Text style={styles.subtitle}>
          Every corner of the platform, in one place — {items.length} destinations across {GROUP_ORDER.length} departments.
        </Text>
      </View>

      {/* ── Identity card ───────────────────────── */}
      <Pressable onPress={() => go("/(admin)/settings")} style={({ pressed }) => [styles.profileShadow, pressed && styles.pressedScale]}>
        <LinearGradient
          colors={["#3a4120", colors.olive[900], "#1c200f"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profile}
        >
          {/* decorative rings */}
          <View pointerEvents="none" style={[styles.ring, { width: 220, height: 220, top: -110, right: -70 }]} />
          <View pointerEvents="none" style={[styles.ring, { width: 140, height: 140, top: -70, right: -30, opacity: 0.6 }]} />

          <View style={styles.profileRow}>
            <LinearGradient colors={["#e3c878", GOLD, "#9c7a2c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            </LinearGradient>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{name}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{user?.email ?? "—"}</Text>
            </View>
            <View style={styles.profileGear}>
              <Ionicons name="settings-outline" size={16} color="rgba(250,248,241,0.8)" />
            </View>
          </View>

          <View style={styles.rolePill}>
            <StatusDot tone="live" size={6} />
            <Text style={styles.roleText}>PLATFORM ADMINISTRATOR</Text>
          </View>

          <View style={styles.profileDivider} />

          <View style={styles.statRow}>
            {[
              { label: "Users", value: s?.users },
              { label: "Stores", value: s?.stores ?? (s as any)?.totalStores ?? s?.activeStores },
              { label: "Products", value: s?.products },
              { label: "Orders", value: s?.orders },
            ].map((st, i) => (
              <View key={st.label} style={[styles.stat, i > 0 && styles.statBorder]}>
                <Text style={styles.statValue}>{compact(st.value)}</Text>
                <Text style={styles.statLabel}>{st.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Pressable>

      {/* ── Review queue ────────────────────────── */}
      {pendingTotal > 0 ? (
        <Pressable onPress={() => go("/(admin)/approvals")} style={({ pressed }) => [styles.queue, pressed && styles.pressedScale]}>
          <LinearGradient colors={["#fbf3df", "#f3e4bd"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.queueInner}>
            <View style={styles.queueTop}>
              <View style={styles.queueIcon}>
                <Ionicons name="flash" size={15} color="#fff8e6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.queueEyebrow}>REVIEW QUEUE</Text>
                <Text style={styles.queueTitle}>
                  {pendingTotal} submission{pendingTotal > 1 ? "s" : ""} awaiting you
                </Text>
              </View>
              <View style={styles.queueCta}>
                <Ionicons name="arrow-forward" size={14} color={CREAM} />
              </View>
            </View>
            <View style={styles.queueChips}>
              {[
                { label: "Stores", n: s?.pendingStores ?? 0 },
                { label: "Brands", n: s?.pendingBrands ?? 0 },
                { label: "Products", n: s?.pendingProducts ?? 0 },
              ]
                .filter((c) => c.n > 0)
                .map((c) => (
                  <View key={c.label} style={styles.queueChip}>
                    <Text style={styles.queueChipN}>{c.n}</Text>
                    <Text style={styles.queueChipLabel}>{c.label}</Text>
                  </View>
                ))}
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* ── Search ──────────────────────────────── */}
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.light.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Jump to a section…"
          placeholderTextColor={colors.light.mutedForeground}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {!q ? <Text style={styles.searchHint}>{items.length}</Text> : null}
      </View>

      {/* ── Departments ─────────────────────────── */}
      {groups.map((g) => {
        const tone = GROUP_TONE[g.name];
        return (
          <View key={g.name} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupNumeral}>{g.numeral}.</Text>
              <Text style={styles.groupLabel}>{g.name}</Text>
              <View style={styles.groupRule} />
              <Text style={styles.groupCount}>{String(g.items.length).padStart(2, "0")}</Text>
            </View>

            <View style={styles.card}>
              {g.items.map((item, idx) => {
                const hasBadge = typeof item.badge === "number" && item.badge > 0;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => go(item.route)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <LinearGradient colors={[tone.from, tone.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rowIcon}>
                      <Ionicons name={item.icon} size={17} color={tone.ink} />
                    </LinearGradient>
                    <View style={[styles.rowBody, idx < g.items.length - 1 && styles.rowDivider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel} numberOfLines={1}>{item.label}</Text>
                        <Text style={styles.rowDesc} numberOfLines={1}>{item.description}</Text>
                      </View>
                      {hasBadge ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={15} color={colors.light.border} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing matches “{query.trim()}”</Text>
          <Text style={styles.emptyBody}>Try a section name like “orders”, “coupons” or “audit”.</Text>
        </View>
      ) : null}

      {/* ── Footer ──────────────────────────────── */}
      <Pressable onPress={signOut} style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}>
        <Ionicons name="log-out-outline" size={17} color={colors.accent2.rust} />
        <Text style={styles.signOutText}>Sign out of Console</Text>
      </Pressable>
      <View style={styles.colophon}>
        <View style={styles.colophonRule} />
        <Text style={styles.colophonText}>LUXE · PLATFORM CONSOLE</Text>
        <View style={styles.colophonRule} />
      </View>
    </ScrollView>
  );
}

const MUTED = colors.light.mutedForeground;
const FG = colors.light.foreground;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 140 },
  pressedScale: { transform: [{ scale: 0.985 }], opacity: 0.95 },

  // Masthead
  hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowRule: { width: 18, height: 1, backgroundColor: colors.light.primary },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 2 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 36, color: FG, letterSpacing: -1, marginTop: 8, lineHeight: 40 },
  titleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: MUTED, marginTop: 8, maxWidth: 320 },

  // Identity card
  profileShadow: { marginHorizontal: 16, marginTop: 18, borderRadius: radii["3xl"], ...shadows.editorial },
  profile: {
    borderRadius: radii["3xl"],
    padding: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.35)",
  },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1, borderColor: "rgba(200,164,74,0.14)" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarRing: { width: 54, height: 54, borderRadius: 27, padding: 1.5 },
  avatar: { flex: 1, borderRadius: 26, backgroundColor: "#262b15", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: GOLD },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: CREAM, letterSpacing: -0.3 },
  profileEmail: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: "rgba(250,248,241,0.55)" },
  profileGear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(250,248,241,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.4)",
  },
  roleText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, color: GOLD, letterSpacing: 1.4 },
  profileDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(250,248,241,0.14)", marginTop: 16, marginBottom: 14 },
  statRow: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "flex-start", paddingLeft: 12 },
  statBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(250,248,241,0.14)" },
  statValue: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: CREAM, letterSpacing: -0.3 },
  statLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 8, color: "rgba(250,248,241,0.5)", letterSpacing: 1.2, marginTop: 2 },

  // Review queue
  queue: { marginHorizontal: 16, marginTop: 14, borderRadius: radii["2xl"], ...shadows.soft },
  queueInner: { borderRadius: radii["2xl"], padding: 14, borderWidth: 1, borderColor: "#e6d29f" },
  queueTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  queueIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#a37b23", alignItems: "center", justifyContent: "center" },
  queueEyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 9, color: "#8d6a1f", letterSpacing: 1.6 },
  queueTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 16, color: "#4e3a10", marginTop: 1, letterSpacing: -0.2 },
  queueCta: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  queueChips: { flexDirection: "row", gap: 6, marginTop: 12, marginLeft: 46 },
  queueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,252,242,0.7)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d9bf7d",
  },
  queueChipN: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: "#6b4f14" },
  queueChipLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: "#7a5b1a" },

  // Search
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 22,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: "#e0dfd2",
  },
  searchInput: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, color: FG, paddingVertical: 0 },
  searchHint: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: MUTED,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.light.muted,
    overflow: "hidden",
  },

  // Groups
  group: { marginTop: 26, paddingHorizontal: 16 },
  groupHeader: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  groupNumeral: { fontFamily: fontFamilies.display.italic, fontSize: 15, color: colors.olive[500] },
  groupLabel: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: FG, letterSpacing: -0.3 },
  groupRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.light.border, alignSelf: "center", marginHorizontal: 4 },
  groupCount: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: MUTED, letterSpacing: 1 },

  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
    shadowOpacity: 0.05,
  },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 14 },
  rowPressed: { backgroundColor: "rgba(83,94,44,0.06)" },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingRight: 14, marginLeft: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dddccd" },
  rowLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: FG, letterSpacing: -0.1 },
  rowDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: MUTED, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: "#fff" },

  // Empty
  empty: { marginTop: 32, marginHorizontal: 32, alignItems: "center", gap: 6 },
  emptyTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 17, color: FG, textAlign: "center" },
  emptyBody: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: MUTED, textAlign: "center" },

  // Footer
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 32,
    paddingVertical: 15,
    borderRadius: radii["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(184,92,58,0.35)",
    backgroundColor: "rgba(184,92,58,0.05)",
  },
  signOutText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.accent2.rust, letterSpacing: 0.2 },
  colophon: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, marginHorizontal: 60 },
  colophonRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.light.border },
  colophonText: { fontFamily: fontFamilies.mono.regular, fontSize: 9, color: MUTED, letterSpacing: 1.8 },
});
