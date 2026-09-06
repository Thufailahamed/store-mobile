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
import { getSellerStore, getSellerKPIs, getSellerProducts, getNotifications, createSellerStore, getSellerPayoutSettings, getSellerComplianceDocuments } from "@/lib/api";
import { getSellerAccessState } from "@/lib/seller-access";
import { colors, typography, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, pluralize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Store, Order, Product, Notification } from "@/lib/types";

const GOLD = colors.accent2.ochre;
const RUST = colors.accent2.rust;
const INK = colors.olive[950];
const CREAM = colors.paper.cream;

interface KPIData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  totalSkus: number;
  recentOrders: Order[];
  analyticsReady: boolean;
  inventoryReady: boolean;
  productsReady: boolean;
  ordersReady: boolean;
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

const QUICK_ACTIONS = [
  { label: "Orders", icon: "receipt-outline" as const, route: "/(seller)/orders", badgeKey: "orders" as const },
  { label: "Collection", icon: "cube-outline" as const, route: "/(seller)/products" },
  { label: "Inventory", icon: "layers-outline" as const, route: "/(seller)/inventory", badgeKey: "inventory" as const },
  { label: "Returns", icon: "return-down-back-outline" as const, route: "/(seller)/returns" },
  { label: "Payouts", icon: "wallet-outline" as const, route: "/(seller)/payouts" },
  { label: "Reviews", icon: "star-outline" as const, route: "/(seller)/reviews" },
  { label: "Coupons", icon: "pricetag-outline" as const, route: "/(seller)/coupons" },
  { label: "Atelier notes", icon: "notifications-outline" as const, route: "/(seller)/notifications", badgeKey: "alerts" as const },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#f3efe2", text: "#8a6a2a" },
  confirmed: { bg: colors.olive[50], text: colors.olive[800] },
  processing: { bg: colors.olive[100], text: colors.olive[800] },
  shipped: { bg: "#f3efe2", text: "#8a6a2a" },
  delivered: { bg: colors.olive[50], text: colors.olive[700] },
  cancelled: { bg: colors.paper.warm, text: colors.ink.mute },
};

function GoldRule({ light = false }: { light?: boolean }) {
  return <View style={[styles.goldRule, light && styles.goldRuleLight]} />;
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
        getSellerProducts(storeRes.data.id, { status: "active" }),
        getNotifications(user.id, 10),
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
  const pendingOrders = kpis?.analyticsReady ? kpis.pendingOrders : 0;
  const ordersNeedWork = analyticsReady && pendingOrders > 0;
  const totalOrders = analyticsReady ? kpis!.totalOrders : null;
  const totalRevenue = analyticsReady ? kpis!.totalRevenue : null;
  const totalProducts = productsReady ? kpis!.totalProducts : (products.length > 0 ? products.length : null);
  const storeIsLive = store?.is_online === true;

  const topProducts = [...products]
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 5);
  const hasSales = topProducts.some((p) => (p.total_sales ?? 0) > 0);
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const storeName = store?.name ?? user?.user_metadata?.full_name?.split(" ")[0] ?? "Partner";
  const monogram = (store?.name ?? user?.user_metadata?.full_name ?? "S")[0].toUpperCase();

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={[INK, "#1c2413", "#2a3218"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={["rgba(200,164,74,0.12)", "transparent", "rgba(22,26,10,0.35)"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={[styles.heroContent, { paddingTop: Math.max(insets.top, 24) + 6 }]}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

          <View style={styles.heroTop}>
            <View style={styles.heroHeaderLeft}>
              <Text style={styles.heroDate}>{today.toUpperCase()}</Text>
              <Text style={styles.heroKicker}>Maison · Seller atelier</Text>
            </View>
            <View style={styles.heroHeaderRight}>
              <View
                style={[styles.liveTag, !storeIsLive && styles.liveTagOff]}
                accessibilityRole="text"
                accessibilityLabel={storeIsLive ? "Store is live" : "Store is offline"}
              >
                <View style={[styles.liveDot, !storeIsLive && styles.liveDotOff]} />
                <Text style={styles.liveText}>{storeIsLive ? "Live" : "Offline"}</Text>
              </View>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => router.push("/(seller)/notifications" as any)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
                }
              >
                <Ionicons name="notifications-outline" size={18} color={CREAM} />
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
              <Text style={styles.heroName} numberOfLines={1}>{storeName}</Text>
            </View>
          </View>

          <GoldRule light />

          <TouchableOpacity
            style={styles.ledgerHero}
            onPress={() => router.push("/(seller)/payouts" as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Revenue ${totalRevenue == null ? "unavailable" : formatPrice(totalRevenue)}`}
          >
            <Text style={styles.ledgerKicker}>Lifetime earnings</Text>
            <Text style={styles.ledgerValue} numberOfLines={1}>
              {totalRevenue == null ? "—" : formatPrice(totalRevenue)}
            </Text>
            <Text style={styles.ledgerHint}>
              {!analyticsReady
                ? "Analytics still loading"
                : (totalRevenue ?? 0) > 0
                ? "Payouts & statements"
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
              <Text style={[styles.heroMetaValue, ordersNeedWork && { color: GOLD }]}>
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
                  inventoryReady && stock.tone === "critical" && { color: "#e8b4a4" },
                  inventoryReady && stock.tone === "warn" && { color: GOLD },
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
                    <Text style={styles.heroBtnCountText}>{formatBadgeCount(pendingOrders)}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.heroBtnGhost}
                  onPress={() => router.push("/(seller)/products/new" as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Add product"
                >
                  <Text style={styles.heroBtnGhostText}>Add a piece</Text>
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
                  <Text style={styles.heroBtnPrimaryText}>Add a piece</Text>
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
        <View style={styles.heroGoldEdge} />
      </View>

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
            <Text style={styles.alertKicker}>Atelier notice</Text>
            <Text style={styles.alertTitle}>
              {outOfStockCount > 0 ? "The collection needs restocking" : "A few pieces are running low"}
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

      <View style={[styles.section, inventoryIssues === 0 && styles.bodyStart]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>The house</Text>
            <Text style={styles.sectionTitle}>Atelier</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.opsRail}
        >
          {QUICK_ACTIONS.map((a) => {
            const hasAlertBadge = a.badgeKey === "alerts" && unreadCount > 0;
            const hasOrderBadge = a.badgeKey === "orders" && pendingOrders > 0;
            const hasStockBadge = a.badgeKey === "inventory" && inventoryIssues > 0;
            const showBadge = hasAlertBadge || hasOrderBadge || hasStockBadge;
            const badgeCount = hasAlertBadge
              ? unreadCount
              : hasOrderBadge
              ? pendingOrders
              : inventoryIssues;

            return (
              <TouchableOpacity
                key={a.label}
                style={styles.opsPill}
                onPress={() => router.push(a.route as any)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <Ionicons name={a.icon} size={16} color={colors.olive[800]} />
                <Text style={styles.opsPillLabel}>{a.label}</Text>
                {showBadge && (
                  <View style={styles.opsPillBadge}>
                    <Text style={styles.opsPillBadgeText}>{formatBadgeCount(badgeCount)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {totalSkus > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>Stock room</Text>
              <Text style={styles.sectionTitle}>Inventory</Text>
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

          <View style={styles.panel}>
            <View style={styles.stockStats}>
              <View style={styles.stockStat}>
                <Text style={styles.stockStatValue}>{totalSkus}</Text>
                <Text style={styles.stockStatLabel}>SKUs</Text>
              </View>
              <View style={styles.panelRule} />
              <View style={styles.stockStat}>
                <Text style={[styles.stockStatValue, { color: colors.olive[700] }]}>{healthyCount}</Text>
                <Text style={styles.stockStatLabel}>Ready</Text>
              </View>
              <View style={styles.panelRule} />
              <View style={styles.stockStat}>
                <Text style={[styles.stockStatValue, { color: "#9a6b1f" }]}>{lowStockCount}</Text>
                <Text style={styles.stockStatLabel}>Low</Text>
              </View>
              <View style={styles.panelRule} />
              <View style={styles.stockStat}>
                <Text style={[styles.stockStatValue, { color: RUST }]}>{outOfStockCount}</Text>
                <Text style={styles.stockStatLabel}>Out</Text>
              </View>
            </View>

            <View style={styles.stockBar}>
              {healthyCount > 0 ? (
                <View style={[styles.stockBarFill, { flex: healthyCount, backgroundColor: colors.olive[600] }]} />
              ) : null}
              {lowStockCount > 0 ? (
                <View style={[styles.stockBarFill, { flex: lowStockCount, backgroundColor: GOLD }]} />
              ) : null}
              {outOfStockCount > 0 ? (
                <View style={[styles.stockBarFill, { flex: outOfStockCount, backgroundColor: RUST }]} />
              ) : null}
            </View>
            <View style={styles.stockLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.olive[600] }]} />
                <Text style={styles.legendLabel}>Ready</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: GOLD }]} />
                <Text style={styles.legendLabel}>Low</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: RUST }]} />
                <Text style={styles.legendLabel}>Out</Text>
              </View>
            </View>
          </View>
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
                    <Text style={styles.lookMeta}>
                      {p.total_sales} sold
                      {typeof p.price === "number" && p.price > 0 ? `  ·  ${formatPrice(p.price)}` : ""}
                    </Text>
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
              const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending;
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
                      <View style={[styles.orderStatus, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.orderStatusText, { color: sc.text }]}>{o.status}</Text>
                      </View>
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyKicker}>Awaiting the first client</Text>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>
              New commissions will appear here the moment a customer checks out.
            </Text>
          </View>
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
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
              </View>
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
              const isUnread = !n.read_at;
              const last = i === Math.min(notifications.length, 5) - 1;
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
                    {n.body ? (
                      <Text style={styles.notifBody} numberOfLines={1}>{n.body}</Text>
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
    backgroundColor: INK,
  },
  heroContent: {
    position: "relative",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[7],
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
    alignItems: "flex-start",
    marginBottom: spacing[6],
  },
  heroHeaderLeft: { gap: 6 },
  heroDate: {
    fontSize: 11,
    color: "rgba(250,248,241,0.62)",
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.6,
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
    backgroundColor: "rgba(200,164,74,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    minHeight: 36,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.35)",
  },
  liveTagOff: {
    backgroundColor: "rgba(250,248,241,0.08)",
    borderColor: "rgba(250,248,241,0.16)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  liveDotOff: {
    backgroundColor: "rgba(250,248,241,0.4)",
  },
  liveText: {
    fontSize: 11,
    color: CREAM,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.8,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(250,248,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.16)",
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
    gap: spacing[4],
    marginBottom: spacing[5],
  },
  storeLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  storeMonogram: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  storeMonogramText: {
    fontSize: 24,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[800],
  },
  greetingWrap: { flex: 1 },
  heroGreeting: {
    fontSize: 15,
    color: "rgba(250,248,241,0.7)",
    fontFamily: fontFamilies.display.italic,
  },
  heroName: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fontFamilies.display.semibold,
    color: CREAM,
    marginTop: 2,
  },
  ledgerHero: {
    marginBottom: spacing[5],
  },
  ledgerKicker: {
    fontSize: 11,
    color: GOLD,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  ledgerValue: {
    fontSize: 36,
    lineHeight: 42,
    fontFamily: fontFamilies.display.semibold,
    color: CREAM,
  },
  ledgerHint: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(250,248,241,0.58)",
    fontFamily: fontFamilies.sans.regular,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing[6],
    paddingVertical: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.28)",
  },
  heroMetaItem: {
    flex: 1,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  heroMetaValue: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: CREAM,
  },
  heroMetaLabel: {
    marginTop: 3,
    fontSize: 11,
    color: "rgba(250,248,241,0.58)",
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroMetaRule: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: "rgba(200,164,74,0.35)",
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
  },
  heroBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: CREAM,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: radii.full,
    ...shadows.soft,
  },
  heroBtnPrimaryText: {
    color: colors.olive[900],
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
    letterSpacing: 0.2,
  },
  heroBtnCount: {
    backgroundColor: colors.olive[800],
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  heroBtnCountText: {
    color: CREAM,
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
  },
  heroBtnGhost: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  heroBtnGhostText: {
    color: CREAM,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.3,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(200,164,74,0.7)",
  },
  heroGoldEdge: {
    height: 2,
    backgroundColor: GOLD,
  },

  alertRibbon: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    backgroundColor: CREAM,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.22)",
    minHeight: 72,
    ...shadows.soft,
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
    marginTop: spacing[7],
  },
  bodyStart: {
    marginTop: spacing[6],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing[4],
    paddingRight: spacing[5],
  },
  sectionKicker: {
    fontSize: 11,
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.ink.DEFAULT,
    fontFamily: fontFamilies.display.regular,
  },
  sectionLink: {
    fontSize: 13,
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.3,
  },

  opsRail: {
    paddingRight: spacing[5],
    gap: spacing[2],
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
