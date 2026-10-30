import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerKPIs,
  getSellerNotifications,
  getSellerPayoutSettings,
  getSellerStore,
} from "@/lib/api";
import { describePayoutProfile } from "@/lib/seller-access";
import { isNotificationUnread } from "@/lib/notifications/seller-inbox";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  SellerScreenHeader,
  sellerBorder,
  SELLER_CREAM,
  SELLER_GOLD,
  SELLER_INK,
  SELLER_RUST,
} from "@/components/seller/chrome";
import { HERO, LuxeHero } from "@/components/seller/luxe";
import type { Store, Notification } from "@/lib/types";

type IconName = keyof typeof Ionicons.glyphMap;
type Tone = "olive" | "ochre" | "rust" | "ink";

type MenuItem = {
  label: string;
  subtitle: string;
  icon: IconName;
  route: string;
  tone: Tone;
};

type Shortcut = {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  route: string;
  tone: Tone;
  badge?: number | null;
};

const TONES: Record<Tone, { fg: string; bg: string; ring: string }> = {
  olive: { fg: colors.olive[700], bg: colors.olive[50], ring: "rgba(83,94,44,0.14)" },
  ochre: { fg: "#9a7a24", bg: "rgba(200,164,74,0.14)", ring: "rgba(200,164,74,0.3)" },
  rust: { fg: SELLER_RUST, bg: "rgba(184,92,58,0.1)", ring: "rgba(184,92,58,0.26)" },
  ink: { fg: SELLER_INK, bg: colors.paper.warm, ring: "rgba(22,26,10,0.1)" },
};

const WHITE = "#FFFFFF";

export default function SellerMoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Store | null>(null);
  const [pendingOrders, setPendingOrders] = useState<number | null>(null);
  const [returnsCount, setReturnsCount] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [payoutLabel, setPayoutLabel] = useState("Payout profile");
  const [revenue, setRevenue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (!storeRes.ok || !storeRes.data) {
      setStore(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setStore(storeRes.data);
    const [kpiRes, notifRes, payoutRes] = await Promise.all([
      getSellerKPIs(storeRes.data.id),
      getSellerNotifications(50),
      getSellerPayoutSettings(storeRes.data.id),
    ]);
    if (kpiRes.ok) {
      setPendingOrders(kpiRes.data.pendingReady ? kpiRes.data.pendingOrders : null);
      setReturnsCount(kpiRes.data.returnsReady ? kpiRes.data.returnsCount : null);
      setRevenue(kpiRes.data.analyticsReady ? kpiRes.data.totalRevenue : null);
    }
    if (notifRes.ok) {
      setUnread(notifRes.data.filter((n: Notification) => isNotificationUnread(n)).length);
    }
    if (payoutRes.ok) {
      const profile = describePayoutProfile(payoutRes.data, true);
      setPayoutLabel(profile.bankSummary ?? "Set up payout method");
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const go = (route: string) => router.push(route as any);

  const tools: MenuItem[] = [
    { label: "Reviews", subtitle: "Ratings & replies", icon: "star-outline", route: "/(seller)/reviews", tone: "ochre" },
    { label: "Coupons", subtitle: "Discounts & BXGY offers", icon: "pricetag-outline", route: "/(seller)/coupons", tone: "rust" },
    { label: "Payout settings", subtitle: payoutLabel, icon: "card-outline", route: "/(seller)/payouts/settings", tone: "olive" },
    { label: "Store settings", subtitle: "Profile, contact, KYC", icon: "storefront-outline", route: "/(seller)/settings", tone: "ink" },
  ];

  const shortcuts: Shortcut[] = [
    { key: "analytics", label: "Analytics", hint: "Sales & traffic", icon: "bar-chart-outline", route: "/(seller)/analytics", tone: "olive" },
    { key: "returns", label: "Returns", hint: returnsCount ? `${returnsCount} to review` : "All clear", icon: "return-down-back-outline", route: "/(seller)/returns", tone: returnsCount ? "ochre" : "ink", badge: returnsCount && returnsCount > 0 ? returnsCount : null },
    { key: "payouts", label: "Payouts", hint: "Balance & history", icon: "wallet-outline", route: "/(seller)/payouts", tone: "olive" },
    { key: "alerts", label: "Alerts", hint: unread ? `${unread} unread` : "You're caught up", icon: "notifications-outline", route: "/(seller)/notifications", tone: unread ? "rust" : "ink", badge: unread > 0 ? unread : null },
  ];

  const monogram = (store?.name ?? "S")[0].toUpperCase();
  const isLive = !!store?.is_online;
  const attentionCount = (pendingOrders ?? 0) + (returnsCount ?? 0) + unread;
  const appVersion = Constants.expoConfig?.version;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SellerScreenHeader kicker="Workspace" title="More" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.olive[700]} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>
            <Skeleton height={196} borderRadius={24} style={{ marginTop: 2 }} />
            <Skeleton height={96} borderRadius={22} style={{ marginTop: 16 }} />
            <Skeleton height={300} borderRadius={22} style={{ marginTop: 28 }} />
          </>
        ) : (
          <>
            {/* ── Store hero ─────────────────────────────── */}
            <PressCard onPress={() => go("/(seller)/settings")} accessibilityLabel="Open store settings">
              <LuxeHero>

                <View style={styles.heroTop}>
                  <View style={styles.logoRing}>
                    {store?.logo_url ? (
                      <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
                    ) : (
                      <View style={styles.monogram}><Text style={styles.monogramText}>{monogram}</Text></View>
                    )}
                  </View>
                  <View style={styles.heroIdentity}>
                    <Text style={styles.heroName} numberOfLines={1}>{store?.name ?? "Your store"}</Text>
                    <View style={styles.heroMetaRow}>
                      <View style={[styles.statusPill, isLive ? styles.statusLive : styles.statusOff]}>
                        <View style={[styles.statusDot, { backgroundColor: isLive ? colors.olive[500] : "rgba(83,94,44,0.35)" }]} />
                        <Text style={[styles.statusText, { color: isLive ? colors.olive[800] : HERO.mute }]}>{isLive ? "LIVE" : "OFFLINE"}</Text>
                      </View>
                      {store?.slug ? <Text style={styles.heroSlug} numberOfLines={1}>@{store.slug}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.heroChevron}><Ionicons name="settings-outline" size={15} color={HERO.text} /></View>
                </View>

                <View style={styles.heroRevenueBlock}>
                  <Text style={styles.heroKicker}>REVENUE · LAST 30 DAYS</Text>
                  <Text style={styles.heroRevenue} numberOfLines={1}>
                    {revenue != null ? formatPrice(revenue) : "—"}
                  </Text>
                </View>

                <View style={styles.heroStats}>
                  <HeroStat label="Rating" value={store?.rating ? store.rating.toFixed(1) : "—"} icon="star" />
                  <View style={styles.heroDivider} />
                  <HeroStat label="Products" value={compact(store?.total_products)} icon="cube-outline" />
                  <View style={styles.heroDivider} />
                  <HeroStat label="Followers" value={compact(store?.total_followers)} icon="people-outline" />
                </View>
              </LuxeHero>
            </PressCard>

            {/* ── Needs attention ────────────────────────── */}
            {attentionCount > 0 ? (
              <View style={styles.attentionCard}>
                <View style={styles.attentionHead}>
                  <View style={styles.attentionIcon}><Ionicons name="flash" size={16} color={WHITE} /></View>
                  <View style={styles.attentionCopy}>
                    <Text style={styles.attentionKicker}>NEEDS ATTENTION</Text>
                    <Text style={styles.attentionTitle}>
                      {attentionCount} open item{attentionCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <PressCard onPress={() => go("/(seller)/notifications")} style={styles.attentionAction} accessibilityLabel="Review open items">
                    <Text style={styles.attentionActionText}>Review</Text>
                    <Ionicons name="arrow-forward" size={13} color={WHITE} />
                  </PressCard>
                </View>
                <View style={styles.attentionChips}>
                  <AttentionChip label="Orders" value={pendingOrders ?? 0} icon="receipt-outline" onPress={() => go("/(seller)/orders")} />
                  <AttentionChip label="Returns" value={returnsCount ?? 0} icon="return-down-back-outline" onPress={() => go("/(seller)/returns")} />
                  <AttentionChip label="Alerts" value={unread} icon="notifications-outline" onPress={() => go("/(seller)/notifications")} />
                </View>
              </View>
            ) : (
              <View style={styles.allClear}>
                <View style={styles.allClearIcon}><Ionicons name="checkmark" size={15} color={colors.olive[700]} /></View>
                <Text style={styles.allClearText}>You're all caught up — nothing needs attention.</Text>
              </View>
            )}

            {/* ── Daily tools ────────────────────────────── */}
            <SectionHeader eyebrow="FREQUENT" title="Daily tools" />
            <View style={styles.shortcutGrid}>
              {shortcuts.map((item) => <MoreShortcut key={item.key} item={item} onPress={() => go(item.route)} />)}
            </View>

            {/* ── Store management ───────────────────────── */}
            <SectionHeader eyebrow="WORKSPACE" title="Store management" />
            <View style={styles.listCard}>
              {tools.map((item, index) => {
                const t = TONES[item.tone];
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => go(item.route)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: t.bg, borderColor: t.ring }]}>
                      <Ionicons name={item.icon} size={18} color={t.fg} />
                    </View>
                    <View style={[styles.rowBody, index < tools.length - 1 && styles.rowDivider]}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowLabel}>{item.label}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.olive[300]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Account ────────────────────────────────── */}
            <SectionHeader eyebrow="ACCOUNT" title="Session" />
            <View style={styles.listCard}>
              <View style={styles.accountRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(user?.email ?? "?")[0].toUpperCase()}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Signed in</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{user?.email ?? "—"}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => void signOut()}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="log-out-outline" size={17} color={SELLER_RUST} />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>

            {appVersion ? <Text style={styles.version}>LUXE SELLER · v{appVersion}</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function compact(n?: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function PressCard({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [style, { transform: [{ scale: pressed ? 0.975 : 1 }], opacity: pressed ? 0.94 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionEyebrowRow}>
        <View style={styles.sectionRule} />
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function HeroStat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatValueRow}>
        <Ionicons name={icon} size={12} color={SELLER_GOLD} />
        <Text style={styles.heroStatValue}>{value}</Text>
      </View>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function AttentionChip({ label, value, icon, onPress }: { label: string; value: number; icon: IconName; onPress: () => void }) {
  const active = value > 0;
  return (
    <PressCard onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={13} color={active ? SELLER_RUST : colors.ink.mute} />
      <Text style={[styles.chipValue, active && { color: SELLER_INK }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </PressCard>
  );
}

function MoreShortcut({ item, onPress }: { item: Shortcut; onPress: () => void }) {
  const t = TONES[item.tone];
  const alert = !!item.badge;
  return (
    <PressCard onPress={onPress} style={[styles.shortcutCard, alert && { borderColor: t.ring }]} accessibilityLabel={item.label}>
      {alert ? <View style={[styles.shortcutAccent, { backgroundColor: t.fg }]} /> : null}
      <View style={styles.shortcutTop}>
        <View style={[styles.shortcutIcon, { backgroundColor: t.bg, borderColor: t.ring }]}>
          <Ionicons name={item.icon} size={20} color={t.fg} />
        </View>
        {alert ? (
          <View style={[styles.badge, { backgroundColor: t.fg }]}>
            <Text style={styles.badgeText}>{item.badge! > 99 ? "99+" : item.badge}</Text>
          </View>
        ) : (
          <Ionicons name="arrow-forward" size={15} color={colors.olive[300]} />
        )}
      </View>
      <View>
        <Text style={styles.shortcutLabel}>{item.label}</Text>
        <Text style={[styles.shortcutHint, alert && { color: t.fg }]} numberOfLines={1}>{item.hint}</Text>
      </View>
    </PressCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[3] },

  // Hero
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoRing: { padding: 2, borderRadius: 16, borderWidth: 1, borderColor: "rgba(200,164,74,0.45)" },
  logo: { width: 42, height: 42, borderRadius: 13 },
  monogram: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.olive[950], alignItems: "center", justifyContent: "center" },
  monogramText: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: SELLER_CREAM },
  heroIdentity: { flex: 1, minWidth: 0, gap: 4 },
  heroName: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: HERO.ink, letterSpacing: -0.2 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radii.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth },
  statusLive: { backgroundColor: "rgba(106,118,57,0.10)", borderColor: "rgba(106,118,57,0.3)" },
  statusOff: { backgroundColor: HERO.tile, borderColor: HERO.tileBorder },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1 },
  heroSlug: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: HERO.mute },
  heroChevron: { width: 30, height: 30, borderRadius: 15, backgroundColor: HERO.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: HERO.chipBorder, alignItems: "center", justifyContent: "center" },
  heroRevenueBlock: { marginTop: 14, gap: 2 },
  heroKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.5, color: HERO.kicker },
  heroRevenue: { fontFamily: fontFamilies.display.regular, fontSize: 30, lineHeight: 36, color: HERO.ink, letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  heroStats: { marginTop: 12, flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14, backgroundColor: HERO.tile, borderWidth: StyleSheet.hairlineWidth, borderColor: HERO.tileBorder },
  heroStat: { flex: 1, alignItems: "center", gap: 2 },
  heroStatValueRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroStatValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: HERO.ink },
  heroStatLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1, color: HERO.mute, textTransform: "uppercase" },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: HERO.divider },

  // Attention
  attentionCard: { marginTop: 16, padding: 14, borderRadius: 22, backgroundColor: WHITE, borderWidth: 1, borderColor: "rgba(184,92,58,0.2)", ...shadows.soft, shadowColor: SELLER_RUST, shadowOpacity: 0.1 },
  attentionHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  attentionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: SELLER_RUST, alignItems: "center", justifyContent: "center" },
  attentionCopy: { flex: 1, minWidth: 0, gap: 2 },
  attentionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.3, color: SELLER_RUST },
  attentionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 17, color: SELLER_INK },
  attentionAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radii.full, backgroundColor: SELLER_INK },
  attentionActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: WHITE },
  attentionChips: { flexDirection: "row", gap: 8, marginTop: 13 },
  chip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 13, backgroundColor: colors.paper.DEFAULT, borderWidth: 1, borderColor: "transparent" },
  chipActive: { backgroundColor: "rgba(184,92,58,0.07)", borderColor: "rgba(184,92,58,0.18)" },
  chipValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.ink.mute },
  chipLabel: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  allClear: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 18, backgroundColor: colors.olive[50], borderWidth: 1, borderColor: sellerBorder },
  allClearIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: WHITE, alignItems: "center", justifyContent: "center" },
  allClearText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.olive[800] },

  // Sections
  sectionHeader: { marginTop: spacing[7], marginBottom: 12, gap: 4 },
  sectionEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionRule: { width: 14, height: 1.5, borderRadius: 1, backgroundColor: SELLER_GOLD },
  sectionEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.4, color: colors.olive[600] },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: SELLER_INK, letterSpacing: -0.2 },

  // Shortcuts
  shortcutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  shortcutCard: { width: "47%", flexGrow: 1, minHeight: 128, padding: 15, borderRadius: 22, borderWidth: 1, borderColor: sellerBorder, backgroundColor: WHITE, justifyContent: "space-between", overflow: "hidden", ...shadows.soft, shadowOpacity: 0.06 },
  shortcutAccent: { position: "absolute", top: 0, left: 18, right: 18, height: 2.5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  shortcutTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shortcutIcon: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: WHITE },
  shortcutLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: SELLER_INK, marginTop: 14 },
  shortcutHint: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute, marginTop: 2 },

  // Lists
  listCard: { backgroundColor: WHITE, borderRadius: 22, borderWidth: 1, borderColor: sellerBorder, overflow: "hidden", ...shadows.soft, shadowOpacity: 0.06 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingLeft: 14 },
  rowPressed: { backgroundColor: colors.paper.DEFAULT },
  rowIcon: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 15, paddingRight: 16, minHeight: 70 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(83,94,44,0.16)" },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: SELLER_INK },
  rowSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },

  // Account
  accountRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 16, color: SELLER_CREAM },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 14, marginBottom: 14, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "rgba(184,92,58,0.22)", backgroundColor: "rgba(184,92,58,0.05)" },
  signOutText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: SELLER_RUST },
  version: { marginTop: 22, textAlign: "center", fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.4, color: colors.olive[300] },
});
