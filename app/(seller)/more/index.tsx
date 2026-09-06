import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerKPIs,
  getSellerNotifications,
  getSellerPayoutSettings,
} from "@/lib/api";
import { describePayoutProfile } from "@/lib/seller-access";
import { isNotificationUnread } from "@/lib/notifications/seller-inbox";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  SellerScreenHeader,
  SellerShortcutGrid,
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
  badge?: number | null;
};

export default function SellerMoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Store | null>(null);
  const [pendingOrders, setPendingOrders] = useState<number | null>(null);
  const [returnsCount, setReturnsCount] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [payoutLabel, setPayoutLabel] = useState<string>("Payout profile");
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
    {
      label: "Reviews",
      subtitle: "Ratings & replies",
      icon: "star-outline",
      route: "/(seller)/reviews",
    },
    {
      label: "Coupons",
      subtitle: "Discounts & BXGY",
      icon: "pricetag-outline",
      route: "/(seller)/coupons",
    },
    {
      label: "Payout settings",
      subtitle: payoutLabel,
      icon: "card-outline",
      route: "/(seller)/payouts/settings",
    },
    {
      label: "Store settings",
      subtitle: "Profile, contact, KYC",
      icon: "storefront-outline",
      route: "/(seller)/settings",
    },
  ];

  const monogram = (store?.name ?? "S")[0].toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SellerScreenHeader kicker="Workspace" title="More" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.olive[700]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Skeleton height={88} borderRadius={radii["2xl"]} style={{ marginTop: 4 }} />
        ) : (
          <TouchableOpacity
            style={styles.storeCard}
            onPress={() => router.push("/(seller)/settings" as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open store settings"
          >
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={styles.monogram}>
                <Text style={styles.monogramText}>{monogram}</Text>
              </View>
            )}
            <View style={styles.storeInfo}>
              <Text style={styles.storeName} numberOfLines={1}>
                {store?.name ?? "Your store"}
              </Text>
              <Text style={styles.storeMeta} numberOfLines={1}>
                {store?.is_online ? "Live on marketplace" : "Offline"} · Edit profile
              </Text>
              {revenue != null ? (
                <Text style={styles.storeRevenue} numberOfLines={1}>
                  {formatPrice(revenue)} · 30 days
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.mute} />
          </TouchableOpacity>
        )}

        {(pendingOrders ?? 0) > 0 && (
          <TouchableOpacity
            style={styles.attention}
            onPress={() => router.push("/(seller)/orders" as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={styles.attentionAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attentionKicker}>Needs attention</Text>
              <Text style={styles.attentionTitle}>
                {pendingOrders} pending {pendingOrders === 1 ? "order" : "orders"}
              </Text>
            </View>
            <Text style={styles.attentionLink}>Open</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Frequent</Text>
        <SellerShortcutGrid
          items={[
            {
              key: "analytics",
              label: "Analytics",
              icon: "bar-chart-outline",
              onPress: () => router.push("/(seller)/analytics" as any),
            },
            {
              key: "returns",
              label: "Returns",
              icon: "return-down-back-outline",
              badge: returnsCount && returnsCount > 0 ? returnsCount : null,
              tone: returnsCount && returnsCount > 0 ? "warn" : "default",
              onPress: () => router.push("/(seller)/returns" as any),
            },
            {
              key: "payouts",
              label: "Payouts",
              icon: "wallet-outline",
              onPress: () => router.push("/(seller)/payouts" as any),
            },
            {
              key: "alerts",
              label: "Alerts",
              icon: "notifications-outline",
              badge: unread > 0 ? unread : null,
              tone: unread > 0 ? "critical" : "default",
              onPress: () => router.push("/(seller)/notifications" as any),
            },
          ]}
        />

        <Text style={[styles.sectionTitle, { marginTop: spacing[5] }]}>Everything else</Text>
        <SellerPanel>
          {tools.map((item, i) => {
            const last = i === tools.length - 1;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.row, last && styles.rowLast]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={18} color={colors.olive[800]} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                {item.badge != null && item.badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge > 99 ? "99+" : item.badge}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={colors.ink.mute} />
                )}
              </TouchableOpacity>
            );
          })}
        </SellerPanel>

        <TouchableOpacity style={styles.signOut} onPress={() => void signOut()} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={SELLER_RUST} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SELLER_CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: sellerBorder,
    padding: spacing[4],
    minHeight: 84,
  },
  logo: { width: 52, height: 52, borderRadius: 16 },
  monogram: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.olive[800],
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: SELLER_CREAM,
  },
  storeInfo: { flex: 1, gap: 2 },
  storeName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.md,
    color: SELLER_INK,
  },
  storeMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
  },
  storeRevenue: {
    marginTop: 2,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.olive[700],
    letterSpacing: 0.2,
  },
  attention: {
    marginTop: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f1e3",
    borderRadius: radii.xl,
    overflow: "hidden",
    paddingVertical: 14,
    paddingRight: 14,
    minHeight: 56,
  },
  attentionAccent: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: colors.accent2.ochre,
    marginRight: 12,
  },
  attentionKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
    color: "#8a6a2a",
  },
  attentionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: SELLER_INK,
  },
  attentionLink: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },
  sectionTitle: {
    marginTop: spacing[5],
    marginBottom: 12,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: sellerBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: SELLER_INK,
  },
  rowSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.olive[800],
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: SELLER_CREAM,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
  },
  signOut: {
    marginTop: spacing[6],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    minHeight: 50,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.25)",
    backgroundColor: "rgba(184,92,58,0.06)",
  },
  signOutText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: SELLER_RUST,
  },
});
