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
  const hasTasks = (pendingOrders ?? 0) > 0 || inventoryIssues > 0 || (returnsCount ?? 0) > 0;
  const revenueDelta = kpis?.analyticsReady ? kpis.revenueDelta : 0;
  const revenueSeries = kpis?.analyticsReady ? kpis.revenueSeries : [];
  const revenueTrend = analyticsReady && Math.abs(revenueDelta) >= 0.5
    ? `${revenueDelta > 0 ? "+" : "−"}${Math.min(Math.abs(revenueDelta), 999).toFixed(0)}%${Math.abs(revenueDelta) > 999 ? "+" : ""}`
    : null;
  const latestNotification = notifications.find(isNotificationUnread);
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const openTaskCount = [pendingOrders, inventoryIssues, returnsCount].filter((value) => (value ?? 0) > 0).length;
  const revenueParts = splitCurrency(formatCompactPrice(totalRevenue));

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
              <Text style={styles.storeEyebrow}>
                {greeting.toUpperCase()} · {todayLabel.toUpperCase()}
              </Text>
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

        {store.is_online ? (
          <View style={styles.storeStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.storeStatusText}>Store live · accepting orders</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.offlineBanner}
            onPress={() => router.push("/(seller)/settings" as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Store offline. Open settings to go live"
          >
            <View style={styles.offlineIcon}>
              <Ionicons name="moon-outline" size={15} color={SELLER_RUST} />
            </View>
            <View style={styles.offlineText}>
              <Text style={styles.offlineTitle}>Your store is offline</Text>
              <Text style={styles.offlineSub} numberOfLines={1}>Shoppers can’t place new orders</Text>
            </View>
            <View style={styles.goLivePill}>
              <Text style={styles.goLiveText}>Go live</Text>
              <Ionicons name="arrow-forward" size={12} color={SELLER_CREAM} />
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.revenueCard}
          onPress={() => router.push("/(seller)/analytics" as any)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Revenue ${totalRevenue == null ? "unavailable" : formatPrice(totalRevenue)}. Open analytics`}
        >
          <View style={styles.revenueTop}>
            <Text style={styles.revenueLabel}>Revenue · last 30 days</Text>
            <View style={styles.openAnalytics}>
              <Text style={styles.openAnalyticsText}>Analytics</Text>
              <Ionicons name="arrow-forward" size={12} color="#E8CF8F" />
            </View>
          </View>
          <View style={styles.revenueValueRow}>
            {revenueParts.currency ? <Text style={styles.revenueCurrency}>{revenueParts.currency}</Text> : null}
            <Text style={styles.revenueValue} numberOfLines={1} adjustsFontSizeToFit>{revenueParts.amount}</Text>
          </View>
          {revenueTrend ? (
            <View style={styles.trendRow}>
              <View style={[styles.trendPill, revenueDelta < 0 && styles.trendPillDown]}>
                <Ionicons name={revenueDelta >= 0 ? "trending-up" : "trending-down"} size={12} color={revenueDelta >= 0 ? "#DCE8D2" : "#FFD7CA"} />
                <Text style={[styles.trendText, revenueDelta < 0 && styles.trendTextDown]}>{revenueTrend}</Text>
              </View>
              <Text style={styles.trendCaption}>vs previous 30 days</Text>
            </View>
          ) : null}
          <View style={styles.chartWrap}>
            {revenueSeries.length > 1 ? (
              <RevenueChart compact fluid height={56} points={revenueSeries} />
            ) : (
              <Text style={styles.revenueHint}>{analyticsReady ? "Sales will appear here" : "Pull to refresh metrics"}</Text>
            )}
          </View>
          <View style={styles.revenueInsights}>
            <RevenueInsight label="Orders" value={totalOrders == null ? "—" : String(totalOrders)} />
            <View style={styles.revenueInsightRule} />
            <RevenueInsight label="Avg. order" value={averageOrderValue == null ? "—" : formatCompactPrice(averageOrderValue)} />
            <View style={styles.revenueInsightRule} />
            <RevenueInsight label="Products" value={totalProducts == null ? "—" : String(totalProducts)} />
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.sectionFirst}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>TODAY</Text>
              <Text style={styles.sectionTitle}>{hasTasks ? "Needs attention" : "You’re all caught up"}</Text>
            </View>
            {hasTasks ? (
              <View style={styles.taskCountPill}>
                <View style={styles.taskCountDot} />
                <Text style={styles.taskCountText}>{openTaskCount} open</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.taskPanel}>
            <TaskRow
              icon="bag-check-outline"
              title={
                pendingOrders == null
                  ? "Orders unavailable"
                  : pendingOrders > 0
                    ? `${pendingOrders} ${pluralize(pendingOrders, "order")} to process`
                    : "No orders waiting"
              }
              subtitle={(pendingOrders ?? 0) > 0 ? "Confirm and prepare fulfilment" : "New orders will show up here"}
              action="Open"
              done={(pendingOrders ?? 0) === 0}
              onPress={() => router.push("/(seller)/orders" as any)}
            />
            <TaskRow
              icon="cube-outline"
              title={
                !inventoryReady
                  ? "Inventory unavailable"
                  : inventoryIssues > 0
                    ? `${inventoryIssues} stock ${pluralize(inventoryIssues, "issue")}`
                    : "Stock levels healthy"
              }
              subtitle={inventoryIssues > 0 ? stockAttentionSubtitle || "Inventory needs review" : "Nothing out of stock or running low"}
              action="Fix"
              tone="warn"
              done={inventoryIssues === 0}
              onPress={() => router.push("/(seller)/inventory" as any)}
              meter={
                inventoryIssues > 0 && (kpis?.totalSkus ?? 0) > 0
                  ? { out: outOfStockCount ?? 0, low: lowStockCount ?? 0, total: kpis!.totalSkus }
                  : undefined
              }
            />
            <TaskRow
              icon="return-down-back-outline"
              title={
                returnsCount == null
                  ? "Returns unavailable"
                  : returnsCount > 0
                    ? `${returnsCount} ${pluralize(returnsCount, "return")} waiting`
                    : "No returns to review"
              }
              subtitle={(returnsCount ?? 0) > 0 ? "Review and make a decision" : "Return requests will show up here"}
              action="Review"
              tone="warn"
              done={(returnsCount ?? 0) === 0}
              last
              onPress={() => router.push("/(seller)/returns" as any)}
            />
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
            onPress={() => router.push(`/stores/${store.slug || store.id}` as any)}
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

function RevenueInsight({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.revenueInsight}>
      <Text style={styles.revenueInsightLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.revenueInsightValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function TaskRow({
  icon,
  title,
  subtitle,
  action,
  onPress,
  tone = "default",
  done = false,
  last = false,
  meter,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
  tone?: "default" | "warn";
  done?: boolean;
  last?: boolean;
  meter?: { out: number; low: number; total: number };
}) {
  const warn = tone === "warn" && !done;
  return (
    <TouchableOpacity
      style={[styles.taskRow, last && styles.lastRow]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={[styles.taskIcon, warn && styles.taskIconWarn, done && styles.taskIconDone]}>
        <Ionicons
          name={done ? "checkmark" : icon}
          size={done ? 16 : 18}
          color={done ? colors.olive[600] : warn ? SELLER_RUST : colors.olive[800]}
        />
      </View>
      <View style={styles.taskText}>
        <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={1}>{title}</Text>
        <Text style={styles.taskSubtitle} numberOfLines={1}>{subtitle}</Text>
        {meter ? (
          <View style={styles.stockMeter}>
            <View style={[styles.stockMeterOut, { flex: meter.out }]} />
            <View style={[styles.stockMeterLow, { flex: meter.low }]} />
            <View style={{ flex: Math.max(meter.total - meter.out - meter.low, 0) }} />
          </View>
        ) : null}
      </View>
      {done ? (
        <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} />
      ) : (
        <View style={[styles.taskActionPill, warn && styles.taskActionPillWarn]}>
          <Text style={[styles.taskAction, warn && styles.taskActionWarn]}>{action}</Text>
          <Ionicons name="chevron-forward" size={12} color={warn ? SELLER_CREAM : colors.olive[700]} />
        </View>
      )}
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
  header: { paddingHorizontal: spacing[5], paddingBottom: 40 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  storeIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 16 },
  monogram: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  monogramText: { color: SELLER_CREAM, fontFamily: fontFamilies.display.semibold, fontSize: 20 },
  storeIdentityText: { flex: 1, minWidth: 0, gap: 2 },
  storeEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.3, color: colors.ink.mute },
  storeName: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: colors.olive[950] },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: SELLER_RUST,
    borderWidth: 2,
    borderColor: "#F6F3EA",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: { color: "#FFFFFF", fontFamily: fontFamilies.sans.semibold, fontSize: 10 },
  storeStatus: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(78,141,66,0.1)", borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 7, marginTop: 18, marginBottom: 14 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4E8D42" },
  storeStatusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#35642D" },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
    padding: 10,
    paddingLeft: 12,
    borderRadius: 18,
    backgroundColor: "rgba(184,92,58,0.08)",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.18)",
  },
  offlineIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: "rgba(184,92,58,0.12)", alignItems: "center", justifyContent: "center" },
  offlineText: { flex: 1, minWidth: 0, gap: 1 },
  offlineTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.olive[950] },
  offlineSub: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  goLivePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.olive[900], borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8 },
  goLiveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: SELLER_CREAM },
  revenueCard: { backgroundColor: "#191814", borderRadius: 26, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6, overflow: "hidden", ...shadows.soft },
  revenueTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  revenueLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 1.2, color: "#AAA396", textTransform: "uppercase" },
  revenueValueRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 },
  revenueCurrency: { fontFamily: fontFamilies.mono.semibold, fontSize: 13, letterSpacing: 1, color: "#AAA396" },
  revenueValue: { flexShrink: 1, fontFamily: fontFamilies.display.semibold, fontSize: 38, lineHeight: 44, color: "#FAF8F3", fontVariant: ["tabular-nums"] },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  trendPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(125,139,111,0.22)", borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 4 },
  trendPillDown: { backgroundColor: "rgba(184,92,58,0.22)" },
  trendText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, color: "#DCE8D2" },
  trendTextDown: { color: "#FFD7CA" },
  trendCaption: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: "#8F897D" },
  chartWrap: { minHeight: 56, marginTop: 14, marginHorizontal: -4, justifyContent: "flex-end" },
  revenueHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: "#AAA396", paddingBottom: 8, paddingHorizontal: 4 },
  openAnalytics: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.full, backgroundColor: "rgba(232,207,143,0.1)" },
  openAnalyticsText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#E8CF8F" },
  revenueInsights: { minHeight: 64, flexDirection: "row", alignItems: "center", marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.13)" },
  revenueInsight: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 4 },
  revenueInsightRule: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: "rgba(255,255,255,0.14)" },
  revenueInsightLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1, color: "#8F897D" },
  revenueInsightValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: "#F1ECE2", fontVariant: ["tabular-nums"] },
  body: { marginTop: -22, paddingTop: spacing[6], paddingHorizontal: spacing[5], backgroundColor: colors.light.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  section: { marginTop: spacing[8] },
  sectionFirst: {},
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  sectionEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.4, color: colors.olive[600], marginBottom: 4 },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: colors.olive[950] },
  sectionLink: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.olive[700] },
  taskCountPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, backgroundColor: "rgba(184,92,58,0.08)", marginBottom: 3 },
  taskCountDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: SELLER_RUST },
  taskCountText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: SELLER_RUST },
  taskPanel: { backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder, borderRadius: 22, overflow: "hidden" },
  taskRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sellerBorder },
  taskIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  taskIconWarn: { backgroundColor: "rgba(184,92,58,0.1)" },
  taskIconDone: { width: 32, height: 32, borderRadius: 16, marginHorizontal: 5 },
  taskText: { flex: 1, minWidth: 0, gap: 3 },
  taskTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.olive[950] },
  taskTitleDone: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: colors.ink.mute },
  taskSubtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  stockMeter: { flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: colors.olive[50], marginTop: 6 },
  stockMeterOut: { backgroundColor: SELLER_RUST },
  stockMeterLow: { backgroundColor: SELLER_GOLD },
  taskActionPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.olive[50] },
  taskActionPillWarn: { backgroundColor: colors.olive[900] },
  taskAction: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[700] },
  taskActionWarn: { color: SELLER_CREAM },
  primaryActions: { flexDirection: "row", gap: 10, marginTop: spacing[5] },
  addProductButton: { flex: 1, minHeight: 54, borderRadius: radii.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.olive[900] },
  addProductText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: SELLER_CREAM },
  viewStoreButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: radii.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder },
  viewStoreText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.olive[900] },
  listPanel: { backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder, borderRadius: 20, overflow: "hidden" },
  orderRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sellerBorder },
  lastRow: { borderBottomWidth: 0 },
  orderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  orderInfo: { flex: 1, minWidth: 0, gap: 4 },
  orderTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderNumber: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.olive[950] },
  orderMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  orderAmountWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  orderAmount: { fontFamily: fontFamilies.mono.semibold, fontSize: 13, color: colors.olive[950] },
  unavailableCard: { minHeight: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.light.card, borderWidth: 1, borderColor: sellerBorder, borderRadius: 20 },
  unavailableText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  updateCard: { marginTop: spacing[6], minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.paper.warm, borderRadius: 18, padding: 14 },
  updateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SELLER_GOLD },
  updateText: { flex: 1, minWidth: 0, gap: 1 },
  updateLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.2, color: colors.olive[600] },
  updateTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.olive[950] },
  updateBody: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  summaryFooter: { alignItems: "center", paddingVertical: spacing[7] },
  summaryText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, textAlign: "center" },
});
