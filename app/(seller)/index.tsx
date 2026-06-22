import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  TextInput,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerKPIs, getSellerProducts, getNotifications, createSellerStore, getSellerPayoutSettings, getSellerComplianceDocuments } from "@/lib/api";
import { getSellerAccessState } from "@/lib/seller-access";
import { colors, typography, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Store, Order, Product, Notification } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface KPIData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockVariants: number;
  recentOrders: Order[];
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const QUICK_ACTIONS = [
  { label: "Orders", icon: "receipt-outline" as const, route: "/(seller)/orders", color: colors.olive[600] },
  { label: "Returns", icon: "return-down-back-outline" as const, route: "/(seller)/returns", color: colors.accent2.rust },
  { label: "Products", icon: "cube-outline" as const, route: "/(seller)/products", color: colors.olive[700] },
  { label: "Inventory", icon: "layers-outline" as const, route: "/(seller)/inventory", color: colors.accent2.ochre },
  { label: "Analytics", icon: "bar-chart-outline" as const, route: "/(seller)/analytics", color: colors.olive[500] },
  { label: "Reviews", icon: "star-outline" as const, route: "/(seller)/reviews", color: colors.accent2.rust },
  { label: "Coupons", icon: "pricetag-outline" as const, route: "/(seller)/coupons", color: colors.olive[600] },
  { label: "Notifications", icon: "notifications-outline" as const, route: "/(seller)/notifications", color: colors.olive[700] },
  { label: "Settings", icon: "settings-outline" as const, route: "/(seller)/settings", color: colors.light.mutedForeground },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dbeafe", text: "#1e40af" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  shipped: { bg: "#fef3c7", text: "#92400e" },
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
};

export default function SellerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [accessBlocked, setAccessBlocked] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreSlug, setNewStoreSlug] = useState("");
  const [newStoreDescription, setNewStoreDescription] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (storeRes.ok && storeRes.data) {
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
        getSellerProducts(storeRes.data.id, { status: "active" }),
        getNotifications(user.id, 10),
      ]);
      if (kpiRes.ok) setKpis(kpiRes.data);
      if (prodRes.ok) setProducts(prodRes.data.products);
      if (notifRes.ok) setNotifications(notifRes.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      Alert.alert("Could not create store", res.error);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const today = new Date().toLocaleDateString("en-LK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Inventory stats
  const totalSkus = products.reduce((s, p) => s + (p.variants?.length ?? 0), 0);
  const lowStockCount = products.reduce(
    (s, p) => s + (p.variants ?? []).filter((v) => (v.stock ?? 0) > 0 && (v.stock ?? 0) < 5).length,
    0
  );
  const outOfStockCount = products.reduce(
    (s, p) => s + (p.variants ?? []).filter((v) => (v.stock ?? 0) === 0).length,
    0
  );
  const healthyCount = Math.max(0, totalSkus - lowStockCount - outOfStockCount);

  // Top products by sales
  const topProducts = [...products]
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 5);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="hourglass-outline" size={32} color={colors.light.mutedForeground} />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
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
          <Text style={styles.onboardingTitle}>Set up your store</Text>
          <Text style={styles.onboardingSub}>
            Create your seller profile to list products, manage orders, and track revenue.
          </Text>

          <Text style={styles.onboardingLabel}>Store name</Text>
          <TextInput
            style={styles.onboardingInput}
            value={newStoreName}
            onChangeText={setNewStoreName}
            placeholder="e.g. Luxe Boutique"
            placeholderTextColor={colors.light.mutedForeground}
          />

          <Text style={styles.onboardingLabel}>Store URL slug (optional)</Text>
          <TextInput
            style={styles.onboardingInput}
            value={newStoreSlug}
            onChangeText={setNewStoreSlug}
            placeholder="luxe-boutique"
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
              {creatingStore ? "Creating…" : "Create store"}
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
            onPress={() => router.push("/(seller)/settings")}
          >
            <Text style={styles.onboardingButtonText}>Complete store settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ═══ HERO ═══ */}
      <View style={styles.hero}>
        <View style={styles.heroBg} />
        <View style={styles.heroContent}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroDate}>{today}</Text>
              <Text style={styles.heroLabel}>Seller HQ</Text>
            </View>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <Text style={styles.heroGreeting}>{greeting},</Text>
          <Text style={styles.heroName}>{user?.user_metadata?.full_name?.split(" ")[0] ?? "there"}</Text>

          {store && (
            <Text style={styles.heroSub}>
              {store.name} has {kpis?.totalOrders ?? 0} orders and {formatPrice(kpis?.totalRevenue ?? 0)} revenue.
              {unreadCount > 0 ? ` ${unreadCount} new alert${unreadCount === 1 ? "" : "s"}.` : " You're all caught up."}
            </Text>
          )}

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroBtnPrimary} onPress={() => router.push("/(seller)/products" as any)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.heroBtnPrimaryText}>Add product</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroBtnSecondary} onPress={() => router.push("/(seller)/orders" as any)}>
              <Ionicons name="receipt-outline" size={16} color="#fff" />
              <Text style={styles.heroBtnSecondaryText}>Process orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ═══ INVENTORY ALERT ═══ */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => router.push("/(seller)/inventory" as any)}
        >
          <View style={styles.alertIconWrap}>
            <Ionicons name="warning" size={18} color="#fff" />
          </View>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Inventory needs attention</Text>
            <Text style={styles.alertSub}>
              {outOfStockCount > 0 && `${outOfStockCount} out of stock. `}
              {lowStockCount > 0 && `${lowStockCount} running low.`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#92400e" />
        </TouchableOpacity>
      )}

      {/* ═══ KPI BENTO ═══ */}
      {kpis && (
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiRevenue]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIcon, { backgroundColor: `${colors.olive[600]}15` }]}>
                <Ionicons name="wallet-outline" size={16} color={colors.olive[600]} />
              </View>
              <Text style={styles.kpiLabel}>Revenue</Text>
            </View>
            <Text style={styles.kpiValue}>{formatPrice(kpis.totalRevenue)}</Text>
            <Text style={styles.kpiSub}>Lifetime</Text>
          </View>

          <View style={[styles.kpiCard, styles.kpiOrders]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIcon, { backgroundColor: "#dbeafe" }]}>
                <Ionicons name="bag-check-outline" size={16} color="#3b82f6" />
              </View>
              <Text style={styles.kpiLabel}>Orders</Text>
            </View>
            <Text style={styles.kpiValue}>{kpis.totalOrders}</Text>
            <Text style={styles.kpiSub}>{kpis.pendingOrders} pending</Text>
          </View>

          <View style={[styles.kpiCard, styles.kpiProducts]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIcon, { backgroundColor: "#fef3c7" }]}>
                <Ionicons name="cube-outline" size={16} color="#d97706" />
              </View>
              <Text style={styles.kpiLabel}>Products</Text>
            </View>
            <Text style={styles.kpiValue}>{kpis.totalProducts}</Text>
            <Text style={styles.kpiSub}>In catalogue</Text>
          </View>

          <View style={[styles.kpiCard, kpis.lowStockVariants > 0 ? styles.kpiLowStock : styles.kpiHealthy]}>
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIcon, { backgroundColor: kpis.lowStockVariants > 0 ? "#fef3c7" : "#dcfce7" }]}>
                <Ionicons name={kpis.lowStockVariants > 0 ? "warning-outline" : "checkmark-circle-outline"} size={16} color={kpis.lowStockVariants > 0 ? "#d97706" : "#16a34a"} />
              </View>
              <Text style={styles.kpiLabel}>Stock</Text>
            </View>
            <Text style={[styles.kpiValue, kpis.lowStockVariants > 0 && { color: "#d97706" }]}>
              {kpis.lowStockVariants}
            </Text>
            <Text style={styles.kpiSub}>Low variants</Text>
          </View>
        </View>
      )}

      {/* ═══ QUICK ACTIONS ═══ */}
      <View style={styles.section}>
        <Text style={styles.sectionKicker}>GET THINGS MOVING</Text>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => router.push(a.route as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${a.color}12` }]}>
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ═══ INVENTORY PANEL ═══ */}
      {totalSkus > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>STOCK</Text>
              <Text style={styles.sectionTitle}>Inventory</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(seller)/inventory" as any)}>
              <Text style={styles.sectionLink}>Manage →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stockStats}>
            <View style={styles.stockStat}>
              <Text style={styles.stockStatValue}>{totalSkus}</Text>
              <Text style={styles.stockStatLabel}>Total SKUs</Text>
            </View>
            <View style={styles.stockStat}>
              <Text style={[styles.stockStatValue, { color: "#16a34a" }]}>{healthyCount}</Text>
              <Text style={styles.stockStatLabel}>Healthy</Text>
            </View>
            <View style={styles.stockStat}>
              <Text style={[styles.stockStatValue, { color: "#d97706" }]}>{lowStockCount}</Text>
              <Text style={styles.stockStatLabel}>Low</Text>
            </View>
            <View style={styles.stockStat}>
              <Text style={[styles.stockStatValue, { color: "#dc2626" }]}>{outOfStockCount}</Text>
              <Text style={styles.stockStatLabel}>Out</Text>
            </View>
          </View>

          {/* Stacked progress bar */}
          <View style={styles.stockBar}>
            <View style={[styles.stockBarFill, { width: `${totalSkus ? (healthyCount / totalSkus) * 100 : 0}%`, backgroundColor: "#16a34a" }]} />
            <View style={[styles.stockBarFill, { width: `${totalSkus ? (lowStockCount / totalSkus) * 100 : 0}%`, backgroundColor: "#d97706" }]} />
            <View style={[styles.stockBarFill, { width: `${totalSkus ? (outOfStockCount / totalSkus) * 100 : 0}%`, backgroundColor: "#dc2626" }]} />
          </View>
          <View style={styles.stockLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#16a34a" }]} />
              <Text style={styles.legendLabel}>Healthy</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#d97706" }]} />
              <Text style={styles.legendLabel}>Low</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#dc2626" }]} />
              <Text style={styles.legendLabel}>Out</Text>
            </View>
          </View>
        </View>
      )}

      {/* ═══ TOP PRODUCTS ═══ */}
      {topProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>BESTSELLERS</Text>
              <Text style={styles.sectionTitle}>Top products</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(seller)/products" as any)}>
              <Text style={styles.sectionLink}>All →</Text>
            </TouchableOpacity>
          </View>
          {topProducts.map((p, i) => {
            const img = p.images?.find((img) => img.is_primary)?.url || p.images?.[0]?.url;
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.topProductRow}
                onPress={() => router.push(`/(seller)/products/${p.id}` as any)}
              >
                <Text style={styles.topProductRank}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={styles.topProductImage}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.topProductImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.topProductImg, { backgroundColor: colors.light.muted, alignItems: "center", justifyContent: "center" }]}>
                      <Ionicons name="image-outline" size={16} color={colors.light.mutedForeground} />
                    </View>
                  )}
                </View>
                <View style={styles.topProductInfo}>
                  <Text style={styles.topProductName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.topProductSales}>{p.total_sales} sold</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ═══ RECENT ORDERS ═══ */}
      {kpis && kpis.recentOrders.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>ACTIVITY</Text>
              <Text style={styles.sectionTitle}>Recent orders</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(seller)/orders" as any)}>
              <Text style={styles.sectionLink}>View all →</Text>
            </TouchableOpacity>
          </View>
          {kpis.recentOrders.map((o) => {
            const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending;
            const itemsCount = o.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
            return (
              <TouchableOpacity
                key={o.id}
                style={styles.orderRow}
                onPress={() => router.push(`/(seller)/orders/${o.id}` as any)}
              >
                <View style={styles.orderIcon}>
                  <Ionicons name="bag-outline" size={16} color={colors.olive[600]} />
                </View>
                <View style={styles.orderInfo}>
                  <View style={styles.orderNumberRow}>
                    <Text style={styles.orderNumber}>{o.order_number}</Text>
                    <View style={[styles.orderStatus, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.orderStatusText, { color: sc.text }]}>{o.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderMeta}>
                    {itemsCount} item{itemsCount === 1 ? "" : "s"} · {formatRelative(o.placed_at)}
                  </Text>
                </View>
                <Text style={styles.orderTotal}>{formatPrice(o.total)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ═══ ACTIVITY FEED ═══ */}
      {notifications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>INBOX</Text>
              <Text style={styles.sectionTitle}>Activity</Text>
            </View>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
          {notifications.slice(0, 5).map((n) => {
            const isUnread = !n.read_at;
            const iconMap: Record<string, string> = {
              order: "bag-outline",
              inventory: "warning-outline",
              review: "star-outline",
              message: "chatbubble-outline",
            };
            return (
              <View
                key={n.id}
                style={[styles.notifRow, isUnread && styles.notifRowUnread]}
              >
                <View style={[styles.notifIcon, isUnread && styles.notifIconUnread]}>
                  <Ionicons
                    name={(iconMap[n.type] ?? "notifications-outline") as any}
                    size={16}
                    color={isUnread ? colors.olive[600] : colors.light.mutedForeground}
                  />
                </View>
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
                    {n.title}
                  </Text>
                  {n.body && (
                    <Text style={styles.notifBody} numberOfLines={1}>{n.body}</Text>
                  )}
                  <Text style={styles.notifTime}>{formatRelative(n.created_at)}</Text>
                </View>
                {isUnread && <View style={styles.notifDot} />}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing[3] },
  loadingText: { color: colors.light.mutedForeground, fontSize: typography.fontSizes.sm },

  onboardingContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing[5],
    paddingBottom: 120,
  },
  onboardingCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[5],
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
    backgroundColor: colors.light.background,
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
    backgroundColor: colors.light.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing[4],
    alignItems: "center",
    marginTop: spacing[4],
  },
  onboardingButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.base,
    fontFamily: fontFamilies.sans.semibold,
  },

  /* Hero */
  hero: {
    position: "relative",
    overflow: "hidden",
    borderBottomLeftRadius: radii["2xl"],
    borderBottomRightRadius: radii["2xl"],
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.olive[700],
  },
  heroContent: {
    position: "relative",
    padding: spacing[5],
    paddingTop: spacing[4],
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing[3],
  },
  heroDate: {
    fontSize: typography.fontSizes.xs,
    color: "rgba(255,255,255,0.6)",
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: typography.letterSpacing.wide,
  },
  heroLabel: {
    fontSize: typography.fontSizes.xs,
    color: "rgba(255,255,255,0.5)",
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: "uppercase",
    marginTop: 2,
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  liveText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontFamily: fontFamilies.mono.medium,
  },
  heroGreeting: {
    fontSize: typography.fontSizes.lg,
    color: "rgba(255,255,255,0.7)",
    fontFamily: fontFamilies.sans.regular,
  },
  heroName: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
    fontFamily: fontFamilies.display.regular,
    marginTop: 2,
  },
  heroSub: {
    fontSize: typography.fontSizes.sm,
    color: "rgba(255,255,255,0.7)",
    marginTop: spacing[2],
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[4],
  },
  heroBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  heroBtnPrimaryText: {
    color: colors.olive[700],
    fontSize: typography.fontSizes.sm,
    fontWeight: "600",
  },
  heroBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroBtnSecondaryText: {
    color: "#fff",
    fontSize: typography.fontSizes.sm,
    fontWeight: "500",
  },

  /* Alert */
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[3],
    backgroundColor: "#fef9ee",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#f0d68a",
    gap: spacing[3],
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: typography.fontSizes.sm, fontWeight: "600", color: "#92400e" },
  alertSub: { fontSize: typography.fontSizes.xs, color: "#a16207", marginTop: 2 },

  /* KPI Grid */
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    padding: spacing[4],
  },
  kpiCard: {
    width: (SCREEN_WIDTH - spacing[4] * 2 - spacing[2]) / 2,
    padding: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: `${colors.light.primary}12`,
  },
  kpiRevenue: {},
  kpiOrders: {},
  kpiProducts: {},
  kpiLowStock: { borderColor: "#f0d68a" },
  kpiHealthy: {},
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.light.foreground,
    fontFamily: fontFamilies.display.semibold,
  },
  kpiSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  /* Sections */
  section: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing[3],
  },
  sectionKicker: {
    fontSize: 10,
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: "700",
    color: colors.light.foreground,
    fontFamily: fontFamilies.display.regular,
  },
  sectionLink: {
    fontSize: typography.fontSizes.sm,
    color: colors.olive[600],
    fontWeight: "500",
  },

  /* Quick Actions */
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  actionCard: {
    width: (SCREEN_WIDTH - spacing[4] * 2 - spacing[2] * 3) / 4,
    alignItems: "center",
    padding: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.light.primary}10`,
    gap: spacing[2],
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.light.foreground,
    textAlign: "center",
  },

  /* Stock Stats */
  stockStats: {
    flexDirection: "row",
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  stockStat: {
    flex: 1,
    alignItems: "center",
    padding: spacing[2],
    backgroundColor: `${colors.light.primary}05`,
    borderRadius: radii.lg,
  },
  stockStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.light.foreground,
    fontFamily: fontFamilies.display.semibold,
  },
  stockStatLabel: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stockBar: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    backgroundColor: `${colors.light.primary}08`,
    overflow: "hidden",
    marginBottom: spacing[2],
  },
  stockBarFill: {
    height: "100%",
  },
  stockLegend: {
    flexDirection: "row",
    gap: spacing[4],
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    textTransform: "uppercase",
  },

  /* Top Products */
  topProductRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.light.primary}08`,
    marginBottom: spacing[2],
  },
  topProductRank: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: `${colors.light.foreground}25`,
    width: 28,
    textAlign: "center",
  },
  topProductImage: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  topProductImg: {
    width: "100%",
    height: "100%",
  },
  topProductInfo: { flex: 1 },
  topProductName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: "500",
    color: colors.light.foreground,
  },
  topProductSales: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    textTransform: "uppercase",
    marginTop: 2,
  },

  /* Orders */
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  orderIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: `${colors.olive[600]}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  orderInfo: { flex: 1 },
  orderNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  orderNumber: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.mono.semibold,
    color: colors.light.foreground,
  },
  orderStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  orderStatusText: {
    fontSize: 9,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  orderMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  orderTotal: {
    fontSize: typography.fontSizes.sm,
    fontWeight: "600",
    color: colors.light.foreground,
    fontFamily: fontFamilies.display.semibold,
  },

  /* Notifications */
  unreadBadge: {
    backgroundColor: colors.olive[600],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    marginBottom: spacing[2],
  },
  notifRowUnread: {
    backgroundColor: `${colors.olive[600]}06`,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}15`,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: `${colors.light.primary}08`,
    alignItems: "center",
    justifyContent: "center",
  },
  notifIconUnread: {
    backgroundColor: `${colors.olive[600]}15`,
  },
  notifContent: { flex: 1 },
  notifTitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  notifTitleUnread: {
    fontWeight: "600",
  },
  notifBody: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 9,
    color: `${colors.light.mutedForeground}80`,
    fontFamily: fontFamilies.mono.medium,
    textTransform: "uppercase",
    marginTop: 4,
  },
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
});
