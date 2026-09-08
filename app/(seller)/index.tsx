import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerKPIs, getSellerProducts, getSellerNotifications, createSellerStore, getSellerPayoutSettings, getSellerComplianceDocuments } from "@/lib/api";
import { getSellerAccessState } from "@/lib/seller-access";
import { colors, typography, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, pluralize } from "@/lib/utils";
import { formatNotificationBody, isNotificationUnread } from "@/lib/notifications/seller-inbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RevenueChart } from "@/components/seller/RevenueChart";
import {
  SellerStatusPill,
  SELLER_GOLD,
  SELLER_RUST,
  SELLER_CREAM,
} from "@/components/seller/chrome";
import { SellerBentoGrid } from "@/components/seller/SellerBentoGrid";
import { orderStatusTone } from "@/lib/seller/status-tones";
import { SELLER_DASHBOARD_ACTIONS } from "@/lib/seller/dashboard-actions";
import { formatOrderStatusLabel } from "@/lib/orders/seller-list";
import type { Store, Order, Product, Notification } from "@/lib/types";

const GOLD = SELLER_GOLD;
const RUST = SELLER_RUST;
const CREAM = SELLER_CREAM;

interface KPIData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  returnsCount: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  totalSkus: number;
  recentOrders: Order[];
  topProducts: Array<{ id: string; name: string; revenue: number }>;
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  revenueDelta: number;
  aov: number;
  analyticsReady: boolean;
  inventoryReady: boolean;
  productsReady: boolean;
  ordersReady: boolean;
  pendingReady: boolean;
  returnsReady: boolean;
}

function pickLookbook(
  products: Product[],
  analyticsTop: Array<{ id: string; name: string; revenue: number }>,
): Product[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const fromAnalytics = analyticsTop
    .map((t) => byId.get(t.id))
    .filter((p): p is Product => Boolean(p));
  if (fromAnalytics.length > 0) return fromAnalytics.slice(0, 5);
  return [...products]
    .sort((a, b) => (b.total_sales ?? 0) - (a.total_sales ?? 0))
    .slice(0, 5);
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatBadgeCount(n: number) {
  if (n > 99) return "99+";
  return String(n);
}

function describeStock(out: number, low: number, healthy: number, total: number) {
  if (out > 0) {
    return {
      value: out,
      sub: out === 1 ? "SKU out of stock" : "SKUs out of stock",
      heroLabel: "Restock",
      tone: "critical" as const,
    };
  }
  if (low > 0) {
    return {
      value: low,
      sub: "Running low",
      heroLabel: "Low stock",
      tone: "warn" as const,
    };
  }
  if (total > 0) {
    return {
      value: healthy,
      sub: healthy === total ? "All in stock" : "Healthy stock",
      heroLabel: "In stock",
      tone: "ok" as const,
    };
  }
  return {
    value: 0,
    sub: "No SKUs yet",
    heroLabel: "Stock",
    tone: "muted" as const,
  };
}

const QUICK_ACTIONS = SELLER_DASHBOARD_ACTIONS;

function formatHeroRevenue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    const digits = millions >= 10 ? 1 : 2;
    return `LKR ${millions.toFixed(digits)}M`;
  }
  if (abs >= 100_000) {
    return `LKR ${(value / 1_000).toFixed(0)}K`;
  }
  return formatPrice(value);
}

export default function SellerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Store | null>(null);
  const [accessBlocked, setAccessBlocked] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatingStore, setCreatingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreSlug, setNewStoreSlug] = useState("");
  const [newStoreDescription, setNewStoreDescription] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (!storeRes.ok) {
      setLoadError(storeRes.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError(null);
    if (storeRes.data) {
      const payoutRes = await getSellerPayoutSettings(storeRes.data.id);
      const docsRes = await getSellerComplianceDocuments(storeRes.data.id);
      const access = getSellerAccessState(
        storeRes.data as Store & Record<string, unknown>,
        payoutRes.ok ? payoutRes.data : null,
        docsRes.ok ? docsRes.data : null
      );
      if (!access.canAccessSellerTools) {
        setAccessBlocked(access.lockReason);
        setStore(storeRes.data);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setAccessBlocked(null);
      setStore(storeRes.data);
      const [kpiRes, prodRes, notifRes] = await Promise.all([
        getSellerKPIs(storeRes.data.id),
        getSellerProducts(storeRes.data.id, { sort: "sales_desc", limit: 8 }),
        getSellerNotifications(50),
      ]);
      if (kpiRes.ok) setKpis(kpiRes.data);
      if (prodRes.ok) setProducts(prodRes.data.products);
      if (notifRes.ok) setNotifications(notifRes.data);
    } else {
      setStore(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      if (store) {
        setRefreshing(true);
        fetchData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store?.id]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleCreateStore = async () => {
    if (!user) return;
    if (!newStoreName.trim()) {
      Alert.alert("Store name required", "Enter a name for your store to continue.");
      return;
    }
    setCreatingStore(true);
    const res = await createSellerStore(user.id, {
      name: newStoreName,
      slug: newStoreSlug || undefined,
      description: newStoreDescription || undefined,
    });
    setCreatingStore(false);
    if (res.ok) {
      setLoading(true);
      fetchData();
    } else {
      Alert.alert(
        "Could not create store",
        `${res.error}\n\nCheck the name is unique, the slug contains only letters, numbers, and dashes, then try again.`,
        [
          { text: "Retry", onPress: () => handleCreateStore() },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  let today: string;
  try {
    today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    today = new Date().toDateString();
  }

  const analyticsReady = kpis?.analyticsReady === true;
  const inventoryReady = kpis?.inventoryReady === true;
  const productsReady = kpis?.productsReady === true;
  const totalSkus = kpis?.inventoryReady ? kpis.totalSkus : 0;
  const lowStockCount = kpis?.inventoryReady ? kpis.lowStockVariants : 0;
  const outOfStockCount = kpis?.inventoryReady ? kpis.outOfStockVariants : 0;
  const healthyCount = Math.max(0, totalSkus - lowStockCount - outOfStockCount);
  const inventoryIssues = inventoryReady ? outOfStockCount + lowStockCount : 0;
  const stock = describeStock(outOfStockCount, lowStockCount, healthyCount, totalSkus);
  // Pending orders and returns come from their own endpoints, so they must
  // not be hidden just because the analytics call failed. Show "—" (null)
  // when those subcalls failed — never fake a zero.
  const pendingOrders = kpis?.pendingReady ? kpis.pendingOrders : null;
  const returnsCount = kpis?.returnsReady ? kpis.returnsCount : null;
  const ordersNeedWork = pendingOrders != null && pendingOrders > 0;
  const totalOrders = analyticsReady ? kpis!.totalOrders : null;
  const totalRevenue = analyticsReady ? kpis!.totalRevenue : null;
  // The analytics endpoint reports a percentage change against the
  // preceding window of equal length.
  const revenueDelta = analyticsReady ? kpis!.revenueDelta : 0;
  const revenueTrend =
    analyticsReady && Number.isFinite(revenueDelta) && Math.abs(revenueDelta) >= 0.5
      ? `${revenueDelta > 0 ? "+" : ""}${revenueDelta.toFixed(0)}%`
      : null;
  const totalProducts = productsReady ? kpis!.totalProducts : (products.length > 0 ? products.length : null);
  const storeIsLive = store?.is_online === true;

  const topProducts = pickLookbook(products, kpis?.topProducts ?? []);
  const hasSales =
    (kpis?.topProducts ?? []).some((p) => (p.revenue ?? 0) > 0) ||
    topProducts.some((p) => (p.total_sales ?? 0) > 0);
  const unreadCount = notifications.filter(isNotificationUnread).length;
  const storeName = store?.name ?? user?.user_metadata?.full_name?.split(" ")[0] ?? "Partner";
  const monogram = (store?.name ?? user?.user_metadata?.full_name ?? "S")[0].toUpperCase();

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View style={[styles.hero, styles.loadingHero, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <View style={styles.loadingHeroRow}>
            <Skeleton width={140} height={10} borderRadius={4} />
            <Skeleton width={44} height={44} borderRadius={22} />
          </View>
          <Skeleton width={160} height={14} />
          <Skeleton width={220} height={32} />
          <Skeleton width={180} height={40} style={{ marginTop: 16 }} />
          <Skeleton height={48} borderRadius={radii.full} style={{ marginTop: 20 }} />
        </View>
        <View style={[styles.section, styles.bodyStart]}>
          <Skeleton width={72} height={10} />
          <Skeleton height={96} borderRadius={radii["2xl"]} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  if (loadError && !store) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.onboardingContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      >
        <View style={styles.onboardingCard}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.olive[700]} />
          <Text style={styles.onboardingTitle}>Couldn’t load the atelier</Text>
          <Text style={styles.onboardingSub}>{loadError}</Text>
          <TouchableOpacity style={styles.onboardingButton} onPress={onRefresh}>
            <Text style={styles.onboardingButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (!store) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.onboardingContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.onboardingCard}>
          <Ionicons name="storefront-outline" size={40} color={colors.olive[700]} />
          <Text style={styles.onboardingTitle}>Set up your maison</Text>
          <Text style={styles.onboardingSub}>
            Create your seller profile to list pieces, manage orders, and track earnings.
          </Text>

          <Text style={styles.onboardingLabel}>Store name</Text>
          <TextInput
            style={styles.onboardingInput}
            value={newStoreName}
            onChangeText={setNewStoreName}
            placeholder="e.g. Aura Boutique"
            placeholderTextColor={colors.light.mutedForeground}
          />

          <Text style={styles.onboardingLabel}>Store URL slug (optional)</Text>
          <TextInput
            style={styles.onboardingInput}
            value={newStoreSlug}
            onChangeText={setNewStoreSlug}
            placeholder="aura-boutique"
            autoCapitalize="none"
            placeholderTextColor={colors.light.mutedForeground}
          />

          <Text style={styles.onboardingLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.onboardingInput, styles.onboardingTextArea]}
            value={newStoreDescription}
            onChangeText={setNewStoreDescription}
            placeholder="Tell shoppers what you sell"
            multiline
            placeholderTextColor={colors.light.mutedForeground}
          />

          <TouchableOpacity
            style={[styles.onboardingButton, creatingStore && { opacity: 0.6 }]}
            onPress={handleCreateStore}
            disabled={creatingStore}
          >
            <Text style={styles.onboardingButtonText}>
              {creatingStore ? "Creating…" : "Open the atelier"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (accessBlocked) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.onboardingContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
      >
        <View style={styles.onboardingCard}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.olive[700]} />
          <Text style={styles.onboardingTitle}>Seller tools locked</Text>
          <Text style={styles.onboardingSub}>{accessBlocked}</Text>
          <TouchableOpacity
            style={styles.onboardingButton}
            onPress={() => router.push("/(seller)/more" as any)}
          >
            <Text style={styles.onboardingButtonText}>Open store settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={["#f5f4ef", "#faf8f1", "#efece2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={["rgba(83,94,44,0.10)", "transparent", "rgba(83,94,44,0.05)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={[styles.heroContent, { paddingTop: Math.max(insets.top, 20) + 4 }]}>
          <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

          <View style={styles.heroTop}>
            <View style={styles.heroHeaderLeft}>
              <Text style={styles.heroDate}>{today.toUpperCase()}</Text>
            </View>
            <View style={styles.heroHeaderRight}>
              <TouchableOpacity
                style={[styles.liveTag, !storeIsLive && styles.liveTagOff]}
                onPress={() => router.push("/(seller)/settings" as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={storeIsLive ? "Store is live. Open settings" : "Store is offline. Open settings"}
              >
                <View style={[styles.liveDot, !storeIsLive && styles.liveDotOff]} />
                <Text style={styles.liveText}>{storeIsLive ? "Live" : "Offline"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => router.push("/(seller)/notifications" as any)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
                }
              >
                <Ionicons name="notifications-outline" size={18} color={colors.olive[800]} />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{formatBadgeCount(unreadCount)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.storeBrandingRow}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.storeLogo} contentFit="cover" />
            ) : (
              <View style={styles.storeMonogram}>
                <Text style={styles.storeMonogramText}>{monogram}</Text>
              </View>
            )}
            <View style={styles.greetingWrap}>
              <Text style={styles.heroGreeting}>{greeting}</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.ledgerCard}
            onPress={() => router.push("/(seller)/analytics" as any)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`Revenue ${totalRevenue == null ? "unavailable" : formatPrice(totalRevenue)}`}
          >
            <View style={styles.ledgerCardTop}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <Text style={styles.ledgerKicker}>Revenue · 30 days</Text>
                <Text
                  style={styles.ledgerValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {formatHeroRevenue(totalRevenue)}
                </Text>
              </View>
              {analyticsReady && (kpis?.revenueSeries?.length ?? 0) > 1 ? (
                <RevenueChart
                  compact
                  height={48}
                  points={kpis!.revenueSeries}
                  style={styles.ledgerSpark}
                />
              ) : (
                <View style={styles.ledgerSparkPlaceholder}>
                  <Ionicons name="trending-up" size={18} color={GOLD} />
                </View>
              )}
            </View>
            <Text style={styles.ledgerHint} numberOfLines={2}>
              {!analyticsReady
                ? "Analytics unavailable — pull to refresh"
                : (totalRevenue ?? 0) > 0
                  ? revenueTrend
                    ? `${revenueTrend} vs prior period · Insights`
                    : "Open full analytics"
                  : "Your first sale will appear here"}
            </Text>
          </TouchableOpacity>

          <View style={styles.heroMetaRow}>
            <TouchableOpacity
              style={styles.heroMetaItem}
              onPress={() => router.push("/(seller)/orders" as any)}
              accessibilityRole="button"
              accessibilityLabel={`${totalOrders ?? 0} orders`}
            >
              <Text style={[styles.heroMetaValue, ordersNeedWork && { color: "#9a6b1f" }]}>
                {ordersNeedWork ? pendingOrders : totalOrders ?? "—"}
              </Text>
              <Text style={styles.heroMetaLabel}>{ordersNeedWork ? "Pending" : "Orders"}</Text>
            </TouchableOpacity>
            <View style={styles.heroMetaRule} />
            <TouchableOpacity
              style={styles.heroMetaItem}
              onPress={() => router.push("/(seller)/products" as any)}
              accessibilityRole="button"
              accessibilityLabel={`${totalProducts ?? 0} products`}
            >
              <Text style={styles.heroMetaValue}>{totalProducts ?? "—"}</Text>
              <Text style={styles.heroMetaLabel}>Listed</Text>
            </TouchableOpacity>
            <View style={styles.heroMetaRule} />
            <TouchableOpacity
              style={styles.heroMetaItem}
              onPress={() => router.push("/(seller)/inventory" as any)}
              accessibilityRole="button"
              accessibilityLabel={inventoryReady ? `${stock.value} ${stock.heroLabel}` : "Stock unavailable"}
            >
              <Text
                style={[
                  styles.heroMetaValue,
                  inventoryReady && stock.tone === "critical" && { color: RUST },
                  inventoryReady && stock.tone === "warn" && { color: "#9a6b1f" },
                ]}
              >
                {inventoryReady ? stock.value : "—"}
              </Text>
              <Text style={styles.heroMetaLabel}>{inventoryReady ? stock.heroLabel : "Stock"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroActions}>
            {ordersNeedWork ? (
              <>
                <TouchableOpacity
                  style={styles.heroBtnPrimary}
                  onPress={() => router.push("/(seller)/orders" as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Process ${pendingOrders} pending orders`}
                >
                  <Text style={styles.heroBtnPrimaryText}>Process orders</Text>
                  <View style={styles.heroBtnCount}>
                    <Text style={styles.heroBtnCountText}>{formatBadgeCount(pendingOrders ?? 0)}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.heroBtnGhost}
                  onPress={() => router.push("/(seller)/products/new" as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Add product"
                >
                  <Text style={styles.heroBtnGhostText}>Add product</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.heroBtnPrimary}
                  onPress={() => router.push("/(seller)/products/new" as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Add product"
                >
                  <Text style={styles.heroBtnPrimaryText}>Add product</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.heroBtnGhost}
                  onPress={() => router.push("/(seller)/orders" as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="View orders"
                >
                  <Text style={styles.heroBtnGhostText}>View orders</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.bodySheet}>
      {inventoryIssues > 0 && (
        <TouchableOpacity
          style={styles.alertRibbon}
          onPress={() => router.push("/(seller)/inventory" as any)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            outOfStockCount > 0
              ? `${outOfStockCount} SKUs out of stock`
              : `${lowStockCount} SKUs running low`
          }
        >
          <View style={styles.alertAccent} />
          <View style={styles.alertContent}>
            <Text style={styles.alertKicker}>Stock alert</Text>
            <Text style={styles.alertTitle}>
              {outOfStockCount > 0 ? "Collection needs restocking" : "A few SKUs are running low"}
            </Text>
            <Text style={styles.alertSub}>
              {outOfStockCount > 0 && `${outOfStockCount} ${pluralize(outOfStockCount, "SKU")} out of stock`}
              {outOfStockCount > 0 && lowStockCount > 0 ? "  ·  " : ""}
              {lowStockCount > 0 && `${lowStockCount} running low`}
            </Text>
          </View>
          <Text style={styles.alertLink}>Manage</Text>
        </TouchableOpacity>
      )}

      {(returnsCount ?? 0) > 0 && (
        <TouchableOpacity
          style={[styles.alertRibbon, inventoryIssues > 0 && styles.alertRibbonFollow]}
          onPress={() => router.push("/(seller)/returns" as any)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${returnsCount} returns awaiting decision`}
        >
          <View style={[styles.alertAccent, { backgroundColor: RUST }]} />
          <View style={styles.alertContent}>
            <Text style={styles.alertKicker}>Returns</Text>
            <Text style={styles.alertTitle}>
              {returnsCount} {pluralize(returnsCount ?? 0, "return")} waiting
            </Text>
            <Text style={styles.alertSub}>Approve, receive, or refund</Text>
          </View>
          <Text style={styles.alertLink}>Review</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.section, inventoryIssues === 0 && (returnsCount ?? 0) === 0 && styles.bodyStart]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>Tools</Text>
            <Text style={styles.sectionTitle}>Quick actions</Text>
          </View>
        </View>

        <SellerBentoGrid
          items={QUICK_ACTIONS.map((a) => {
            const hasAlertBadge = a.badgeKey === "alerts" && unreadCount > 0;
            const hasReturnsBadge = a.badgeKey === "returns" && (returnsCount ?? 0) > 0;
            return {
              key: a.key,
              label: a.label,
              hint: a.hint,
              icon: a.icon,
              onPress: () => router.push(a.route as any),
              badge: hasAlertBadge ? unreadCount : hasReturnsBadge ? returnsCount : null,
              tone: hasAlertBadge ? ("critical" as const) : hasReturnsBadge ? ("warn" as const) : ("default" as const),
            };
          })}
        />
      </View>

      {totalSkus > 0 && inventoryIssues > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>Stock room</Text>
              <Text style={styles.sectionTitle}>Needs restock</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(seller)/inventory" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Manage inventory"
            >
              <Text style={styles.sectionLink}>Manage</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.panel}
            onPress={() => router.push("/(seller)/inventory" as any)}
            activeOpacity={0.85}
          >
            <View style={styles.stockStats}>
              <View style={styles.stockStat}>
                <Text style={[styles.stockStatValue, { color: "#9a6b1f" }]}>{lowStockCount}</Text>
                <Text style={styles.stockStatLabel}>Low</Text>
              </View>
              <View style={styles.panelRule} />
              <View style={styles.stockStat}>
                <Text style={[styles.stockStatValue, { color: RUST }]}>{outOfStockCount}</Text>
                <Text style={styles.stockStatLabel}>Out</Text>
              </View>
              <View style={styles.panelRule} />
              <View style={styles.stockStat}>
                <Text style={styles.stockStatValue}>{totalSkus}</Text>
                <Text style={styles.stockStatLabel}>SKUs</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {topProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>{hasSales ? "Lookbook" : "Collection"}</Text>
              <Text style={styles.sectionTitle}>{hasSales ? "Bestsellers" : "Your pieces"}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(seller)/products" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sectionLink}>All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            {topProducts.map((p, i) => {
              const img = p.images?.find((image) => image.is_primary)?.url || p.images?.[0]?.url;
              const last = i === topProducts.length - 1;
              const analyticsHit = (kpis?.topProducts ?? []).find((t) => t.id === p.id);
              const sold = p.total_sales ?? 0;
              const meta = analyticsHit && analyticsHit.revenue > 0
                ? formatPrice(analyticsHit.revenue)
                : sold > 0
                ? `${sold} sold`
                : typeof p.price === "number" && p.price > 0
                ? formatPrice(p.price)
                : "—";
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.lookRow, last && styles.lookRowLast]}
                  onPress={() => router.push(`/(seller)/products/${p.id}` as any)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.lookRank}>{String(i + 1).padStart(2, "0")}</Text>
                  <View style={styles.lookImage}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.lookImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.lookImg, styles.lookImgEmpty]}>
                        <Ionicons name="image-outline" size={16} color={colors.light.mutedForeground} />
                      </View>
                    )}
                  </View>
                  <View style={styles.lookInfo}>
                    <Text style={styles.lookName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.lookMeta}>{meta}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>Ledger</Text>
            <Text style={styles.sectionTitle}>Recent orders</Text>
          </View>
          {typeof totalOrders === "number" && totalOrders > 0 && (
            <TouchableOpacity
              onPress={() => router.push("/(seller)/orders" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="View all orders"
            >
              <Text style={styles.sectionLink}>All</Text>
            </TouchableOpacity>
          )}
        </View>

        {kpis?.ordersReady && kpis.recentOrders.length > 0 ? (
          <View style={styles.panel}>
            {kpis.recentOrders.map((o, i) => {
              const sc = orderStatusTone(o.status);
              const itemsCount = o.items?.reduce((s, item) => s + item.quantity, 0) ?? 0;
              const last = i === kpis.recentOrders.length - 1;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.ledgerRow, last && styles.lookRowLast]}
                  onPress={() => router.push(`/(seller)/orders/${o.id}` as any)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${o.order_number}, ${o.status}`}
                >
                  <View style={styles.orderInfo}>
                    <View style={styles.orderNumberRow}>
                      <Text style={styles.orderNumber}>{o.order_number}</Text>
                      <SellerStatusPill
                        label={formatOrderStatusLabel(o.status)}
                        bg={sc.bg}
                        color={sc.text}
                        dotted={o.status === "pending"}
                      />
                    </View>
                    <Text style={styles.orderMeta}>
                      {itemsCount} {pluralize(itemsCount, "item")}  ·  {formatRelative(o.placed_at)}
                    </Text>
                  </View>
                  <Text style={styles.orderTotal}>{formatPrice(o.total)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : kpis?.ordersReady ? (
          <EmptyState
            icon="bag-handle-outline"
            title="No orders yet"
            description="New commissions will appear here the moment a customer checks out."
          />
        ) : null}
      </View>

      {notifications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>Correspondence</Text>
              <Text style={styles.sectionTitle}>Activity</Text>
            </View>
            {unreadCount > 0 ? (
              <TouchableOpacity
                style={styles.unreadBadge}
                onPress={() => router.push("/(seller)/notifications" as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`${unreadCount} new notifications`}
              >
                <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/(seller)/notifications" as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.sectionLink}>All</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.panel}>
            {notifications.slice(0, 5).map((n, i) => {
              const isUnread = isNotificationUnread(n);
              const last = i === Math.min(notifications.length, 5) - 1;
              const preview = formatNotificationBody(n.body, n.data);
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.notifRow, last && styles.lookRowLast]}
                  onPress={() => router.push("/(seller)/notifications" as any)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={n.title}
                >
                  <View style={[styles.notifMark, isUnread && styles.notifMarkUnread]} />
                  <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {preview ? (
                      <Text style={styles.notifBody} numberOfLines={2}>{preview}</Text>
                    ) : null}
                    <Text style={styles.notifTime}>{formatRelative(n.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ height: 48 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { paddingBottom: 120 },

  onboardingContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing[5],
    paddingBottom: 120,
  },
  onboardingCard: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.28)",
    padding: spacing[6],
    gap: spacing[2],
  },
  onboardingTitle: {
    fontSize: typography.fontSizes["2xl"],
    fontFamily: fontFamilies.display.semibold,
    color: colors.light.foreground,
    marginTop: spacing[2],
  },
  onboardingSub: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 20,
    marginBottom: spacing[3],
  },
  onboardingLabel: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.medium,
    color: colors.light.foreground,
    marginTop: spacing[2],
  },
  onboardingInput: {
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: spacing[3],
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  onboardingTextArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  onboardingButton: {
    backgroundColor: colors.olive[800],
    borderRadius: radii.full,
    paddingVertical: spacing[4],
    alignItems: "center",
    marginTop: spacing[4],
  },
  onboardingButtonText: {
    color: CREAM,
    fontSize: typography.fontSizes.base,
    fontFamily: fontFamilies.sans.semibold,
  },

  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginBottom: spacing[5],
  },
  goldRuleLight: {
    backgroundColor: "rgba(200,164,74,0.4)",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#f5f4ef",
  },
  heroContent: {
    position: "relative",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
  loadingHero: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[7],
    gap: spacing[3],
  },
  loadingHeroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[4],
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[5],
  },
  heroHeaderLeft: { gap: 4, flex: 1, paddingRight: 12 },
  heroDate: {
    fontSize: 11,
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.4,
  },
  heroKicker: {
    fontSize: 11,
    color: GOLD,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heroHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(83,94,44,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    minHeight: 36,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.22)",
  },
  liveTagOff: {
    backgroundColor: "rgba(22,23,15,0.05)",
    borderColor: "rgba(22,23,15,0.12)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  liveDotOff: {
    backgroundColor: "rgba(22,23,15,0.30)",
  },
  liveText: {
    fontSize: 11,
    color: colors.olive[950],
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.8,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: RUST,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: CREAM,
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
  },
  storeBrandingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  storeLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(200,164,74,0.55)",
  },
  storeMonogram: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  storeMonogramText: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[800],
  },
  greetingWrap: { flex: 1, minWidth: 0 },
  heroGreeting: {
    fontSize: 14,
    color: colors.ink.mute,
    fontFamily: fontFamilies.display.italic,
  },
  heroName: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[950],
    marginTop: 1,
    letterSpacing: -0.4,
  },
  ledgerCard: {
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: radii["2xl"],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    marginBottom: spacing[4],
  },
  ledgerCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ledgerSpark: {
    opacity: 0.95,
  },
  ledgerSparkPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  ledgerKicker: {
    fontSize: 10,
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  ledgerValue: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[950],
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  ledgerHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink.mute,
    fontFamily: fontFamilies.sans.regular,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: "rgba(83,94,44,0.06)",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  heroMetaItem: {
    flex: 1,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  heroMetaValue: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[950],
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  heroMetaLabel: {
    marginTop: 3,
    fontSize: 10,
    color: colors.ink.mute,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  heroMetaRule: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: "rgba(83,94,44,0.18)",
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  heroBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.olive[900],
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    ...shadows.soft,
  },
  heroBtnPrimaryText: {
    color: CREAM,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
    letterSpacing: 0.15,
  },
  heroBtnCount: {
    backgroundColor: CREAM,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  heroBtnCountText: {
    color: colors.olive[900],
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
  },
  heroBtnGhost: {
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.22)",
    backgroundColor: SELLER_CREAM,
  },
  heroBtnGhostText: {
    color: colors.olive[900],
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.2,
  },
  heroGoldEdge: {
    height: 2,
    backgroundColor: GOLD,
  },
  bodySheet: {
    backgroundColor: colors.paper.DEFAULT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    paddingTop: spacing[2],
    minHeight: 120,
  },

  alertRibbon: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.18)",
    minHeight: 76,
    ...shadows.soft,
  },
  alertRibbonFollow: {
    marginTop: spacing[3],
  },
  alertAccent: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: RUST,
  },
  alertContent: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  alertKicker: {
    fontSize: 10,
    color: RUST,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  alertTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.display.semibold,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.2,
  },
  alertSub: {
    fontSize: 13,
    color: colors.ink.mute,
    marginTop: 3,
    lineHeight: 18,
  },
  alertLink: {
    paddingRight: spacing[4],
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: RUST,
  },

  section: {
    paddingLeft: spacing[5],
    marginTop: spacing[6],
  },
  bodyStart: {
    marginTop: spacing[5],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing[3],
    paddingRight: spacing[5],
  },
  sectionKicker: {
    fontSize: 10,
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fontFamilies.display.semibold,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
    color: colors.olive[800],
  },

  opsRail: {
    gap: 10,
    paddingRight: spacing[5],
    paddingBottom: 4,
  },
  opsTile: {
    width: 84,
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    minHeight: 88,
  },
  opsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  opsTileBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.olive[800],
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: CREAM,
  },
  opsTileLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[900],
    textAlign: "center",
  },
  opsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.full,
    minHeight: 44,
  },
  opsPillLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[800],
  },
  opsPillBadge: {
    backgroundColor: colors.olive[800],
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  opsPillBadgeText: {
    color: CREAM,
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
  },

  panel: {
    marginRight: spacing[5],
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    paddingHorizontal: spacing[4],
    ...shadows.soft,
  },
  panelRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(83,94,44,0.16)",
  },

  stockStats: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing[4],
  },
  stockStat: {
    flex: 1,
    alignItems: "center",
  },
  stockStatValue: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    color: colors.ink.DEFAULT,
  },
  stockStatLabel: {
    fontSize: 11,
    color: colors.ink.mute,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 4,
  },
  stockBar: {
    flexDirection: "row",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: colors.olive[50],
    marginBottom: spacing[3],
  },
  stockBarFill: {
    height: "100%",
  },
  stockLegend: {
    flexDirection: "row",
    gap: spacing[4],
    paddingBottom: spacing[4],
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 11,
    color: colors.ink.mute,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  lookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.12)",
    minHeight: 72,
  },
  lookRowLast: {
    borderBottomWidth: 0,
  },
  lookRank: {
    width: 28,
    fontSize: 13,
    fontFamily: fontFamilies.display.semibold,
    color: GOLD,
  },
  lookImage: {
    width: 56,
    height: 72,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.olive[50],
  },
  lookImg: {
    width: "100%",
    height: "100%",
  },
  lookImgEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  lookInfo: { flex: 1 },
  lookName: {
    fontSize: 16,
    fontFamily: fontFamilies.display.regular,
    color: colors.ink.DEFAULT,
  },
  lookMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.ink.mute,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.4,
  },

  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.12)",
    minHeight: 64,
  },
  orderInfo: { flex: 1 },
  orderNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  orderNumber: {
    fontSize: 14,
    fontFamily: fontFamilies.mono.semibold,
    color: colors.ink.DEFAULT,
    letterSpacing: 0.3,
  },
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  orderStatusText: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  orderMeta: {
    fontSize: 12,
    color: colors.ink.mute,
    marginTop: 4,
  },
  orderTotal: {
    fontSize: 15,
    fontFamily: fontFamilies.display.semibold,
    color: colors.ink.DEFAULT,
  },

  unreadBadge: {
    backgroundColor: colors.olive[800],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  unreadBadgeText: {
    color: CREAM,
    fontSize: 11,
    fontFamily: fontFamilies.sans.semibold,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.12)",
  },
  notifMark: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
    marginTop: 7,
  },
  notifMarkUnread: {
    backgroundColor: GOLD,
  },
  notifContent: { flex: 1 },
  notifTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.sans.regular,
    color: colors.ink.DEFAULT,
  },
  notifTitleUnread: {
    fontFamily: fontFamilies.sans.semibold,
  },
  notifBody: {
    fontSize: 13,
    color: colors.ink.mute,
    marginTop: 3,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    color: colors.ink.mute,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.6,
    marginTop: 6,
  },

  emptyCard: {
    marginRight: spacing[5],
    alignItems: "flex-start",
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[5],
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
  },
  emptyKicker: {
    fontSize: 11,
    color: GOLD,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: spacing[2],
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    color: colors.ink.DEFAULT,
  },
  emptySub: {
    marginTop: spacing[2],
    fontSize: 14,
    color: colors.ink.mute,
    lineHeight: 21,
    maxWidth: 280,
  },
});
