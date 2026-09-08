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
          colors={["#FAF8F5", "#F5F2EA", "#ECE7DD"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={["rgba(200,164,74,0.07)", "transparent", "rgba(200,164,74,0.03)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={[styles.heroContent, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
          <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

          {/* 1. Top Status & Atelier Header */}
          <View style={styles.heroTop}>
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={11} color="#85651B" />
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
                <Text style={[styles.liveText, !storeIsLive && styles.liveTextOff]}>
                  {storeIsLive ? "Live" : "Offline"}
                </Text>
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
                <Ionicons name="notifications-outline" size={18} color="#141311" />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{formatBadgeCount(unreadCount)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Store Branding & Greeting */}
          <View style={styles.storeBrandingRow}>
            <View style={styles.storeAvatarBezel}>
              {store?.logo_url ? (
                <Image source={{ uri: store.logo_url }} style={styles.storeLogo} contentFit="cover" />
              ) : (
                <View style={styles.storeMonogram}>
                  <Text style={styles.storeMonogramText}>{monogram}</Text>
                </View>
              )}
              <View style={styles.avatarSparkleBadge}>
                <Ionicons name="sparkles" size={8} color="#C8A44A" />
              </View>
            </View>
            <View style={styles.greetingWrap}>
              <View style={styles.greetingRow}>
                <Text style={styles.heroGreeting}>{greeting}</Text>
                <View style={styles.maisonVerifiedPill}>
                  <Ionicons name="shield-checkmark" size={9} color="#85651B" />
                  <Text style={styles.maisonVerifiedText}>ATELIER</Text>
                </View>
              </View>
              <Text style={styles.heroName} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
          </View>

          {/* 3. Haute Horlogerie Treasury / Revenue Card */}
          <TouchableOpacity
            style={styles.ledgerCard}
            onPress={() => router.push("/(seller)/analytics" as any)}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel={`Revenue ${totalRevenue == null ? "unavailable" : formatPrice(totalRevenue)}`}
          >
            <LinearGradient
              colors={["#161513", "#1F1D19", "#100F0D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={["rgba(200,164,74,0.14)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 0.7 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            <View style={styles.ledgerCardHeader}>
              <View style={styles.ledgerKickerBadge}>
                <Ionicons name="sparkles" size={10} color="#C8A44A" />
                <Text style={styles.ledgerKickerText}>REVENUE · 30 DAYS</Text>
              </View>
              {revenueTrend ? (
                <View style={styles.trendBadge}>
                  <Ionicons
                    name={revenueDelta >= 0 ? "trending-up" : "trending-down"}
                    size={11}
                    color={revenueDelta >= 0 ? "#7D8B6F" : "#B85C3A"}
                  />
                  <Text
                    style={[
                      styles.trendText,
                      revenueDelta < 0 && styles.trendTextNegative,
                    ]}
                  >
                    {revenueTrend}
                  </Text>
                </View>
              ) : (
                <View style={styles.trendBadgeNeutral}>
                  <Text style={styles.trendTextNeutral}>30D WINDOW</Text>
                </View>
              )}
            </View>

            <View style={styles.ledgerCardMainRow}>
              <View style={styles.ledgerAmountCol}>
                <Text style={styles.ledgerValue} numberOfLines={1}>
                  {formatHeroRevenue(totalRevenue)}
                </Text>
              </View>

              <View style={styles.ledgerChartWrap}>
                {analyticsReady && (kpis?.revenueSeries?.length ?? 0) > 1 ? (
                  <RevenueChart
                    compact
                    height={46}
                    points={kpis!.revenueSeries}
                    style={styles.ledgerSpark}
                  />
                ) : (
                  <View style={styles.ledgerSparkPlaceholder}>
                    <Ionicons name="trending-up" size={18} color="#C8A44A" />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.ledgerDivider} />

            <View style={styles.ledgerFooterRow}>
              <Text style={styles.ledgerHint} numberOfLines={1}>
                {!analyticsReady
                  ? "Analytics syncing — pull to refresh"
                  : (totalRevenue ?? 0) > 0
                    ? revenueTrend
                      ? `${revenueTrend} vs prior period · Detailed ledger`
                      : "Open full financial insights"
                    : "Your first sale will appear here"}
              </Text>
              <View style={styles.ledgerArrowPill}>
                <Ionicons name="arrow-forward" size={11} color="#E8CF8F" />
              </View>
            </View>
          </TouchableOpacity>

          {/* 4. 3 Executive Metric Cards */}
          <View style={styles.metricsGrid}>
            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => router.push("/(seller)/orders" as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${totalOrders ?? 0} orders`}
            >
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIndicatorDot, ordersNeedWork && styles.metricIndicatorDotAmber]} />
                <Ionicons name="bag-check-outline" size={13} color="#85651B" />
              </View>
              <Text style={[styles.metricNumber, ordersNeedWork && styles.metricNumberAmber]}>
                {ordersNeedWork ? pendingOrders : totalOrders ?? "—"}
              </Text>
              <Text style={styles.metricLabel}>{ordersNeedWork ? "PENDING" : "ORDERS"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => router.push("/(seller)/products" as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${totalProducts ?? 0} products`}
            >
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIndicatorDot, { backgroundColor: "#141311" }]} />
                <Ionicons name="pricetag-outline" size={13} color="#6B675E" />
              </View>
              <Text style={styles.metricNumber}>{totalProducts ?? "—"}</Text>
              <Text style={styles.metricLabel}>LISTED</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => router.push("/(seller)/inventory" as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={inventoryReady ? `${stock.value} ${stock.heroLabel}` : "Stock unavailable"}
            >
              <View style={styles.metricTopRow}>
                <View
                  style={[
                    styles.metricIndicatorDot,
                    inventoryReady && stock.tone === "critical" && styles.metricIndicatorDotCritical,
                    inventoryReady && stock.tone === "warn" && styles.metricIndicatorDotAmber,
                  ]}
                />
                <Ionicons
                  name="cube-outline"
                  size={13}
                  color={inventoryReady && stock.tone === "critical" ? "#B85C3A" : "#6B675E"}
                />
              </View>
              <Text
                style={[
                  styles.metricNumber,
                  inventoryReady && stock.tone === "critical" && styles.metricNumberCritical,
                  inventoryReady && stock.tone === "warn" && styles.metricNumberAmber,
                ]}
              >
                {inventoryReady ? stock.value : "—"}
              </Text>
              <Text style={styles.metricLabel}>{inventoryReady ? stock.heroLabel.toUpperCase() : "STOCK"}</Text>
            </TouchableOpacity>
          </View>

          {/* 5. Primary Action Buttons */}
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
                  <LinearGradient
                    colors={["#24211D", "#141311"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroBtnPrimaryGradient}
                  >
                    <Ionicons name="flash" size={14} color="#C8A44A" />
                    <Text style={styles.heroBtnPrimaryText}>Process orders</Text>
                    <View style={styles.heroBtnBadge}>
                      <Text style={styles.heroBtnBadgeText}>
                        {formatBadgeCount(pendingOrders ?? 0)}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.heroBtnGhost}
                  onPress={() => router.push("/(seller)/products/new" as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Add product"
                >
                  <Ionicons name="add" size={16} color="#141311" />
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
                  <LinearGradient
                    colors={["#24211D", "#141311"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroBtnPrimaryGradient}
                  >
                    <Ionicons name="add" size={15} color="#C8A44A" />
                    <Text style={styles.heroBtnPrimaryText}>Add product</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.heroBtnGhost}
                  onPress={() => router.push("/(seller)/orders" as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="View orders"
                >
                  <Ionicons name="bag-check-outline" size={15} color="#141311" />
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

      {/* 01. Tools / Operations */}
      <View style={[styles.section, inventoryIssues === 0 && (returnsCount ?? 0) === 0 && styles.bodyStart]}>
        <View style={styles.sectionHeader}>
          <View>
            <View style={styles.sectionKickerBadge}>
              <Text style={styles.sectionKickerText}>01 · OPERATIONS</Text>
            </View>
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

      {/* 02. Public Boutique Storefront Banner */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.storefrontCard}
          onPress={() => {
            if (store?.slug || store?.id) {
              router.push(`/store/${store.slug || store.id}` as any);
            } else {
              Alert.alert("Storefront Inactive", "Your boutique storefront will be public once verified.");
            }
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={["#1A1815", "#141311"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.storefrontLeft}>
            <View style={styles.storefrontIconMedallion}>
              <Ionicons name="storefront-outline" size={18} color="#E8CF8F" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.storefrontKickerRow}>
                <Ionicons name="sparkles" size={9} color="#C8A44A" />
                <Text style={styles.storefrontKicker}>PATRON EXPERIENCE</Text>
              </View>
              <Text style={styles.storefrontTitle}>View Public Boutique</Text>
              <Text style={styles.storefrontSub}>
                Inspect your storefront as collectors see it on LUXE
              </Text>
            </View>
          </View>
          <View style={styles.storefrontArrow}>
            <Ionicons name="arrow-forward" size={13} color="#C8A44A" />
          </View>
        </TouchableOpacity>
      </View>

      {/* 03. Stock Room (if issues exist) */}
      {totalSkus > 0 && inventoryIssues > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <View style={styles.sectionKickerBadge}>
                <Text style={styles.sectionKickerText}>02 · INVENTORY</Text>
              </View>
              <Text style={styles.sectionTitle}>Needs restock</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(seller)/inventory" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Manage inventory"
            >
              <Text style={styles.sectionLink}>Manage →</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.panel}
            onPress={() => router.push("/(seller)/inventory" as any)}
            activeOpacity={0.85}
          >
            <View style={styles.stockStats}>
              <View style={styles.stockStat}>
                <Text style={[styles.stockStatValue, { color: "#85651B" }]}>{lowStockCount}</Text>
                <Text style={styles.stockStatLabel}>Low stock</Text>
              </View>
              <View style={styles.panelRule} />
              <View style={styles.stockStat}>
                <Text style={[styles.stockStatValue, { color: "#B85C3A" }]}>{outOfStockCount}</Text>
                <Text style={styles.stockStatLabel}>Out of stock</Text>
              </View>
              <View style={styles.panelRule} />
              <View style={styles.stockStat}>
                <Text style={styles.stockStatValue}>{totalSkus}</Text>
                <Text style={styles.stockStatLabel}>Total SKUs</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* 04. Lookbook / Bestsellers */}
      {topProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <View style={styles.sectionKickerBadge}>
                <Text style={styles.sectionKickerText}>
                  {hasSales ? "03 · CURATED LOOKBOOK" : "03 · ATELIER PIECES"}
                </Text>
              </View>
              <Text style={styles.sectionTitle}>{hasSales ? "Bestselling pieces" : "Your collection"}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(seller)/products" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sectionLink}>View all →</Text>
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
                  <View style={styles.lookRankBadge}>
                    <Text style={styles.lookRank}>{String(i + 1).padStart(2, "0")}</Text>
                  </View>
                  <View style={styles.lookImage}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.lookImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.lookImg, styles.lookImgEmpty]}>
                        <Ionicons name="image-outline" size={16} color="#A49E93" />
                      </View>
                    )}
                  </View>
                  <View style={styles.lookInfo}>
                    <Text style={styles.lookName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.lookMeta}>{meta}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#A49E93" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 05. Recent Orders / Ledger */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <View style={styles.sectionKickerBadge}>
              <Text style={styles.sectionKickerText}>04 · COMMISSIONS</Text>
            </View>
            <Text style={styles.sectionTitle}>Recent orders</Text>
          </View>
          {typeof totalOrders === "number" && totalOrders > 0 && (
            <TouchableOpacity
              onPress={() => router.push("/(seller)/orders" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="View all orders"
            >
              <Text style={styles.sectionLink}>All orders →</Text>
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
                  <View style={styles.orderRightCol}>
                    <Text style={styles.orderTotal}>{formatPrice(o.total)}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A49E93" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : kpis?.ordersReady ? (
          <EmptyState
            icon="bag-handle-outline"
            title="No orders yet"
            description="New commissions will appear here the moment a patron checks out."
          />
        ) : null}
      </View>

      {/* 06. Treasury & Payout Status Advisory */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.payoutCard}
          onPress={() => router.push("/(seller)/payouts" as any)}
          activeOpacity={0.85}
        >
          <View style={styles.payoutIconWrap}>
            <Ionicons name="wallet-outline" size={20} color="#85651B" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.payoutKickerRow}>
              <Text style={styles.payoutKicker}>TREASURY SETTLEMENT</Text>
            </View>
            <Text style={styles.payoutTitle}>Payouts & Bank Account</Text>
            <Text style={styles.payoutSub}>
              Direct deposit schedule, settlement ledger, and invoices
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#85651B" />
        </TouchableOpacity>
      </View>

      {/* 07. Correspondence / Activity */}
      {notifications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <View style={styles.sectionKickerBadge}>
                <Text style={styles.sectionKickerText}>05 · CORRESPONDENCE</Text>
              </View>
              <Text style={styles.sectionTitle}>Activity & updates</Text>
            </View>
            {unreadCount > 0 ? (
              <TouchableOpacity
                style={styles.unreadBadge}
                onPress={() => router.push("/(seller)/notifications" as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`${unreadCount} new notifications`}
              >
                <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/(seller)/notifications" as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.sectionLink}>View all →</Text>
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
                  <Ionicons name="chevron-forward" size={13} color="#A49E93" />
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
  /* Top Atelier Header */
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[4],
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  heroDate: {
    fontSize: 10,
    color: "#85651B",
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1.2,
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
    gap: 8,
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(76, 120, 60, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    minHeight: 34,
    borderWidth: 1,
    borderColor: "rgba(76, 120, 60, 0.25)",
  },
  liveTagOff: {
    backgroundColor: "rgba(20, 19, 17, 0.05)",
    borderColor: "rgba(20, 19, 17, 0.12)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4E8D42",
  },
  liveDotOff: {
    backgroundColor: "#8E8B82",
  },
  liveText: {
    fontSize: 11,
    color: "#2C5A23",
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.6,
  },
  liveTextOff: {
    color: "#6B675E",
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE7DF",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#C8A44A",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  notifBadgeText: {
    color: "#141311",
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
  },

  /* Store Branding & Greeting */
  storeBrandingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: spacing[4],
  },
  storeAvatarBezel: {
    position: "relative",
    padding: 2.5,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#C8A44A",
    backgroundColor: "#FAF8F5",
    ...shadows.soft,
  },
  storeLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  storeMonogram: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FAF8F5",
    alignItems: "center",
    justifyContent: "center",
  },
  storeMonogramText: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
  },
  avatarSparkleBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#141311",
    borderWidth: 1,
    borderColor: "#C8A44A",
    alignItems: "center",
    justifyContent: "center",
  },
  greetingWrap: { flex: 1, minWidth: 0, gap: 2 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroGreeting: {
    fontSize: 14,
    color: "#85651B",
    fontFamily: fontFamilies.display.italic,
  },
  maisonVerifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  maisonVerifiedText: {
    fontSize: 8,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.4,
  },

  /* Haute Horlogerie Treasury Card */
  ledgerCard: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2E2A24",
    padding: 18,
    marginBottom: 14,
    ...shadows.soft,
  },
  ledgerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  ledgerKickerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.28)",
  },
  ledgerKickerText: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#E8CF8F",
    letterSpacing: 1.4,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(125, 139, 111, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(125, 139, 111, 0.35)",
  },
  trendText: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: "#9BB386",
    letterSpacing: 0.4,
  },
  trendTextNegative: {
    color: "#E88D72",
  },
  trendBadgeNeutral: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  trendTextNeutral: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.medium,
    color: "#A49E93",
    letterSpacing: 0.8,
  },
  ledgerCardMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  ledgerAmountCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  ledgerValue: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fontFamilies.display.semibold,
    color: "#FAF8F5",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  ledgerChartWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ledgerSpark: {
    opacity: 0.95,
  },
  ledgerSparkPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.2)",
  },
  ledgerDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
  },
  ledgerFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ledgerHint: {
    flex: 1,
    fontSize: 11,
    color: "#A49E93",
    fontFamily: fontFamilies.sans.regular,
  },
  ledgerArrowPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },

  /* 3 Executive Metric Cards */
  metricsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    minHeight: 76,
    justifyContent: "space-between",
    ...shadows.soft,
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  metricIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#141311",
  },
  metricIndicatorDotAmber: {
    backgroundColor: "#C8A44A",
  },
  metricIndicatorDotCritical: {
    backgroundColor: "#B85C3A",
  },
  metricNumber: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  metricNumberAmber: {
    color: "#85651B",
  },
  metricNumberCritical: {
    color: "#B85C3A",
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: fontFamilies.mono.medium,
    color: "#8E8B82",
    letterSpacing: 1.1,
  },

  /* Action Buttons */
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroBtnPrimary: {
    flex: 1,
    borderRadius: radii.full,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    ...shadows.soft,
  },
  heroBtnPrimaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  heroBtnPrimaryText: {
    color: "#FAF8F5",
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
    letterSpacing: 0.2,
  },
  heroBtnBadge: {
    backgroundColor: "#C8A44A",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  heroBtnBadgeText: {
    color: "#141311",
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
  },
  heroBtnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    backgroundColor: "#FFFFFF",
    ...shadows.soft,
  },
  heroBtnGhostText: {
    color: "#141311",
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
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
    marginTop: spacing[4],
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.22)",
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
    paddingHorizontal: spacing[5],
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
  },
  sectionKickerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#F4F1EA",
    borderWidth: 1,
    borderColor: "#E5E0D5",
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  sectionKickerText: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
    color: "#85651B",
  },

  /* Public Storefront Banner */
  storefrontCard: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2E2A24",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    ...shadows.soft,
  },
  storefrontLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  storefrontIconMedallion: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  storefrontKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  storefrontKicker: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#E8CF8F",
    letterSpacing: 1.2,
  },
  storefrontTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.display.semibold,
    color: "#FAF8F5",
    letterSpacing: -0.2,
  },
  storefrontSub: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#A49E93",
    lineHeight: 16,
  },
  storefrontArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Treasury & Payout Status Advisory */
  payoutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...shadows.soft,
  },
  payoutIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F7F5EE",
    borderWidth: 1,
    borderColor: "#EAE7DF",
    alignItems: "center",
    justifyContent: "center",
  },
  payoutKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  payoutKicker: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.2,
  },
  payoutTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.2,
  },
  payoutSub: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#8E8B82",
    lineHeight: 16,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    paddingHorizontal: spacing[4],
    ...shadows.soft,
  },
  panelRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "#EAE7DF",
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
    fontSize: 24,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    fontVariant: ["tabular-nums"],
  },
  stockStatLabel: {
    fontSize: 10,
    color: "#8E8B82",
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 4,
  },

  lookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F4F1EA",
    minHeight: 74,
  },
  lookRowLast: {
    borderBottomWidth: 0,
  },
  lookRankBadge: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  lookRank: {
    fontSize: 12,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    fontVariant: ["tabular-nums"],
  },
  lookImage: {
    width: 50,
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F7F5EE",
    borderWidth: 1,
    borderColor: "#EAE7DF",
  },
  lookImg: {
    width: "100%",
    height: "100%",
  },
  lookImgEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F5EE",
  },
  lookInfo: { flex: 1, minWidth: 0, gap: 2 },
  lookName: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.semibold,
    color: "#141311",
  },
  lookMeta: {
    fontSize: 12,
    fontFamily: fontFamilies.mono.medium,
    color: "#85651B",
  },

  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F4F1EA",
  },
  orderInfo: { flex: 1, minWidth: 0, gap: 4 },
  orderNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderNumber: {
    fontSize: 13,
    fontFamily: fontFamilies.mono.semibold,
    color: "#141311",
  },
  orderMeta: {
    fontSize: 12,
    color: "#8E8B82",
    fontFamily: fontFamilies.sans.regular,
  },
  orderRightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderTotal: {
    fontSize: 15,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },

  unreadBadge: {
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  unreadBadgeText: {
    color: "#85651B",
    fontSize: 11,
    fontFamily: fontFamilies.mono.semibold,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F4F1EA",
  },
  notifMark: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#E5E0D5",
  },
  notifMarkUnread: {
    backgroundColor: "#C8A44A",
  },
  notifContent: { flex: 1, minWidth: 0, gap: 2 },
  notifTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.medium,
    color: "#6B675E",
  },
  notifTitleUnread: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#141311",
  },
  notifBody: {
    fontSize: 12,
    color: "#8E8B82",
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10,
    color: "#A49E93",
    fontFamily: fontFamilies.mono.regular,
    marginTop: 2,
  },

  emptyCard: {
    marginRight: spacing[5],
    alignItems: "flex-start",
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[5],
    backgroundColor: "#FFFFFF",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "#EAE7DF",
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
    color: "#141311",
  },
  emptySub: {
    marginTop: spacing[2],
    fontSize: 14,
    color: "#8E8B82",
    lineHeight: 21,
    maxWidth: 280,
  },
});
