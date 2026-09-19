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
import { SellerBentoGrid } from "@/components/seller/SellerBentoGrid";
import {
  SELLER_CREAM,
  SELLER_GOLD,
  SELLER_RUST,
  SellerStatusPill,
  sellerBorder,
} from "@/components/seller/chrome";
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
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { formatPrice, pluralize } from "@/lib/utils";
import type { Notification, Order, Store } from "@/lib/types";

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
  const hasTasks = (pendingOrders ?? 0) > 0 || inventoryIssues > 0 || (returnsCount ?? 0) > 0;
  const revenueDelta = kpis?.analyticsReady ? kpis.revenueDelta : 0;
  const revenueSeries = kpis?.analyticsReady ? kpis.revenueSeries : [];
  const revenueTrend = analyticsReady && Math.abs(revenueDelta) >= 0.5
    ? `${revenueDelta > 0 ? "+" : ""}${revenueDelta.toFixed(0)}%`
    : null;
  const latestNotification = notifications.find(isNotificationUnread);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SELLER_GOLD} />}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={["#F9F7F1", "#EFEBDD"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.storeIdentity}
            onPress={() => router.push("/(seller)/settings" as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open store settings"
          >
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={styles.monogram}>
                <Text style={styles.monogramText}>{monogram}</Text>
              </View>
            )}
            <View style={styles.storeIdentityText}>
              <Text style={styles.storeEyebrow}>{greeting.toUpperCase()}</Text>
              <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push("/(seller)/notifications" as any)}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.olive[950]} />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{formatBadgeCount(unreadCount)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.storeStatus, !store.is_online && styles.storeStatusOffline]}>
            <View style={[styles.statusDot, !store.is_online && styles.statusDotOffline]} />
            <Text style={[styles.storeStatusText, !store.is_online && styles.storeStatusTextOffline]}>
              {store.is_online ? "Store live" : "Store offline"}
            </Text>
          </View>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.revenueCard}
          onPress={() => router.push("/(seller)/analytics" as any)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Revenue ${totalRevenue == null ? "unavailable" : formatPrice(totalRevenue)}`}
        >
          <View style={styles.revenueTop}>
            <View>
              <Text style={styles.revenueLabel}>Revenue · last 30 days</Text>
              <Text style={styles.revenueValue} numberOfLines={1}>{formatCompactPrice(totalRevenue)}</Text>
            </View>
            {revenueTrend ? (
              <View style={[styles.trendPill, revenueDelta < 0 && styles.trendPillDown]}>
                <Ionicons name={revenueDelta >= 0 ? "arrow-up" : "arrow-down"} size={11} color={revenueDelta >= 0 ? "#DCE8D2" : "#FFD7CA"} />
                <Text style={[styles.trendText, revenueDelta < 0 && styles.trendTextDown]}>{revenueTrend}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.revenueBottom}>
            <View style={styles.chartWrap}>
              {revenueSeries.length > 1 ? (
                <RevenueChart compact height={42} points={revenueSeries} />
              ) : (
                <Text style={styles.revenueHint}>{analyticsReady ? "Sales will appear here" : "Pull to refresh metrics"}</Text>
              )}
            </View>
            <View style={styles.openAnalytics}>
              <Text style={styles.openAnalyticsText}>Details</Text>
              <Ionicons name="arrow-forward" size={12} color="#E8CF8F" />
            </View>
          </View>
          <View style={styles.revenueInsights}>
            <View style={styles.revenueInsight}>
              <Text style={styles.revenueInsightLabel}>ORDERS</Text>
              <Text style={styles.revenueInsightValue}>{totalOrders ?? "—"}</Text>
            </View>
            <View style={styles.revenueInsightRule} />
            <View style={styles.revenueInsight}>
              <Text style={styles.revenueInsightLabel}>AVG. ORDER</Text>
              <Text style={styles.revenueInsightValue}>{averageOrderValue == null ? "—" : formatCompactPrice(averageOrderValue)}</Text>
            </View>
            <View style={styles.revenueInsightRule} />
            <View style={styles.revenueInsight}>
              <Text style={styles.revenueInsightLabel}>WINDOW</Text>
              <Text style={styles.revenueInsightValue}>30 days</Text>
            </View>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.metricsRow}>
          <TouchableOpacity style={styles.metricCard} onPress={() => router.push("/(seller)/orders" as any)}>
            <View style={styles.metricIcon}><Ionicons name="bag-handle-outline" size={16} color={colors.olive[800]} /></View>
            <Text style={styles.metricValue}>{pendingOrders ?? "—"}</Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCard} onPress={() => router.push("/(seller)/products" as any)}>
            <View style={styles.metricIcon}><Ionicons name="pricetag-outline" size={16} color={colors.olive[800]} /></View>
            <Text style={styles.metricValue}>{totalProducts ?? "—"}</Text>
            <Text style={styles.metricLabel}>Products</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCard} onPress={() => router.push("/(seller)/inventory" as any)}>
            <View style={[styles.metricIcon, inventoryIssues > 0 && styles.metricIconWarn]}><Ionicons name="cube-outline" size={16} color={inventoryIssues > 0 ? SELLER_RUST : colors.olive[800]} /></View>
            <Text style={[styles.metricValue, inventoryIssues > 0 && styles.metricValueWarn]}>
              {inventoryReady ? inventoryIssues : "—"}
            </Text>
            <Text style={styles.metricLabel}>Stock issues</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>TODAY</Text>
              <Text style={styles.sectionTitle}>{hasTasks ? "Needs attention" : "You’re all caught up"}</Text>
            </View>
            {hasTasks ? <Text style={styles.taskCount}>{[pendingOrders, inventoryIssues, returnsCount].filter((value) => (value ?? 0) > 0).length}</Text> : null}
          </View>

          <View style={styles.taskPanel}>
            {(pendingOrders ?? 0) > 0 ? (
              <TaskRow
                icon="bag-check-outline"
                title={`${pendingOrders} ${pluralize(pendingOrders ?? 0, "order")} to process`}
                subtitle="Confirm and prepare fulfilment"
                action="Open"
                onPress={() => router.push("/(seller)/orders" as any)}
              />
            ) : null}
            {inventoryIssues > 0 ? (
              <TaskRow
                icon="alert-circle-outline"
                title={`${inventoryIssues} stock ${pluralize(inventoryIssues, "issue")}`}
                subtitle={stockAttentionSubtitle || "Inventory needs review"}
                action="Fix"
                tone="warn"
                onPress={() => router.push("/(seller)/inventory" as any)}
              />
            ) : null}
            {(returnsCount ?? 0) > 0 ? (
              <TaskRow
                icon="return-down-back-outline"
                title={`${returnsCount} ${pluralize(returnsCount ?? 0, "return")} waiting`}
                subtitle="Review and make a decision"
                action="Review"
                tone="warn"
                onPress={() => router.push("/(seller)/returns" as any)}
              />
            ) : null}
            {!hasTasks ? (
              <View style={styles.clearState}>
                <View style={styles.clearIcon}>
                  <Ionicons name="checkmark" size={20} color={colors.olive[800]} />
                </View>
                <View style={styles.clearText}>
                  <Text style={styles.clearTitle}>No urgent tasks</Text>
                  <Text style={styles.clearSub}>Orders, returns, and stock are in good shape.</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={styles.addProductButton}
            onPress={() => router.push("/(seller)/products/new" as any)}
            activeOpacity={0.86}
          >
            <Ionicons name="add" size={19} color={SELLER_CREAM} />
            <Text style={styles.addProductText}>Add product</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewStoreButton}
            onPress={() => router.push(`/store/${store.slug || store.id}` as any)}
            activeOpacity={0.86}
          >
            <Ionicons name="storefront-outline" size={17} color={colors.olive[900]} />
            <Text style={styles.viewStoreText}>View store</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>MANAGE</Text>
              <Text style={styles.sectionTitle}>Quick actions</Text>
            </View>
          </View>
          <SellerBentoGrid
            items={SELLER_DASHBOARD_ACTIONS.map((action) => ({
              key: action.key,
              label: action.label,
              hint: action.hint,
              icon: action.icon,
              onPress: () => router.push(action.route as any),
            }))}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>LATEST</Text>
              <Text style={styles.sectionTitle}>Recent orders</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(seller)/orders" as any)} hitSlop={10}>
              <Text style={styles.sectionLink}>View all</Text>
            </TouchableOpacity>
          </View>
          {kpis?.ordersReady && kpis.recentOrders.length > 0 ? (
            <View style={styles.listPanel}>
              {kpis.recentOrders.slice(0, 3).map((order, index) => {
                const status = orderStatusTone(order.status);
                const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={[styles.orderRow, index === Math.min(kpis.recentOrders.length, 3) - 1 && styles.lastRow]}
                    onPress={() => router.push(`/(seller)/orders/${order.id}` as any)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.orderIcon}>
                      <Ionicons name="receipt-outline" size={17} color={colors.olive[800]} />
                    </View>
                    <View style={styles.orderInfo}>
                      <View style={styles.orderTitleRow}>
                        <Text style={styles.orderNumber}>{order.order_number}</Text>
                        <SellerStatusPill label={formatOrderStatusLabel(order.status)} bg={status.bg} color={status.text} dotted={order.status === "pending"} />
                      </View>
                      <Text style={styles.orderMeta}>{itemCount} {pluralize(itemCount, "item")} · {formatRelative(order.placed_at)}</Text>
                    </View>
                    <View style={styles.orderAmountWrap}>
                      <Text style={styles.orderAmount}>{formatPrice(order.total)}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : kpis?.ordersReady ? (
            <EmptyState icon="bag-handle-outline" title="No orders yet" description="New orders will appear here." />
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
            activeOpacity={0.8}
          >
            <View style={styles.updateDot} />
            <View style={styles.updateText}>
              <Text style={styles.updateLabel}>NEW UPDATE</Text>
              <Text style={styles.updateTitle} numberOfLines={1}>{latestNotification.title}</Text>
              <Text style={styles.updateBody} numberOfLines={1}>
                {formatNotificationBody(latestNotification.body, latestNotification.data) || formatRelative(latestNotification.created_at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.ink.mute} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.summaryFooter}>
          <Text style={styles.summaryText}>
            {totalOrders == null ? "Dashboard metrics may take a moment to sync." : `${totalOrders} total ${pluralize(totalOrders, "order")} recorded.`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function TaskRow({
  icon,
  title,
  subtitle,
  action,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
  tone?: "default" | "warn";
}) {
  return (
    <TouchableOpacity style={styles.taskRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.taskIcon, tone === "warn" && styles.taskIconWarn]}>
        <Ionicons name={icon} size={18} color={tone === "warn" ? SELLER_RUST : colors.olive[800]} />
      </View>
      <View style={styles.taskText}>
        <Text style={styles.taskTitle}>{title}</Text>
        <Text style={styles.taskSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.taskActionPill}>
        <Text style={styles.taskAction}>{action}</Text>
        <Ionicons name="chevron-forward" size={12} color={colors.olive[700]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },
  loadingHeader: { backgroundColor: "#F5F2E9", paddingHorizontal: spacing[5], paddingBottom: spacing[6] },
  loadingBody: { padding: spacing[5] },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  centeredContent: { flexGrow: 1, justifyContent: "center", padding: spacing[5], paddingBottom: 120 },
  onboardingCard: {
    backgroundColor: SELLER_CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: sellerBorder,
    padding: spacing[6],
    gap: spacing[2],
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
  onboardingTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 26, color: colors.olive[950] },
  onboardingSub: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: colors.ink.mute, marginBottom: spacing[3] },
  inputLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[950], marginTop: spacing[2] },
  input: {
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.olive[950],
  },
  textArea: { minHeight: 84, textAlignVertical: "top" },
  primaryButton: {
    minHeight: 48,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  primaryButtonText: { color: SELLER_CREAM, fontFamily: fontFamilies.sans.semibold, fontSize: 14 },
  disabled: { opacity: 0.55 },
  header: { paddingHorizontal: spacing[5], paddingBottom: 36 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  storeIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 16 },
  monogram: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  monogramText: { color: SELLER_CREAM, fontFamily: fontFamilies.display.semibold, fontSize: 20 },
  storeIdentityText: { flex: 1, minWidth: 0, gap: 1 },
  storeEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.4, color: colors.ink.mute },
  storeName: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: colors.olive[950] },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: SELLER_RUST,
    borderWidth: 2,
    borderColor: "#F6F3EA",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: { color: "#FFFFFF", fontFamily: fontFamilies.sans.semibold, fontSize: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 12 },
  storeStatus: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(78,141,66,0.1)", borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 6 },
  storeStatusOffline: { backgroundColor: "rgba(107,103,94,0.1)" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4E8D42" },
  statusDotOffline: { backgroundColor: colors.ink.mute },
  storeStatusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#35642D" },
  storeStatusTextOffline: { color: colors.ink.mute },
  headerDate: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 0.8, color: colors.ink.mute, textTransform: "uppercase" },
  revenueCard: { backgroundColor: "#191814", borderRadius: 24, padding: 18, overflow: "hidden", ...shadows.soft },
  revenueTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  revenueLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.1, color: "#AAA396", textTransform: "uppercase" },
  revenueValue: { marginTop: 5, fontFamily: fontFamilies.display.semibold, fontSize: 31, lineHeight: 37, color: "#FAF8F3", fontVariant: ["tabular-nums"] },
  trendPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(125,139,111,0.22)", borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 5 },
  trendPillDown: { backgroundColor: "rgba(184,92,58,0.2)" },
  trendText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: "#DCE8D2" },
  trendTextDown: { color: "#FFD7CA" },
  revenueBottom: { minHeight: 42, marginTop: 12, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  chartWrap: { flex: 1, minWidth: 0, justifyContent: "flex-end" },
  revenueHint: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: "#AAA396", paddingBottom: 7 },
  openAnalytics: { flexDirection: "row", alignItems: "center", gap: 5, paddingBottom: 6 },
  openAnalyticsText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#E8CF8F" },
  revenueInsights: { minHeight: 46, flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.13)" },
  revenueInsight: { flex: 1, alignItems: "center", gap: 3 },
  revenueInsightRule: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: "rgba(255,255,255,0.14)" },
  revenueInsightLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 7, letterSpacing: 0.9, color: "#817C72" },
  revenueInsightValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: "#E6E1D7" },
  body: { marginTop: -20, paddingTop: spacing[5], paddingHorizontal: spacing[5], backgroundColor: colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, minWidth: 0, minHeight: 106, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: sellerBorder, borderRadius: 19, padding: 12, justifyContent: "space-between", ...shadows.soft },
  metricIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  metricIconWarn: { backgroundColor: "rgba(184,92,58,0.08)" },
  metricValue: { fontFamily: fontFamilies.display.semibold, fontSize: 23, lineHeight: 27, color: colors.olive[950], fontVariant: ["tabular-nums"] },
  metricValueWarn: { color: SELLER_RUST },
  metricLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 10, color: colors.ink.mute },
  section: { marginTop: spacing[7] },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  sectionEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.4, color: colors.olive[600], marginBottom: 3 },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 21, color: colors.olive[950] },
  sectionLink: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[700] },
  taskCount: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: colors.olive[900], color: SELLER_CREAM, textAlign: "center", lineHeight: 26, fontFamily: fontFamilies.sans.semibold, fontSize: 11 },
  taskPanel: { backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder, borderRadius: 20, overflow: "hidden" },
  taskRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sellerBorder },
  taskIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  taskIconWarn: { backgroundColor: "rgba(184,92,58,0.08)" },
  taskText: { flex: 1, minWidth: 0, gap: 2 },
  taskTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.olive[950] },
  taskSubtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  taskActionPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radii.full, backgroundColor: colors.olive[50] },
  taskAction: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: colors.olive[700] },
  clearState: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: 13, padding: 16 },
  clearIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  clearText: { flex: 1, gap: 2 },
  clearTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.olive[950] },
  clearSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, lineHeight: 17, color: colors.ink.mute },
  primaryActions: { flexDirection: "row", gap: 10, marginTop: spacing[5] },
  addProductButton: { flex: 1, minHeight: 50, borderRadius: radii.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.olive[900] },
  addProductText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: SELLER_CREAM },
  viewStoreButton: { minHeight: 50, paddingHorizontal: 18, borderRadius: radii.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder },
  viewStoreText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.olive[900] },
  listPanel: { backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder, borderRadius: 20, overflow: "hidden" },
  orderRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sellerBorder },
  lastRow: { borderBottomWidth: 0 },
  orderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  orderInfo: { flex: 1, minWidth: 0, gap: 4 },
  orderTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderNumber: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[950] },
  orderMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 10, color: colors.ink.mute },
  orderAmountWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  orderAmount: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, color: colors.olive[950] },
  unavailableCard: { minHeight: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder, borderRadius: 20 },
  unavailableText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  updateCard: { marginTop: spacing[6], minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.paper.warm, borderRadius: 18, padding: 14 },
  updateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SELLER_GOLD },
  updateText: { flex: 1, minWidth: 0, gap: 1 },
  updateLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.2, color: colors.olive[600] },
  updateTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[950] },
  updateBody: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  summaryFooter: { alignItems: "center", paddingVertical: spacing[7] },
  summaryText: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute, textAlign: "center" },
});
