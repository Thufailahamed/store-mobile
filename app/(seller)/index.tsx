import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  SELLER_CREAM,
  SELLER_GOLD,
  SELLER_RUST,
  SellerStatusPill,
} from "@/components/seller/chrome";
import { SellerBentoGrid } from "@/components/seller/SellerBentoGrid";
import { RevenueChart } from "@/components/seller/RevenueChart";
import {
  createSellerStore,
  getSellerComplianceDocuments,
  getSellerKPIs,
  getSellerNotifications,
  getSellerPayoutSettings,
  getSellerStore,
} from "@/lib/api";
import { formatNotificationBody, isNotificationUnread } from "@/lib/notifications/seller-inbox";
import { formatOrderStatusLabel } from "@/lib/orders/seller-list";
import { getSellerAccessState } from "@/lib/seller-access";
import { useAuth } from "@/lib/supabase/auth";
import { SELLER_DASHBOARD_ACTIONS } from "@/lib/seller/dashboard-actions";
import { orderStatusTone } from "@/lib/seller/status-tones";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { formatPrice, pluralize } from "@/lib/utils";
import type { Notification, Order, Store } from "@/lib/types";
import { hasPickupAddress, PICKUP_ADDRESS_ROUTE } from "@/lib/seller-pickup-address";

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
  revenueSeries: { date: string; revenue: number; orders: number }[];
  revenueDelta: number;
  aov: number;
  analyticsReady: boolean;
  inventoryReady: boolean;
  productsReady: boolean;
  ordersReady: boolean;
  pendingReady: boolean;
  returnsReady: boolean;
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function splitCurrency(formatted: string) {
  const match = formatted.match(/^([^\d\-−]+?)\s*([\d\-−].*)$/);
  return match ? { currency: match[1].trim(), amount: match[2] } : { currency: "", amount: formatted };
}

function formatCompactPrice(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `LKR ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 100_000) return `LKR ${(value / 1_000).toFixed(0)}K`;
  return formatPrice(value);
}

export default function SellerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Store | null>(null);
  const [accessBlocked, setAccessBlocked] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIData | null>(null);
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
    if (!storeRes.data) {
      setStore(null);
      setKpis(null);
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setStore(storeRes.data);
    const [payoutRes, docsRes] = await Promise.all([
      getSellerPayoutSettings(storeRes.data.id),
      getSellerComplianceDocuments(storeRes.data.id),
    ]);
    const access = getSellerAccessState(
      storeRes.data as Store & Record<string, unknown>,
      payoutRes.ok ? payoutRes.data : null,
      docsRes.ok ? docsRes.data : null,
    );

    if (!access.canAccessSellerTools) {
      setAccessBlocked(access.lockReason);
      setKpis(null);
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setAccessBlocked(null);
    const [kpiRes, notificationRes] = await Promise.all([
      getSellerKPIs(storeRes.data.id),
      getSellerNotifications(20),
    ]);
    setKpis(kpiRes.ok ? kpiRes.data : null);
    setNotifications(notificationRes.ok ? notificationRes.data : []);
    if (!kpiRes.ok && !notificationRes.ok) setLoadError(kpiRes.error);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const activeStoreId = store?.id;

  useFocusEffect(
    useCallback(() => {
      if (activeStoreId) void fetchData();
    }, [activeStoreId, fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const handleCreateStore = async () => {
    if (!user) return;
    if (!newStoreName.trim()) {
      Alert.alert("Store name required", "Enter a name for your store to continue.");
      return;
    }
    setCreatingStore(true);
    const result = await createSellerStore(user.id, {
      name: newStoreName.trim(),
      slug: newStoreSlug.trim() || undefined,
      description: newStoreDescription.trim() || undefined,
    });
    setCreatingStore(false);
    if (result.ok) {
      setLoading(true);
      void fetchData();
      return;
    }
    Alert.alert("Could not create store", result.error, [
      { text: "Try again", onPress: () => void handleCreateStore() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View style={[styles.loadingHeader, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
          <View style={styles.rowBetween}>
            <Skeleton width={152} height={18} />
            <Skeleton width={42} height={42} borderRadius={21} />
          </View>
          <Skeleton width={230} height={34} style={{ marginTop: 20 }} />
          <Skeleton height={148} borderRadius={24} style={{ marginTop: 20 }} />
        </View>
        <View style={styles.loadingBody}>
          <Skeleton height={92} borderRadius={20} />
          <Skeleton height={200} borderRadius={20} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  if (loadError && !store) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centeredContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SELLER_GOLD} />}
      >
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn’t load your store"
          description={loadError}
          action={
            <TouchableOpacity style={styles.primaryButton} onPress={onRefresh}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>
          }
        />
      </ScrollView>
    );
  }

  if (!store) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centeredContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.onboardingCard}>
          <View style={styles.onboardingIcon}>
            <Ionicons name="storefront-outline" size={26} color={colors.olive[800]} />
          </View>
          <Text style={styles.onboardingTitle}>Set up your store</Text>
          <Text style={styles.onboardingSub}>
            Add the essentials now. You can complete advanced setup from the web dashboard later.
          </Text>
          <Text style={styles.inputLabel}>Store name</Text>
          <TextInput
            style={styles.input}
            value={newStoreName}
            onChangeText={setNewStoreName}
            placeholder="e.g. Aura Boutique"
            placeholderTextColor={colors.light.mutedForeground}
          />
          <Text style={styles.inputLabel}>Store URL (optional)</Text>
          <TextInput
            style={styles.input}
            value={newStoreSlug}
            onChangeText={setNewStoreSlug}
            placeholder="aura-boutique"
            autoCapitalize="none"
            placeholderTextColor={colors.light.mutedForeground}
          />
          <Text style={styles.inputLabel}>Short description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={newStoreDescription}
            onChangeText={setNewStoreDescription}
            placeholder="What do you sell?"
            multiline
            placeholderTextColor={colors.light.mutedForeground}
          />
          <TouchableOpacity
            style={[styles.primaryButton, creatingStore && styles.disabled]}
            onPress={() => void handleCreateStore()}
            disabled={creatingStore}
          >
            <Text style={styles.primaryButtonText}>{creatingStore ? "Creating…" : "Create store"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (accessBlocked) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centeredContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SELLER_GOLD} />}
      >
        <EmptyState
          icon="lock-closed-outline"
          title="Seller tools locked"
          description={accessBlocked}
          action={
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(seller)/more" as any)}>
              <Text style={styles.primaryButtonText}>Open store settings</Text>
            </TouchableOpacity>
          }
        />
      </ScrollView>
    );
  }

  const analyticsReady = kpis?.analyticsReady === true;
  const inventoryReady = kpis?.inventoryReady === true;
  const pendingOrders = kpis?.pendingReady ? kpis.pendingOrders : null;
  const returnsCount = kpis?.returnsReady ? kpis.returnsCount : null;
  const lowStockCount = inventoryReady ? kpis.lowStockVariants : null;
  const outOfStockCount = inventoryReady ? kpis.outOfStockVariants : null;
  const inventoryIssues = (lowStockCount ?? 0) + (outOfStockCount ?? 0);
  const totalRevenue = analyticsReady ? kpis.totalRevenue : null;
  const totalOrders = analyticsReady ? kpis.totalOrders : null;
  const totalProducts = kpis?.productsReady ? kpis.totalProducts : null;
  const unreadCount = notifications.filter(isNotificationUnread).length;
  const storeName = store.name || "Your store";
  const monogram = storeName[0]?.toUpperCase() || "S";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const averageOrderValue = kpis?.analyticsReady ? kpis.aov : null;
  const stockAttentionSubtitle = [
    (outOfStockCount ?? 0) > 0 ? `${outOfStockCount} out of stock` : null,
    (lowStockCount ?? 0) > 0 ? `${lowStockCount} running low` : null,
  ].filter(Boolean).join(" · ");
  const revenueDelta = kpis?.analyticsReady ? kpis.revenueDelta : 0;
  const revenueSeries = kpis?.analyticsReady ? kpis.revenueSeries : [];
  const revenueTrend = analyticsReady && Math.abs(revenueDelta) >= 0.5
    ? `${revenueDelta > 0 ? "+" : "−"}${Math.min(Math.abs(revenueDelta), 999).toFixed(0)}%${Math.abs(revenueDelta) > 999 ? "+" : ""}`
    : null;
  const latestNotification = notifications.find(isNotificationUnread);
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const pickupMissing = !hasPickupAddress(store);
  const openTaskCount =
    [pendingOrders, inventoryIssues, returnsCount].filter((value) => (value ?? 0) > 0).length + (pickupMissing ? 1 : 0);
  const revenueParts = splitCurrency(formatCompactPrice(totalRevenue));

  const tasks = [
    // Pickup address stays at the top of "Needs attention" until it's saved
    // (never listed as settled — couriers can't collect without it).
    ...(pickupMissing
      ? [{
          key: "pickup",
          icon: "location-outline" as const,
          label: "Pickup",
          open: true,
          unavailable: false,
          title: "Add your product pickup address",
          subtitle: "Couriers need it to collect your orders",
          action: "Add",
          route: PICKUP_ADDRESS_ROUTE,
        }]
      : []),
    {
      key: "orders",
      icon: "bag-check-outline" as const,
      label: "Orders",
      open: (pendingOrders ?? 0) > 0,
      unavailable: pendingOrders == null,
      title: `${pendingOrders ?? 0} ${pluralize(pendingOrders ?? 0, "order")} to process`,
      subtitle: "Confirm and prepare fulfilment",
      action: "Process",
      route: "/(seller)/orders",
    },
    {
      key: "stock",
      icon: "cube-outline" as const,
      label: "Stock",
      open: inventoryIssues > 0,
      unavailable: !inventoryReady,
      title: `${inventoryIssues} stock ${pluralize(inventoryIssues, "issue")}`,
      subtitle: stockAttentionSubtitle || "Inventory needs review",
      action: "Fix",
      route: "/(seller)/inventory",
      meter:
        inventoryIssues > 0 && (kpis?.totalSkus ?? 0) > 0
          ? { out: outOfStockCount ?? 0, low: lowStockCount ?? 0, total: kpis!.totalSkus }
          : undefined,
    },
    {
      key: "returns",
      icon: "return-down-back-outline" as const,
      label: "Returns",
      open: (returnsCount ?? 0) > 0,
      unavailable: returnsCount == null,
      title: `${returnsCount ?? 0} ${pluralize(returnsCount ?? 0, "return")} waiting`,
      subtitle: "Review and make a decision",
      action: "Review",
      route: "/(seller)/returns",
    },
  ];
  const hasSalesCurve = revenueSeries.length > 1 && revenueSeries.some((p) => p.revenue > 0);
  const openTasks = tasks.filter((t) => t.open);
  const settledTasks = tasks.filter((t) => !t.open);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) + 10 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SELLER_GOLD} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.storeIdentity}
            onPress={() => router.push("/(seller)/settings" as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open store settings"
          >
            <View style={styles.logoRing}>
              {store.logo_url ? (
                <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={styles.monogram}>
                  <Text style={styles.monogramText}>{monogram}</Text>
                </View>
              )}
              <View style={[styles.presenceDot, !store.is_online && styles.presenceDotOff]} />
            </View>
            <View style={styles.storeIdentityText}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowRule} />
                <Text style={styles.storeEyebrow} numberOfLines={1}>
                  {greeting} · {todayLabel}
                </Text>
              </View>
              <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push("/(seller)/notifications" as any)}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          >
            <Ionicons name="notifications-outline" size={19} color={INK} />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{formatBadgeCount(unreadCount)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Store type */}
        {store.is_online ? (
          <View style={styles.liveChip}>
            <Ionicons name="globe-outline" size={13} color={INK} />
            <Text style={styles.liveChipText}>Online-only store</Text>
          </View>
        ) : null}

        {/* Revenue hero */}
        <TouchableOpacity
          style={styles.hero}
          onPress={() => router.push("/(seller)/analytics" as any)}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={`Revenue ${totalRevenue == null ? "unavailable" : formatPrice(totalRevenue)}. Open analytics`}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["#f5f4ef", "#faf8f1", "#efece2"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(83,94,44,0.10)", "transparent", "rgba(83,94,44,0.05)"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.heroSheen} />

          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroKicker}>Revenue</Text>
              <Text style={styles.heroPeriod}>Last 30 days</Text>
            </View>
            <View style={styles.heroLink}>
              <Ionicons name="stats-chart" size={12} color={colors.olive[800]} />
              <Text style={styles.heroLinkText}>Analytics</Text>
            </View>
          </View>

          <View style={styles.heroValueRow}>
            {revenueParts.currency ? <Text style={styles.heroCurrency}>{revenueParts.currency}</Text> : null}
            <Text style={styles.heroValue} numberOfLines={1}>{revenueParts.amount}</Text>
          </View>

          {revenueTrend ? (
            <View style={styles.trendRow}>
              <View style={[styles.trendPill, revenueDelta < 0 && styles.trendPillDown]}>
                <Ionicons
                  name={revenueDelta >= 0 ? "trending-up" : "trending-down"}
                  size={12}
                  color={revenueDelta >= 0 ? colors.olive[800] : "#b85c3a"}
                />
                <Text style={[styles.trendText, revenueDelta < 0 && styles.trendTextDown]}>{revenueTrend}</Text>
              </View>
              <Text style={styles.trendCaption}>vs previous period</Text>
            </View>
          ) : null}

          {hasSalesCurve ? (
            <View style={styles.chartWrap}>
              <RevenueChart compact fluid height={44} points={revenueSeries} />
            </View>
          ) : (
            <View style={styles.chartEmpty}>
              <View style={styles.chartEmptyLine} />
              <Text style={styles.chartEmptyText}>
                {analyticsReady ? "Your sales curve appears with the first order" : "Pull to refresh metrics"}
              </Text>
            </View>
          )}

          <View style={styles.heroStats}>
            <HeroStat icon="receipt-outline" label="Orders" value={totalOrders == null ? "—" : String(totalOrders)} />
            <HeroStat
              icon="pricetag-outline"
              label="Avg. order"
              value={averageOrderValue == null ? "—" : formatCompactPrice(averageOrderValue)}
            />
            <HeroStat icon="cube-outline" label="Products" value={totalProducts == null ? "—" : String(totalProducts)} />
          </View>
        </TouchableOpacity>

        {/* Primary actions */}
        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={styles.addProductButton}
            onPress={() => router.push("/(seller)/products/new" as any)}
            activeOpacity={0.86}
            accessibilityRole="button"
          >
            <View style={styles.addProductIcon}>
              <Ionicons name="add" size={17} color={INK} />
            </View>
            <Text style={styles.addProductText}>Add product</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewStoreButton}
            onPress={() => router.push(`/stores/${store.slug || store.id}` as any)}
            activeOpacity={0.86}
            accessibilityRole="button"
          >
            <Ionicons name="storefront-outline" size={16} color={INK} />
            <Text style={styles.viewStoreText}>View store</Text>
          </TouchableOpacity>
        </View>

        {/* Today */}
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Today"
            title={openTasks.length > 0 ? "Needs attention" : "All caught up"}
            right={
              openTasks.length > 0 ? (
                <View style={styles.taskCountPill}>
                  <View style={styles.taskCountDot} />
                  <Text style={styles.taskCountText}>{openTaskCount} open</Text>
                </View>
              ) : null
            }
          />

          {openTasks.map((task) => (
            <TouchableOpacity
              key={task.key}
              style={styles.taskCard}
              onPress={() => router.push(task.route as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${task.title}. ${task.subtitle}`}
            >
              <View style={styles.taskCardTop}>
                <View style={styles.taskIcon}>
                  <Ionicons name={task.icon} size={18} color={SELLER_RUST} />
                </View>
                <View style={styles.taskText}>
                  <Text style={styles.taskLabel}>{task.label}</Text>
                  <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                  <Text style={styles.taskSubtitle} numberOfLines={1}>{task.subtitle}</Text>
                </View>
                <View style={styles.taskAction}>
                  <Text style={styles.taskActionText}>{task.action}</Text>
                  <Ionicons name="arrow-forward" size={12} color={SELLER_CREAM} />
                </View>
              </View>
              {task.meter ? (
                <View style={styles.meterBlock}>
                  <View style={styles.stockMeter}>
                    <View style={[styles.stockMeterOut, { flex: task.meter.out }]} />
                    <View style={[styles.stockMeterLow, { flex: task.meter.low }]} />
                    <View style={{ flex: Math.max(task.meter.total - task.meter.out - task.meter.low, 0) }} />
                  </View>
                  <View style={styles.meterLegend}>
                    <LegendDot color={SELLER_RUST} label={`${task.meter.out} out`} />
                    <LegendDot color={SELLER_GOLD} label={`${task.meter.low} low`} />
                    <Text style={styles.meterTotal}>of {task.meter.total} SKUs</Text>
                  </View>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}

          {settledTasks.length > 0 ? (
            <View style={styles.settledCard}>
              {settledTasks.map((task, i) => (
                <TouchableOpacity
                  key={task.key}
                  style={[styles.settledItem, i > 0 && styles.settledItemDivider]}
                  onPress={() => router.push(task.route as any)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${task.label}: ${task.unavailable ? "unavailable" : "all clear"}`}
                >
                  <View style={[styles.settledCheck, task.unavailable && styles.settledCheckMuted]}>
                    <Ionicons
                      name={task.unavailable ? "remove" : "checkmark"}
                      size={12}
                      color={task.unavailable ? colors.ink.mute : "#FFFFFF"}
                    />
                  </View>
                  <View style={{ minWidth: 0, flexShrink: 1 }}>
                    <Text style={styles.settledLabel} numberOfLines={1}>{task.label}</Text>
                    <Text style={styles.settledState} numberOfLines={1}>
                      {task.unavailable ? "Unavailable" : "All clear"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <SectionHeader eyebrow="Manage" title="Shortcuts" />
          <SellerBentoGrid
            items={SELLER_DASHBOARD_ACTIONS.map((a) => {
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

        {/* Recent orders */}
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Latest"
            title="Recent orders"
            right={
              <TouchableOpacity
                style={styles.viewAll}
                onPress={() => router.push("/(seller)/orders" as any)}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={styles.viewAllText}>View all</Text>
                <Ionicons name="arrow-forward" size={12} color={INK} />
              </TouchableOpacity>
            }
          />
          {kpis?.ordersReady && kpis.recentOrders.length > 0 ? (
            <View style={styles.listPanel}>
              {kpis.recentOrders.slice(0, 3).map((order, index) => {
                const status = orderStatusTone(order.status);
                const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={[styles.orderRow, index > 0 && styles.orderRowDivider]}
                    onPress={() => router.push(`/(seller)/orders/${order.id}` as any)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                  >
                    <View style={styles.orderIcon}>
                      <Ionicons name="bag-handle-outline" size={17} color={colors.olive[800]} />
                    </View>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderNumber} numberOfLines={1}>{order.order_number}</Text>
                      <View style={styles.orderMetaRow}>
                        <SellerStatusPill
                          label={formatOrderStatusLabel(order.status)}
                          bg={status.bg}
                          color={status.text}
                          dotted={order.status === "pending"}
                        />
                        <Text style={styles.orderMeta} numberOfLines={1}>
                          {itemCount} {pluralize(itemCount, "item")} · {formatRelative(order.placed_at)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderAmount} numberOfLines={1}>{formatPrice(order.total)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : kpis?.ordersReady ? (
            <View style={styles.unavailableCard}>
              <Ionicons name="bag-handle-outline" size={18} color={colors.ink.mute} />
              <Text style={styles.unavailableText}>No orders yet — they’ll appear here.</Text>
            </View>
          ) : (
            <View style={styles.unavailableCard}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.ink.mute} />
              <Text style={styles.unavailableText}>Orders are unavailable. Pull to refresh.</Text>
            </View>
          )}
        </View>

        {latestNotification ? (
          <TouchableOpacity
            style={styles.updateCard}
            onPress={() => router.push("/(seller)/notifications" as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={styles.updateIcon}>
              <Ionicons name="sparkles" size={15} color={GOLD_LIGHT} />
            </View>
            <View style={styles.updateText}>
              <Text style={styles.updateLabel}>New update</Text>
              <Text style={styles.updateTitle} numberOfLines={1}>{latestNotification.title}</Text>
              <Text style={styles.updateBody} numberOfLines={1}>
                {formatNotificationBody(latestNotification.body, latestNotification.data) ||
                  formatRelative(latestNotification.created_at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(250,248,241,0.6)" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.summaryFooter}>
          <View style={styles.footerRule} />
          <Text style={styles.summaryText}>
            {totalOrders == null
              ? "Metrics may take a moment to sync"
              : `${totalOrders} total ${pluralize(totalOrders, "order")} recorded`}
          </Text>
          <View style={styles.footerRule} />
        </View>
      </ScrollView>
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
    </View>
  );
}

function SectionHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowRule} />
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

function HeroStat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatLabelRow}>
        <Ionicons name={icon} size={11} color={colors.ink.mute} />
        <Text style={styles.heroStatLabel}>{label}</Text>
      </View>
      <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const INK = colors.olive[950];
const GOLD_LIGHT = "#E8CF8F";
const CARD_SHADOW = {
  shadowColor: "#161a0a",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[5], paddingBottom: 120 },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.light.background },
  loadingHeader: { paddingHorizontal: spacing[5], paddingBottom: spacing[6] },
  loadingBody: { padding: spacing[5] },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  centeredContent: { flexGrow: 1, justifyContent: "center", padding: spacing[5], paddingBottom: 120 },
  onboardingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: spacing[6],
    gap: spacing[2],
    ...CARD_SHADOW,
  },
  onboardingIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  onboardingTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 26, color: INK },
  onboardingSub: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: colors.ink.mute, marginBottom: spacing[3] },
  inputLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: INK, marginTop: spacing[2] },
  input: {
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: INK,
  },
  textArea: { minHeight: 84, textAlignVertical: "top" },
  primaryButton: {
    minHeight: 48,
    backgroundColor: INK,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  primaryButtonText: { color: SELLER_CREAM, fontFamily: fontFamilies.sans.semibold, fontSize: 14 },
  disabled: { opacity: 0.55 },

  // Identity
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  storeIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 14 },
  logoRing: {
    padding: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.55)",
  },
  logo: { width: 46, height: 46, borderRadius: 16 },
  monogram: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  monogramText: { color: SELLER_GOLD, fontFamily: fontFamilies.display.semibold, fontSize: 21 },
  presenceDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#5f9a4a",
    borderWidth: 3,
    borderColor: colors.light.background,
  },
  presenceDotOff: { backgroundColor: SELLER_RUST },
  storeIdentityText: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  eyebrowRule: { width: 14, height: 1, backgroundColor: SELLER_GOLD },
  storeEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink.mute,
    flexShrink: 1,
  },
  storeName: { fontFamily: fontFamilies.display.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: INK },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: SELLER_RUST,
    borderWidth: 2,
    borderColor: colors.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: { color: "#FFFFFF", fontFamily: fontFamilies.sans.bold, fontSize: 9.5 },

  // Status
  liveChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 20,
    ...CARD_SHADOW,
  },
  liveChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: INK },

  // Hero
  hero: {
    marginTop: 16,
    backgroundColor: "#f5f4ef",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(83,94,44,0.14)",
    shadowColor: "#3d4423",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  heroSheen: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: "rgba(83,94,44,0.18)",
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  heroPeriod: { fontFamily: fontFamilies.display.italic, fontSize: 13, color: colors.ink.mute, marginTop: 2 },
  heroLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: "#fffdf8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(83,94,44,0.22)",
  },
  heroLinkText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
  heroValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 },
  heroCurrency: { fontFamily: fontFamilies.mono.medium, fontSize: 11, letterSpacing: 1.1, color: colors.ink.mute },
  heroValue: {
    flex: 1,
    fontFamily: fontFamilies.display.regular,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1,
    color: colors.olive[950],
    fontVariant: ["tabular-nums"],
  },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(83,94,44,0.10)",
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  trendPillDown: { backgroundColor: "rgba(184,92,58,0.15)" },
  trendText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, color: colors.olive[800] },
  trendTextDown: { color: "#b85c3a" },
  trendCaption: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute },
  chartWrap: { minHeight: 44, marginTop: 10, marginHorizontal: -4, justifyContent: "flex-end" },
  chartEmpty: { marginTop: 12, gap: 6 },
  chartEmptyLine: {
    height: 1,
    borderRadius: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.18)",
  },
  chartEmptyText: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute },
  heroStats: { flexDirection: "row", gap: 6, marginTop: 12 },
  heroStat: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(83,94,44,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(83,94,44,0.14)",
  },
  heroStatLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroStatLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 10.5, color: colors.ink.mute },
  heroStatValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.olive[950],
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },

  // Primary actions
  primaryActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  addProductButton: {
    flex: 1,
    height: 52,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    ...CARD_SHADOW,
  },
  addProductIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SELLER_GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  addProductText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: INK },
  viewStoreButton: {
    flex: 1,
    height: 52,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    ...CARD_SHADOW,
  },
  viewStoreText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: INK },

  // Sections
  section: { marginTop: 34 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: INK },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 4 },
  viewAllText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: INK },

  // Tasks
  taskCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "rgba(184,92,58,0.1)",
    marginBottom: 3,
  },
  taskCountDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: SELLER_RUST },
  taskCountText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: SELLER_RUST },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
    ...CARD_SHADOW,
  },
  taskCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  taskIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(184,92,58,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  taskText: { flex: 1, minWidth: 0 },
  taskLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: SELLER_RUST,
  },
  taskTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: INK, marginTop: 2 },
  taskSubtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, marginTop: 1 },
  taskAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: INK,
  },
  taskActionText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: SELLER_CREAM },
  meterBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.18)",
  },
  stockMeter: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.olive[50], gap: 2 },
  stockMeterOut: { backgroundColor: SELLER_RUST, borderRadius: 3 },
  stockMeterLow: { backgroundColor: SELLER_GOLD, borderRadius: 3 },
  meterLegend: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 9 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: colors.ink.soft },
  meterTotal: { marginLeft: "auto", fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute },
  settledCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 12,
    ...CARD_SHADOW,
  },
  settledItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 },
  settledItemDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(83,94,44,0.2)" },
  settledCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#5f9a4a",
    alignItems: "center",
    justifyContent: "center",
  },
  settledCheckMuted: { backgroundColor: colors.paper.warm },
  settledLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: INK },
  settledState: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },

  // Shortcuts
  shortcuts: { flexDirection: "row", gap: 10 },
  shortcut: {
    flex: 1,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    ...CARD_SHADOW,
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  shortcutLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: INK },
  shortcutHint: { fontFamily: fontFamilies.sans.regular, fontSize: 10.5, color: colors.ink.mute, marginTop: 1 },

  // Orders
  listPanel: { backgroundColor: "#FFFFFF", borderRadius: 24, paddingHorizontal: 14, ...CARD_SHADOW },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  orderRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.18)" },
  orderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  orderInfo: { flex: 1, minWidth: 0, gap: 6 },
  orderNumber: { fontFamily: fontFamilies.mono.medium, fontSize: 12, letterSpacing: 0.4, color: INK },
  orderMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderMeta: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute },
  orderAmount: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: INK, fontVariant: ["tabular-nums"] },
  unavailableCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    ...CARD_SHADOW,
  },
  unavailableText: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: colors.ink.mute },

  // Update
  updateCard: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.olive[900],
    borderRadius: 22,
    padding: 14,
    ...CARD_SHADOW,
  },
  updateIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(232,207,143,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  updateText: { flex: 1, minWidth: 0, gap: 1 },
  updateLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: SELLER_GOLD,
  },
  updateTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: SELLER_CREAM },
  updateBody: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: "rgba(250,248,241,0.6)" },

  summaryFooter: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: spacing[7] },
  footerRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.22)" },
  summaryText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.mute,
    textAlign: "center",
  },
});
