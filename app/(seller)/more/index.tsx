import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
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
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  SellerScreenHeader,
  SellerPanel,
  sellerBorder,
  SELLER_CREAM,
  SELLER_INK,
  SELLER_RUST,
} from "@/components/seller/chrome";
import type { Store, Notification } from "@/lib/types";

type MenuItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

type Shortcut = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number | null;
  tone?: "default" | "warn" | "critical";
};

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
      setPayoutLabel(
        profile.bankSummary ??
          profile.method ??
          (profile.stripeConnected ? "Stripe Connect" : "Set up payout method"),
      );
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const tools: MenuItem[] = [
    { label: "Reviews", subtitle: "Ratings & replies", icon: "star-outline", route: "/(seller)/reviews" },
    { label: "Coupons", subtitle: "Discounts & BXGY", icon: "pricetag-outline", route: "/(seller)/coupons" },
    { label: "Payout settings", subtitle: payoutLabel, icon: "card-outline", route: "/(seller)/payouts/settings" },
    { label: "Store settings", subtitle: "Profile, contact, KYC", icon: "storefront-outline", route: "/(seller)/settings" },
  ];

  const shortcuts: Shortcut[] = [
    { key: "analytics", label: "Analytics", icon: "bar-chart-outline", onPress: () => router.push("/(seller)/analytics" as any) },
    { key: "returns", label: "Returns", icon: "return-down-back-outline", badge: returnsCount && returnsCount > 0 ? returnsCount : null, tone: returnsCount && returnsCount > 0 ? "warn" : "default", onPress: () => router.push("/(seller)/returns" as any) },
    { key: "payouts", label: "Payouts", icon: "wallet-outline", onPress: () => router.push("/(seller)/payouts" as any) },
    { key: "alerts", label: "Alerts", icon: "notifications-outline", badge: unread > 0 ? unread : null, tone: unread > 0 ? "critical" : "default", onPress: () => router.push("/(seller)/notifications" as any) },
  ];

  const monogram = (store?.name ?? "S")[0].toUpperCase();
  const attentionCount = (pendingOrders ?? 0) + (returnsCount ?? 0) + unread;

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
            <Skeleton height={110} borderRadius={22} style={{ marginTop: 2 }} />
            <Skeleton height={178} borderRadius={22} style={{ marginTop: 18 }} />
            <Skeleton height={250} borderRadius={22} style={{ marginTop: 18 }} />
          </>
        ) : (
          <TouchableOpacity
            style={styles.storeCard}
            onPress={() => router.push("/(seller)/settings" as any)}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="Open store settings"
          >
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={styles.monogram}><Text style={styles.monogramText}>{monogram}</Text></View>
            )}
            <View style={styles.storeInfo}>
              <View style={styles.storeNameRow}>
                <Text style={styles.storeName} numberOfLines={1}>{store?.name ?? "Your store"}</Text>
                <View style={[styles.onlinePill, !store?.is_online && styles.offlinePill]}>
                  <View style={[styles.onlineDot, !store?.is_online && styles.offlineDot]} />
                  <Text style={[styles.onlineText, !store?.is_online && styles.offlineText]}>{store?.is_online ? "Live" : "Offline"}</Text>
                </View>
              </View>
              <Text style={styles.storeMeta}>Edit profile · seller settings</Text>
              {revenue != null ? <Text style={styles.storeRevenue}>{formatPrice(revenue)} · 30 days</Text> : null}
            </View>
            <View style={styles.storeArrow}><Ionicons name="chevron-forward" size={17} color={colors.ink.mute} /></View>
          </TouchableOpacity>
        )}

        {attentionCount > 0 ? (
          <TouchableOpacity style={styles.attentionCard} onPress={() => router.push("/(seller)/notifications" as any)} activeOpacity={0.84}>
            <View style={styles.attentionIcon}><Ionicons name="flash-outline" size={18} color={SELLER_RUST} /></View>
            <View style={styles.attentionCopy}>
              <Text style={styles.attentionKicker}>NEEDS ATTENTION</Text>
              <Text style={styles.attentionTitle}>{attentionCount} open item{attentionCount === 1 ? "" : "s"}</Text>
              <Text style={styles.attentionSub}>{pendingOrders ?? 0} orders · {returnsCount ?? 0} returns · {unread} alerts</Text>
            </View>
            <View style={styles.attentionAction}><Text style={styles.attentionActionText}>Review</Text><Ionicons name="arrow-forward" size={13} color={SELLER_RUST} /></View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>FREQUENT</Text><Text style={styles.sectionTitle}>Daily tools</Text></View></View>
        <View style={styles.shortcutGrid}>
          {shortcuts.map((item) => <MoreShortcut key={item.key} item={item} />)}
        </View>

        <View style={[styles.sectionHeader, { marginTop: spacing[7] }]}><View><Text style={styles.sectionEyebrow}>WORKSPACE</Text><Text style={styles.sectionTitle}>Store management</Text></View></View>
        <SellerPanel style={styles.settingsPanel}>
          {tools.map((item, index) => (
            <TouchableOpacity key={item.label} style={[styles.row, index === tools.length - 1 && styles.rowLast]} onPress={() => router.push(item.route as any)} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel={item.label}>
              <View style={styles.iconWrap}><Ionicons name={item.icon} size={18} color={colors.olive[800]} /></View>
              <View style={styles.rowBody}><Text style={styles.rowLabel}>{item.label}</Text><Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text></View>
              <View style={styles.rowArrow}><Ionicons name="chevron-forward" size={15} color={colors.ink.mute} /></View>
            </TouchableOpacity>
          ))}
        </SellerPanel>

        <TouchableOpacity style={styles.signOut} onPress={() => void signOut()} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={SELLER_RUST} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function MoreShortcut({ item }: { item: Shortcut }) {
  const tone = item.tone === "critical" ? SELLER_RUST : item.tone === "warn" ? colors.accent2.ochre : colors.olive[800];
  return (
    <TouchableOpacity style={[styles.shortcutCard, item.badge ? styles.shortcutCardAlert : null]} onPress={item.onPress} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={item.label}>
      <View style={styles.shortcutTop}>
        <View style={styles.shortcutIcon}><Ionicons name={item.icon} size={19} color={tone} />{item.badge ? <View style={[styles.shortcutBadge, item.tone === "critical" && styles.shortcutBadgeCritical]}><Text style={styles.shortcutBadgeText}>{item.badge > 99 ? "99+" : item.badge}</Text></View> : null}</View>
        <View style={styles.shortcutArrow}><Ionicons name="arrow-forward" size={14} color={colors.ink.mute} /></View>
      </View>
      <Text style={styles.shortcutLabel}>{item.label}</Text>
      <Text style={styles.shortcutHint}>OPEN TOOL</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  storeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: sellerBorder, padding: 14, minHeight: 104, ...shadows.soft },
  logo: { width: 58, height: 58, borderRadius: 18 },
  monogram: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  monogramText: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: SELLER_CREAM },
  storeInfo: { flex: 1, minWidth: 0, gap: 3 },
  storeNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  storeName: { flex: 1, fontFamily: fontFamilies.display.semibold, fontSize: 19, color: SELLER_INK },
  storeMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  storeRevenue: { marginTop: 2, fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: colors.olive[700] },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.full, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: colors.olive[50] },
  offlinePill: { backgroundColor: colors.paper.warm },
  onlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.olive[700] },
  offlineDot: { backgroundColor: colors.ink.mute },
  onlineText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, color: colors.olive[800] },
  offlineText: { color: colors.ink.mute },
  storeArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.paper.warm, alignItems: "center", justifyContent: "center" },
  attentionCard: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 14, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: "rgba(184,92,58,0.25)", backgroundColor: "rgba(184,92,58,0.06)" },
  attentionIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: "rgba(184,92,58,0.1)", alignItems: "center", justifyContent: "center" },
  attentionCopy: { flex: 1, minWidth: 0, gap: 2 },
  attentionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1, color: SELLER_RUST },
  attentionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: SELLER_INK },
  attentionSub: { fontFamily: fontFamilies.sans.regular, fontSize: 10, color: colors.ink.mute },
  attentionAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radii.full, backgroundColor: "#FFFFFF" },
  attentionActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: SELLER_RUST },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing[6], marginBottom: 12 },
  sectionEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.3, color: colors.olive[600], marginBottom: 3 },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 21, color: SELLER_INK },
  shortcutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shortcutCard: { width: "47.5%", flexGrow: 1, minHeight: 108, padding: 13, borderRadius: 20, borderWidth: 1, borderColor: sellerBorder, backgroundColor: "#FFFFFF", justifyContent: "space-between", ...shadows.soft },
  shortcutCardAlert: { borderColor: "rgba(184,92,58,0.28)", backgroundColor: "rgba(184,92,58,0.035)" },
  shortcutTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shortcutIcon: { position: "relative", width: 39, height: 39, borderRadius: 13, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  shortcutArrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.paper.warm, alignItems: "center", justifyContent: "center" },
  shortcutBadge: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent2.ochre, borderWidth: 1.5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shortcutBadgeCritical: { backgroundColor: SELLER_RUST },
  shortcutBadgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, color: "#FFFFFF" },
  shortcutLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: SELLER_INK, marginTop: 10 },
  shortcutHint: { fontFamily: fontFamilies.mono.semibold, fontSize: 7, letterSpacing: 1, color: colors.ink.mute, marginTop: 2 },
  settingsPanel: { backgroundColor: "#FFFFFF", borderRadius: 22, borderColor: sellerBorder, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 68, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sellerBorder },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: SELLER_INK },
  rowSub: { fontFamily: fontFamilies.sans.regular, fontSize: 10, color: colors.ink.mute },
  rowArrow: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.paper.warm, alignItems: "center", justifyContent: "center" },
  signOut: { marginTop: spacing[6], flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, minHeight: 50, borderRadius: 17, borderWidth: 1, borderColor: "rgba(184,92,58,0.25)", backgroundColor: "rgba(184,92,58,0.06)" },
  signOutText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: SELLER_RUST },
});
