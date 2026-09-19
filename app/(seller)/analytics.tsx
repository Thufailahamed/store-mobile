import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getStoreAnalytics, type SellerAnalyticsData } from "@/lib/api";
import type { SellerAnalyticsRange } from "@/lib/api/backend";
import { colors, shadows, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, pluralize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RevenueChart } from "@/components/seller/RevenueChart";
import { SellerScreenHeader, SellerStateView } from "@/components/seller/chrome";
import { formatCheckoutPayment, formatOrderStatusLabel } from "@/lib/orders/seller-list";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];
const GOLD = colors.accent2.ochre;
const RUST = colors.accent2.rust;

const RANGES: { key: SellerAnalyticsRange; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "1y", label: "1Y" },
];

const RANGE_LABEL: Record<SellerAnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last 12 months",
};

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

const STATUS_COLORS: Record<string, string> = {
  pending: GOLD,
  confirmed: colors.olive[400],
  processing: colors.olive[500],
  shipped: colors.olive[600],
  out_for_delivery: colors.olive[700],
  delivered: colors.olive[800],
  cancelled: RUST,
  returned: "#8a6a2a",
  refunded: "#7a3d28",
};

const PAYMENT_ICONS: Record<string, IonIconName> = {
  COD: "cash-outline",
  STRIPE: "card-outline",
  PAYMENTSLK: "card-outline",
  PAYPAL: "logo-paypal",
  WALLET: "wallet-outline",
  KOKO: "calendar-outline",
};

function DeltaPill({ value }: { value: number }) {
  if (!value) return <Text style={styles.deltaFlat}>No change</Text>;
  const up = value > 0;
  return (
    <View style={[styles.deltaPill, up ? styles.deltaUp : styles.deltaDown]}>
      <Ionicons
        name={up ? "arrow-up" : "arrow-down"}
        size={10}
        color={up ? "#4a7a3a" : RUST}
      />
      <Text style={[styles.deltaText, { color: up ? "#4a7a3a" : RUST }]}>
        {Math.abs(value).toFixed(0)}%
      </Text>
    </View>
  );
}

function PanelHeader({
  icon,
  kicker,
  title,
  actionLabel,
  onAction,
}: {
  icon: IonIconName;
  kicker: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.panelHeadRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.panelIconRow}>
          <Ionicons name={icon} size={13} color={colors.ink.mute} />
          <Text style={styles.panelKicker}>{kicker}</Text>
        </View>
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          <Text style={styles.link}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function SellerAnalyticsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<SellerAnalyticsRange>("30d");
  const [data, setData] = useState<SellerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextRange: SellerAnalyticsRange = range) => {
      if (!user) return;
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setError(storeRes.ok ? "No store found" : storeRes.error);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const res = await getStoreAnalytics(storeRes.data.id, nextRange);
      if (!res.ok) {
        setError(res.error);
        setData(null);
      } else {
        setError(null);
        setData(res.data);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [user, range],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load(range);
    }, [load, range]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load(range);
  };

  const onRange = (key: SellerAnalyticsRange) => {
    if (key === range) return;
    setRange(key);
    setLoading(true);
    void load(key);
  };

  const statusEntries = STATUS_ORDER.map((key) => ({
    key,
    count: data?.ordersByStatus?.[key] ?? 0,
    total: data?.statusTotals?.[key] ?? 0,
  })).filter((e) => e.count > 0);
  const statusMax = Math.max(...statusEntries.map((e) => e.count), 1);
  const refundPct = data
    ? data.refundRate <= 1
      ? data.refundRate * 100
      : data.refundRate
    : 0;

  const series = data?.revenueByMonth ?? [];
  const bestDay = series.length
    ? [...series].sort((a, b) => b.revenue - a.revenue)[0]
    : null;
  const activeDays = series.filter((s) => s.orders > 0).length;
  const avgPerDay = series.length ? Math.round((data?.totalRevenue ?? 0) / series.length) : 0;
  const bestDow = data?.dayOfWeek
    ? [...data.dayOfWeek].sort((a, b) => b.revenue - a.revenue)[0]
    : null;
  const dowMax = Math.max(...(data?.dayOfWeek ?? []).map((d) => d.revenue), 1);
  const inv = data?.inventory;
  const invHealthPct = inv && inv.totalSkus > 0 ? Math.round((inv.healthy / inv.totalSkus) * 100) : 100;
  const topProductMax = Math.max(...(data?.topProducts ?? []).map((p) => p.revenue), 1);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SellerScreenHeader
        kicker="Performance"
        title="Analytics"
        backLabel="Home"
        backHref="/(seller)"
      />

      <View style={styles.rangeWrap}>
        <View style={styles.segmentWrap}>
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => onRange(r.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Show ${RANGE_LABEL[r.key]}`}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.body}>
          <Skeleton height={190} borderRadius={radii["2xl"]} />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <Skeleton height={96} borderRadius={radii["2xl"]} style={{ flex: 1 }} />
            <Skeleton height={96} borderRadius={radii["2xl"]} style={{ flex: 1 }} />
          </View>
          <Skeleton height={230} borderRadius={radii["2xl"]} style={{ marginTop: 14 }} />
          <Skeleton height={160} borderRadius={radii["2xl"]} style={{ marginTop: 14 }} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, { paddingBottom: 120 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <SellerStateView
              variant="error"
              title="Couldn’t load analytics"
              description={error}
              actionLabel="Try again"
              onAction={onRefresh}
            />
          ) : data ? (
            <>
              {/* Hero revenue */}
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIconWrap}>
                    <Ionicons name="trending-up" size={18} color={GOLD} />
                  </View>
                  <View style={styles.rangeBadge}>
                    <Text style={styles.rangeBadgeText}>{RANGE_LABEL[range]}</Text>
                  </View>
                </View>
                <Text style={styles.heroLabel}>Total revenue</Text>
                <Text
                  style={styles.heroValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {formatPrice(data.totalRevenue)}
                </Text>
                <View style={styles.heroMeta}>
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="receipt-outline" size={13} color={GOLD} />
                    <Text style={styles.heroMetaValue}>{data.totalOrders}</Text>
                    <Text style={styles.heroMetaLabel}>{pluralize(data.totalOrders, "order")}</Text>
                  </View>
                  <View style={styles.heroMetaRule} />
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="pricetag-outline" size={13} color={GOLD} />
                    <Text style={styles.heroMetaValue}>{formatPrice(data.avgOrderValue)}</Text>
                    <Text style={styles.heroMetaLabel}>Avg order</Text>
                  </View>
                  <View style={styles.heroMetaRule} />
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="return-down-back-outline" size={13} color={GOLD} />
                    <Text style={styles.heroMetaValue}>{refundPct.toFixed(1)}%</Text>
                    <Text style={styles.heroMetaLabel}>Refund rate</Text>
                  </View>
                </View>
              </View>

              {/* KPI mini grid */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTop}>
                    <Text style={styles.kpiLabel}>Orders</Text>
                    <Ionicons name="receipt-outline" size={14} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.kpiValue}>{data.totalOrders}</Text>
                  <DeltaPill value={data.deltas.orders} />
                </View>
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTop}>
                    <Text style={styles.kpiLabel}>Avg order</Text>
                    <Ionicons name="pricetag-outline" size={14} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {formatPrice(data.avgOrderValue)}
                  </Text>
                  <DeltaPill value={data.deltas.aov} />
                </View>
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTop}>
                    <Text style={styles.kpiLabel}>Units sold</Text>
                    <Ionicons name="cube-outline" size={14} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.kpiValue}>{data.unitsSold}</Text>
                  <Text style={styles.kpiSub}>
                    {data.basket.avgUnitsPerOrder} per order
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <View style={styles.kpiTop}>
                    <Text style={styles.kpiLabel}>Refunds</Text>
                    <Ionicons name="return-down-back-outline" size={14} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.kpiValue}>{refundPct.toFixed(1)}%</Text>
                  <Text style={[styles.kpiSub, refundPct <= 3 ? styles.kpiGood : styles.kpiWarn]}>
                    {refundPct <= 3 ? "Healthy" : "Needs review"}
                  </Text>
                </View>
              </View>

              {/* Sales trend */}
              <View style={styles.panel}>
                <PanelHeader
                  icon="analytics-outline"
                  kicker="Trend"
                  title="Sales over time"
                />
                <RevenueChart
                  points={series.map((p) => ({
                    date: p.month,
                    revenue: p.revenue,
                    orders: p.orders,
                  }))}
                  height={176}
                />
                <View style={styles.insightsRow}>
                  <View style={styles.insightItem}>
                    <Text style={styles.insightLabel}>Peak day</Text>
                    <Text style={styles.insightValue} numberOfLines={1}>
                      {bestDay && bestDay.revenue > 0 ? formatPrice(bestDay.revenue) : "—"}
                    </Text>
                  </View>
                  <View style={styles.insightItem}>
                    <Text style={styles.insightLabel}>Daily average</Text>
                    <Text style={styles.insightValue} numberOfLines={1}>
                      {formatPrice(avgPerDay)}
                    </Text>
                  </View>
                  <View style={styles.insightItem}>
                    <Text style={styles.insightLabel}>Active days</Text>
                    <Text style={styles.insightValue} numberOfLines={1}>
                      {activeDays} of {series.length}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Order pipeline */}
              {statusEntries.length > 0 && (
                <View style={styles.panel}>
                  <PanelHeader
                    icon="git-network-outline"
                    kicker="Pipeline"
                    title="Orders by status"
                    actionLabel="Orders"
                    onAction={() => router.push("/(seller)/orders" as never)}
                  />
                  {statusEntries.map((entry) => {
                    const barColor = STATUS_COLORS[entry.key] ?? colors.olive[600];
                    return (
                      <View key={entry.key} style={styles.statusRow}>
                        <View style={styles.statusMeta}>
                          <View style={styles.statusNameRow}>
                            <View style={[styles.statusDot, { backgroundColor: barColor }]} />
                            <Text style={styles.statusName}>{formatOrderStatusLabel(entry.key)}</Text>
                          </View>
                          <Text style={styles.statusCount}>
                            {entry.count} · {formatPrice(entry.total)}
                          </Text>
                        </View>
                        <View style={styles.statusTrack}>
                          <View
                            style={[
                              styles.statusFill,
                              {
                                width: `${Math.max(8, (entry.count / statusMax) * 100)}%`,
                                backgroundColor: barColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Top products */}
              <View style={styles.panel}>
                <PanelHeader
                  icon="trophy-outline"
                  kicker="Bestsellers"
                  title="Top products"
                  actionLabel="Catalogue"
                  onAction={() => router.push("/(seller)/products" as never)}
                />
                {data.topProducts.length === 0 ? (
                  <EmptyState
                    framed={false}
                    icon="cube-outline"
                    title="No product sales yet"
                    description="Bestsellers appear once paid orders start coming in."
                    style={{ paddingVertical: 20 }}
                  />
                ) : (
                  data.topProducts.slice(0, 6).map((p, i) => {
                    const last = i === Math.min(data.topProducts.length, 6) - 1;
                    const podium = i < 3;
                    const sharePct = Math.round((p.revenue / topProductMax) * 100);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.productRow, last && styles.rowLast]}
                        onPress={() => router.push(`/(seller)/products/${p.id}` as never)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.name}, rank ${i + 1}`}
                      >
                        <View style={[styles.rankBadge, podium && styles.rankBadgeTop]}>
                          <Text style={[styles.rankText, podium && styles.rankTextTop]}>
                            {i + 1}
                          </Text>
                        </View>
                        <View style={styles.productInfo}>
                          <Text style={styles.productName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <View style={styles.productBarTrack}>
                            <View style={[styles.productBarFill, { width: `${Math.max(6, sharePct)}%` }]} />
                          </View>
                          <Text style={styles.productMeta}>
                            {p.units > 0 ? `${p.units} ${pluralize(p.units, "unit")} sold` : "Revenue ranked"}
                          </Text>
                        </View>
                        <Text style={styles.productRevenue}>{formatPrice(p.revenue)}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Best days of the week */}
              {data.dayOfWeek.some((d) => d.revenue > 0) && (
                <View style={styles.panel}>
                  <PanelHeader
                    icon="calendar-outline"
                    kicker="Rhythm"
                    title="Best days of the week"
                  />
                  {bestDow && bestDow.revenue > 0 ? (
                    <Text style={styles.dowSummary}>
                      {bestDow.day} is your strongest day — {formatPrice(bestDow.revenue)} across{" "}
                      {bestDow.orders} {pluralize(bestDow.orders, "order")}
                    </Text>
                  ) : null}
                  {data.dayOfWeek.map((d) => (
                    <View key={d.day} style={styles.dowRow}>
                      <Text style={styles.dowDay}>{d.day}</Text>
                      <View style={styles.dowTrack}>
                        <View
                          style={[
                            styles.dowFill,
                            { width: `${Math.max(2, (d.revenue / dowMax) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.dowValue} numberOfLines={1}>
                        {d.revenue > 0 ? formatPrice(d.revenue) : "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Inventory assets */}
              {inv && inv.totalSkus > 0 ? (
                <View style={styles.panel}>
                  <PanelHeader
                    icon="cube-outline"
                    kicker="Assets"
                    title="Inventory health"
                    actionLabel="Inventory"
                    onAction={() => router.push("/(seller)/inventory" as never)}
                  />
                  <View style={styles.invGrid}>
                    <View style={styles.invTile}>
                      <Text style={styles.invValue}>{inv.totalUnits.toLocaleString()}</Text>
                      <Text style={styles.invLabel}>Units on hand</Text>
                    </View>
                    <View style={styles.invTile}>
                      <Text style={styles.invValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {formatPrice(inv.valuation)}
                      </Text>
                      <Text style={styles.invLabel}>Stock valuation</Text>
                    </View>
                    <View style={styles.invTile}>
                      <Text style={styles.invValue}>{inv.reserved}</Text>
                      <Text style={styles.invLabel}>Held in carts</Text>
                    </View>
                    <View style={styles.invTile}>
                      <Text style={[styles.invValue, inv.low + inv.out > 0 && { color: "#8a6a2a" }]}>
                        {inv.low + inv.out}
                      </Text>
                      <Text style={styles.invLabel}>Low or out</Text>
                    </View>
                  </View>
                  <View style={styles.healthBarRow}>
                    <View style={styles.healthTrack}>
                      <View
                        style={[
                          styles.healthFill,
                          { width: `${(inv.healthy / Math.max(1, inv.totalSkus)) * 100}%`, backgroundColor: colors.olive[600] },
                        ]}
                      />
                      <View
                        style={[
                          styles.healthFill,
                          { width: `${(inv.low / Math.max(1, inv.totalSkus)) * 100}%`, backgroundColor: GOLD },
                        ]}
                      />
                      <View
                        style={[
                          styles.healthFill,
                          { width: `${(inv.out / Math.max(1, inv.totalSkus)) * 100}%`, backgroundColor: RUST },
                        ]}
                      />
                    </View>
                    <Text style={styles.healthPct}>{invHealthPct}% healthy</Text>
                  </View>
                  <View style={styles.healthLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.olive[600] }]} />
                      <Text style={styles.legendText}>Healthy ({inv.healthy})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: GOLD }]} />
                      <Text style={styles.legendText}>Low ({inv.low})</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: RUST }]} />
                      <Text style={styles.legendText}>Out ({inv.out})</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Merchandise mix */}
              {(data.merchandise.sizes.length > 0 || data.merchandise.colors.length > 0) && (
                <View style={styles.panel}>
                  <PanelHeader
                    icon="color-palette-outline"
                    kicker="Merchandise"
                    title="Stock by size & colour"
                  />
                  {data.merchandise.sizes.length > 0 ? (
                    <>
                      <Text style={styles.mixLabel}>Sizes</Text>
                      {data.merchandise.sizes.slice(0, 5).map((s) => (
                        <View key={s.label} style={styles.mixRow}>
                          <Text style={styles.mixName}>{s.label}</Text>
                          <View style={styles.mixTrack}>
                            <View style={[styles.mixFill, { width: `${Math.max(3, s.pct)}%` }]} />
                          </View>
                          <Text style={styles.mixValue}>{s.count}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                  {data.merchandise.colors.length > 0 ? (
                    <>
                      <Text style={[styles.mixLabel, { marginTop: 10 }]}>Colours</Text>
                      {data.merchandise.colors.slice(0, 5).map((c) => (
                        <View key={c.label} style={styles.mixRow}>
                          <Text style={styles.mixName} numberOfLines={1}>{c.label}</Text>
                          <View style={styles.mixTrack}>
                            <View
                              style={[
                                styles.mixFill,
                                { width: `${Math.max(3, c.pct)}%`, backgroundColor: GOLD },
                              ]}
                            />
                          </View>
                          <Text style={styles.mixValue}>{c.count}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </View>
              )}

              {/* Reviews */}
              {data.reviews.total > 0 ? (
                <View style={styles.panel}>
                  <PanelHeader
                    icon="star-outline"
                    kicker="Reputation"
                    title="Customer reviews"
                  />
                  <View style={styles.reviewTopRow}>
                    <View style={styles.reviewScoreWrap}>
                      <Text style={styles.reviewScore}>{data.reviews.avgRating.toFixed(1)}</Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons
                            key={i}
                            name={i <= Math.round(data.reviews.avgRating) ? "star" : "star-outline"}
                            size={13}
                            color={GOLD}
                          />
                        ))}
                      </View>
                      <Text style={styles.reviewCount}>
                        {data.reviews.total} {pluralize(data.reviews.total, "review")}
                      </Text>
                    </View>
                    <View style={styles.reviewBars}>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = data.reviews.breakdown[star] ?? 0;
                        const pct = data.reviews.total > 0 ? (count / data.reviews.total) * 100 : 0;
                        return (
                          <View key={star} style={styles.reviewBarRow}>
                            <Text style={styles.reviewBarLabel}>{star}</Text>
                            <View style={styles.reviewBarTrack}>
                              <View style={[styles.reviewBarFill, { width: `${Math.max(2, pct)}%` }]} />
                            </View>
                            <Text style={styles.reviewBarCount}>{count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  {data.reviews.recent.filter((r) => r.content).slice(0, 2).map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewCardTop}>
                        <View style={styles.reviewCardStars}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Ionicons
                              key={i}
                              name={i <= r.rating ? "star" : "star-outline"}
                              size={11}
                              color={GOLD}
                            />
                          ))}
                        </View>
                        <Text style={styles.reviewCardProduct} numberOfLines={1}>
                          {r.productName}
                        </Text>
                      </View>
                      <Text style={styles.reviewCardBody} numberOfLines={2}>
                        “{r.content}”
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Basket & payments */}
              {data.paymentMethods.length > 0 || data.basket.avgUnitsPerOrder > 0 ? (
                <View style={styles.panel}>
                  <PanelHeader
                    icon="wallet-outline"
                    kicker="Checkout"
                    title="Basket & payments"
                  />
                  <View style={styles.basketRow}>
                    <View style={styles.basketTile}>
                      <Text style={styles.basketValue}>{data.basket.avgUnitsPerOrder}</Text>
                      <Text style={styles.basketLabel}>Units per order</Text>
                    </View>
                    <View style={styles.basketTile}>
                      <Text style={styles.basketValue}>{data.basket.singleItemOrders}</Text>
                      <Text style={styles.basketLabel}>Single-item</Text>
                    </View>
                    <View style={styles.basketTile}>
                      <Text style={styles.basketValue}>{data.basket.multiItemOrders}</Text>
                      <Text style={styles.basketLabel}>Multi-item</Text>
                    </View>
                  </View>
                  {data.paymentMethods.length > 0 ? (
                    <View style={styles.paymentList}>
                      {data.paymentMethods.slice(0, 4).map((pm, i) => (
                        <View
                          key={pm.method}
                          style={[styles.paymentRow, i === Math.min(data.paymentMethods.length, 4) - 1 && styles.rowLast]}
                        >
                          <View style={styles.paymentIcon}>
                            <Ionicons
                              name={PAYMENT_ICONS[pm.method] ?? "card-outline"}
                              size={15}
                              color={colors.olive[800]}
                            />
                          </View>
                          <Text style={styles.paymentName}>{formatCheckoutPayment(pm.method)}</Text>
                          <View style={styles.paymentMeta}>
                            <Text style={styles.paymentRevenue}>{formatPrice(pm.revenue)}</Text>
                            <Text style={styles.paymentCount}>
                              {pm.count} {pluralize(pm.count, "order")}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Catalog & promos */}
              <View style={styles.panel}>
                <PanelHeader
                  icon="grid-outline"
                  kicker="Store"
                  title="Catalog & promotions"
                  actionLabel="Products"
                  onAction={() => router.push("/(seller)/products" as never)}
                />
                <View style={styles.catalogRow}>
                  <View style={styles.catalogTile}>
                    <Text style={styles.catalogValue}>{data.catalog.active}</Text>
                    <Text style={styles.catalogLabel}>Live products</Text>
                  </View>
                  <View style={styles.catalogTile}>
                    <Text style={styles.catalogValue}>{data.catalog.draft}</Text>
                    <Text style={styles.catalogLabel}>Drafts</Text>
                  </View>
                  <View style={styles.catalogTile}>
                    <Text style={styles.catalogValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatPrice(data.catalog.avgPrice)}
                    </Text>
                    <Text style={styles.catalogLabel}>Avg price</Text>
                  </View>
                </View>
                {data.coupons.total > 0 ? (
                  <View style={styles.couponRow}>
                    <View style={styles.couponIcon}>
                      <Ionicons name="pricetags-outline" size={14} color={colors.olive[800]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.couponTitle}>
                        {data.coupons.active} active {pluralize(data.coupons.active, "promotion")}
                      </Text>
                      <Text style={styles.couponSub}>
                        {data.coupons.redemptions} total redemptions
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} />
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <EmptyState
              icon="bar-chart-outline"
              title="No analytics yet"
              description="Metrics appear after your store receives paid orders."
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  rangeWrap: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: CREAM,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: colors.olive[900],
    ...shadows.soft,
  },
  segmentText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.olive[700],
  },
  segmentTextActive: { color: CREAM },
  scroll: { flex: 1 },
  body: { padding: spacing[5], paddingTop: 0, gap: 14 },

  /* Hero */
  heroCard: {
    backgroundColor: colors.olive[950],
    borderRadius: radii["2xl"],
    padding: spacing[5],
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
    ...shadows.soft,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  heroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(200,164,74,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  rangeBadge: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(250,248,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.25)",
  },
  rangeBadgeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.7)",
  },
  heroLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: GOLD,
  },
  heroValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 38,
    color: CREAM,
    letterSpacing: -0.8,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(250,248,241,0.12)",
  },
  heroMetaItem: { flex: 1, alignItems: "center", gap: 3 },
  heroMetaRule: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: "rgba(200,164,74,0.28)" },
  heroMetaValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: CREAM,
  },
  heroMetaLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: "rgba(250,248,241,0.55)",
    textTransform: "capitalize",
  },

  /* KPI mini grid */
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpiCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    padding: 14,
    gap: 6,
    ...shadows.soft,
  },
  kpiTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kpiLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  kpiValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  kpiSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
  },
  kpiGood: { color: "#4a7a3a", fontFamily: fontFamilies.sans.semibold },
  kpiWarn: { color: "#8a6a2a", fontFamily: fontFamilies.sans.semibold },
  deltaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    borderRadius: radii.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  deltaUp: { backgroundColor: "rgba(106,118,57,0.12)" },
  deltaDown: { backgroundColor: "rgba(184,92,58,0.10)" },
  deltaText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
  },
  deltaFlat: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
  },

  /* Panels */
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    padding: spacing[4],
    gap: 12,
    ...shadows.soft,
  },
  panelHeadRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  panelIconRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  panelKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  panelTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: INK,
  },
  link: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },

  /* Chart insights */
  insightsRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.1)",
  },
  insightItem: { flex: 1, gap: 3 },
  insightLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  insightValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },

  /* Status pipeline */
  statusRow: { gap: 7, marginBottom: 2 },
  statusMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  statusCount: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },
  statusTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
  },
  statusFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.olive[700],
  },

  /* Top products */
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.1)",
    minHeight: 54,
  },
  rowLast: { borderBottomWidth: 0 },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeTop: { backgroundColor: "rgba(200,164,74,0.2)" },
  rankText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: colors.olive[700],
  },
  rankTextTop: { color: "#8a6a2a" },
  productInfo: { flex: 1, gap: 4, minWidth: 0 },
  productName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  productBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
  },
  productBarFill: { height: "100%", borderRadius: 2, backgroundColor: colors.olive[600] },
  productMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
  },
  productRevenue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },

  /* Day of week */
  dowSummary: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    lineHeight: 19,
  },
  dowRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dowDay: {
    width: 34,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[700],
  },
  dowTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
  },
  dowFill: { height: "100%", borderRadius: 4, backgroundColor: GOLD },
  dowValue: {
    width: 74,
    textAlign: "right",
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
  },

  /* Inventory */
  invGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  invTile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
    padding: 12,
    gap: 3,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
  },
  invValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: INK,
    letterSpacing: -0.3,
  },
  invLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  healthBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  healthTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
    flexDirection: "row",
  },
  healthFill: { height: "100%" },
  healthPct: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[800],
  },
  healthLegend: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
  },

  /* Merchandise mix */
  mixLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  mixRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mixName: {
    width: 64,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
  },
  mixTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
  },
  mixFill: { height: "100%", borderRadius: 4, backgroundColor: colors.olive[600] },
  mixValue: {
    width: 36,
    textAlign: "right",
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },

  /* Reviews */
  reviewTopRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  reviewScoreWrap: { alignItems: "center", gap: 4, paddingRight: 6 },
  reviewScore: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    color: INK,
    letterSpacing: -0.5,
  },
  reviewStars: { flexDirection: "row", gap: 2 },
  reviewCount: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
  },
  reviewBars: { flex: 1, gap: 6 },
  reviewBarRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  reviewBarLabel: {
    width: 10,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.ink.mute,
    textAlign: "center",
  },
  reviewBarTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.olive[50],
    overflow: "hidden",
  },
  reviewBarFill: { height: "100%", borderRadius: 4, backgroundColor: GOLD },
  reviewBarCount: {
    width: 22,
    textAlign: "right",
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
  },
  reviewCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    padding: 12,
    gap: 6,
  },
  reviewCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  reviewCardStars: { flexDirection: "row", gap: 2 },
  reviewCardProduct: {
    flex: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
    textAlign: "right",
  },
  reviewCardBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[800],
    lineHeight: 17,
    fontStyle: "italic",
  },

  /* Basket & payments */
  basketRow: { flexDirection: "row", gap: 10 },
  basketTile: {
    flex: 1,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    padding: 12,
    alignItems: "center",
    gap: 3,
  },
  basketValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: INK,
  },
  basketLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink.mute,
    textAlign: "center",
  },
  paymentList: { gap: 2 },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.1)",
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  paymentName: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  paymentMeta: { alignItems: "flex-end", gap: 1 },
  paymentRevenue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  paymentCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.ink.mute,
  },

  /* Catalog & promos */
  catalogRow: { flexDirection: "row", gap: 10 },
  catalogTile: {
    flex: 1,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    padding: 12,
    alignItems: "center",
    gap: 3,
  },
  catalogValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: INK,
  },
  catalogLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink.mute,
    textAlign: "center",
  },
  couponRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    padding: 12,
  },
  couponIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(200,164,74,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  couponTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  couponSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
    marginTop: 1,
  },
});
