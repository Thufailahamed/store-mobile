import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getAdminOverviewStats,
  getAdminPendingApprovals,
  getAdminLowStock,
  getAdminRecentSignups,
  getAdminRecentOrders,
  getAdminAuditLog,
  approveStore,
  approveBrand,
  approveProduct,
} from "@/lib/api";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { StatusDot, Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

function formatRelative(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
}

function formatClock() {
  return new Intl.DateTimeFormat("en-LK", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger" | "info" | "muted"> = {
  pending: "warning",
  confirmed: "info",
  processing: "info",
  shipped: "default",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "danger",
  returned: "danger",
  refunded: "muted",
};

export default function AdminOverview() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [clock, setClock] = useState(formatClock());

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 60_000);
    return () => clearInterval(id);
  }, []);

  const refreshAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  }, [qc]);

  const statsQ = useQuery({
    queryKey: ["admin-overview", "stats"],
    queryFn: async () => {
      const r = await getAdminOverviewStats();
      return r.ok ? r.data : null;
    },
    refetchInterval: 30_000,
  });

  const approvalsQ = useQuery({
    queryKey: ["admin-overview", "approvals"],
    queryFn: async () => {
      const r = await getAdminPendingApprovals(6);
      return r.ok ? r.data : { stores: [], brands: [], products: [] };
    },
    refetchInterval: 30_000,
  });

  const lowStockQ = useQuery({
    queryKey: ["admin-overview", "low-stock"],
    queryFn: async () => {
      const r = await getAdminLowStock(5);
      return r.ok ? r.data : [];
    },
    refetchInterval: 60_000,
  });

  const signupsQ = useQuery({
    queryKey: ["admin-overview", "signups"],
    queryFn: async () => {
      const r = await getAdminRecentSignups(4);
      return r.ok ? r.data : [];
    },
  });

  const ordersQ = useQuery({
    queryKey: ["admin-overview", "recent-orders"],
    queryFn: async () => {
      const r = await getAdminRecentOrders(4);
      return r.ok ? r.data : [];
    },
  });

  const auditQ = useQuery({
    queryKey: ["admin-overview", "audit"],
    queryFn: async () => {
      const r = await getAdminAuditLog(5);
      return r.ok ? r.data : [];
    },
  });

  const s = statsQ.data;
  const a = approvalsQ.data;
  const isLoading = statsQ.isLoading;
  const refreshing = statsQ.isFetching || approvalsQ.isFetching;

  const approveStoreM = useMutation({
    mutationFn: (id: string) => approveStore(id, "approved"),
    onSuccess: () => refreshAll(),
  });
  const rejectStoreM = useMutation({
    mutationFn: (id: string) => approveStore(id, "rejected"),
    onSuccess: () => refreshAll(),
  });
  const approveBrandM = useMutation({
    mutationFn: (id: string) => approveBrand(id, "approved"),
    onSuccess: () => refreshAll(),
  });
  const approveProductM = useMutation({
    mutationFn: (id: string) => approveProduct(id, "active"),
    onSuccess: () => refreshAll(),
  });

  const merged = [
    ...(a?.stores ?? []).map((r: any) => ({ ...r, kind: "Store" as const })),
    ...(a?.brands ?? []).map((r: any) => ({ ...r, kind: "Brand" as const })),
    ...(a?.products ?? []).map((r: any) => ({ ...r, kind: "Product" as const })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const pendingTotal = (s?.pendingStores ?? 0) + (s?.pendingBrands ?? 0) + (s?.pendingProducts ?? 0);
  const activeStoreRate = s?.stores ? (s.activeStores / s.stores) * 100 : 0;
  const customerShare = s?.users ? (s.customers / s.users) * 100 : 0;

  const adminName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Admin";

  const greeting = greetingFor(new Date().getHours());
  const revenueParts = splitCurrency(formatPrice(s?.revenue ?? 0));
  const lowStockCount = lowStockQ.data?.length ?? 0;
  const signupCount = signupsQ.data?.length ?? 0;

  const confirmApprove = (row: { id: string; name: string; kind: "Store" | "Brand" | "Product" }) => {
    const m =
      row.kind === "Store" ? approveStoreM : row.kind === "Brand" ? approveBrandM : approveProductM;
    Alert.alert(`Approve ${row.kind}`, row.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => m.mutate(row.id) },
    ]);
  };

  const confirmRejectStore = (row: { id: string; name: string }) =>
    Alert.alert("Reject Store", row.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => rejectStoreM.mutate(row.id) },
    ]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.light.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. Editorial Masthead ─────────────────────────────── */}
      <View style={styles.masthead}>
        <View style={styles.mastheadTop}>
          <View style={styles.livePill}>
            <StatusDot tone="live" size={6} />
            <Text style={styles.livePillText}>PLATFORM ONLINE</Text>
          </View>
          <View style={styles.clockWrap}>
            <Ionicons name="time-outline" size={11} color={colors.ink.mute} />
            <Text style={styles.clockText}>{clock}</Text>
          </View>
        </View>

        <Text style={styles.greeting}>
          {greeting}, <Text style={styles.greetingName}>{adminName}</Text>
        </Text>
        <Text style={styles.headline}>
          Command <Text style={styles.headlineAccent}>Deck</Text>
        </Text>
        <View style={styles.mastheadRule}>
          <View style={styles.mastheadRuleAccent} />
          <Text style={styles.mastheadRuleText}>LUXE · EXECUTIVE OVERVIEW</Text>
          <View style={styles.mastheadRuleLine} />
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickAction
            label="Analytics"
            icon="bar-chart-outline"
            onPress={() => router.push("/(admin)/analytics" as any)}
          />
          <QuickAction
            label="Inventory"
            icon="cube-outline"
            onPress={() => router.push("/(admin)/catalogue" as any)}
          />
          <QuickAction
            label="Approvals"
            icon="shield-checkmark-outline"
            count={pendingTotal}
            highlight={pendingTotal > 0}
            onPress={() => router.push("/(admin)/approvals" as any)}
          />
        </View>
      </View>

      {/* ── 2. Hero Performance Deck ──────────────────────────── */}
      {isLoading ? (
        <View style={[styles.heroShell, styles.heroSkeleton]}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="70%" height={40} style={{ marginTop: 16 }} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
            <Skeleton width="31%" height={64} />
            <Skeleton width="31%" height={64} />
            <Skeleton width="31%" height={64} />
          </View>
        </View>
      ) : (
        <View style={styles.heroShell}>
          <LinearGradient
            colors={["#3a4120", colors.olive[900], "#14170a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            {/* Decorative glow + guilloché rings */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="glow" cx="88%" cy="6%" r="60%">
                    <Stop offset="0" stopColor={colors.accent2.ochre} stopOpacity="0.32" />
                    <Stop offset="1" stopColor={colors.accent2.ochre} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
                {[70, 110, 150, 190].map((r) => (
                  <Circle
                    key={r}
                    cx="100%"
                    cy="0"
                    r={r}
                    stroke="rgba(232,212,150,0.07)"
                    strokeWidth={1}
                    fill="none"
                  />
                ))}
              </Svg>
            </View>
            <View style={styles.heroHairline} />

            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="pulse-outline" size={15} color={GOLD_LIGHT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>MARKETPLACE VOLUME</Text>
                <Text style={styles.heroEyebrowSub}>Gross · settled</Text>
              </View>
              <LinearGradient
                colors={[GOLD_LIGHT, colors.accent2.ochre]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBadge}
              >
                <Ionicons name="trending-up" size={11} color={colors.olive[900]} />
                <Text style={styles.heroBadgeText}>LIVE</Text>
              </LinearGradient>
            </View>

            {revenueParts.currency ? (
              <Text style={styles.heroCurrency}>{revenueParts.currency}</Text>
            ) : null}
            <Text style={styles.heroMainValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {revenueParts.amount}
            </Text>
            <Text style={styles.heroSub}>Aggregated settled marketplace volume</Text>

            <View style={styles.heroMetrics}>
              <HeroMetric
                icon="receipt-outline"
                label="ORDERS"
                value={(s?.orders ?? 0).toLocaleString()}
                sub={`${formatPrice(s?.aov ?? 0)} avg`}
              />
              <HeroMetric
                icon="storefront-outline"
                label="ATELIERS"
                value={String(s?.activeStores ?? 0)}
                total={s?.stores ?? 0}
                sub={`${activeStoreRate.toFixed(0)}% live`}
              />
              <HeroMetric
                icon="pricetags-outline"
                label="CATALOGUE"
                value={(s?.products ?? 0).toLocaleString()}
                sub={`${s?.brands ?? 0} brands`}
              />
            </View>

            {pendingTotal > 0 ? (
              <Pressable
                onPress={() => router.push("/(admin)/approvals" as any)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={["#fbf0cf", "#f2dd9c"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionBanner}
                >
                  <View style={styles.actionBannerCount}>
                    <Text style={styles.actionBannerCountText}>{pendingTotal}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionBannerTitle}>
                      Submission{pendingTotal > 1 ? "s" : ""} awaiting review
                    </Text>
                    <Text style={styles.actionBannerSub}>Moderation queue needs attention</Text>
                  </View>
                  <View style={styles.actionBannerBtn}>
                    <Ionicons name="arrow-forward" size={15} color={colors.accent2.ochre} />
                  </View>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.nominalBanner}>
                <Ionicons name="checkmark-circle" size={15} color={GOLD_LIGHT} />
                <Text style={styles.nominalBannerText}>All submission queues nominal · 0 pending</Text>
              </View>
            )}
          </LinearGradient>
        </View>
      )}

      {/* ── 3. Priority Moderation Queue ───────────────────────── */}
      <View style={styles.sectionCard}>
        <SectionHead
          eyebrow="MODERATION"
          title="Priority Queue"
          count={pendingTotal}
          linkLabel="View all"
          onLink={() => router.push("/(admin)/approvals" as any)}
        />

        {merged.length === 0 ? (
          <EmptyBlock
            icon="checkmark-done-outline"
            title="Inbox zero"
            sub="Every submission has been reviewed."
          />
        ) : (
          merged.map((row, i) => (
            <View key={`${row.kind}-${row.id}`} style={[styles.queueRow, i > 0 && styles.rowDivider]}>
              <View style={[styles.queueIcon, { backgroundColor: kindBg(row.kind) }]}>
                <Ionicons name={kindIcon(row.kind)} size={17} color={kindFg(row.kind)} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.name}
                </Text>
                <View style={styles.rowMetaLine}>
                  <View style={[styles.kindTag, { borderColor: kindFg(row.kind) + "33" }]}>
                    <Text style={[styles.kindTagText, { color: kindFg(row.kind) }]}>
                      {row.kind.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.rowMeta}>{formatRelative(row.created_at)}</Text>
                </View>
              </View>
              <View style={styles.queueActions}>
                {row.kind === "Store" ? (
                  <Pressable
                    onPress={() => confirmRejectStore(row)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={15} color={colors.light.destructive} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => confirmApprove(row)}
                  hitSlop={6}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={[colors.olive[500], colors.olive[700]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.approveBtn}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.paper.cream} />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── 4. Operational Health (2x2 ring gauges) ─────────────── */}
      <View style={styles.gridHeader}>
        <Text style={styles.sectionEyebrow}>TELEMETRY</Text>
        <Text style={styles.sectionTitle}>Operational Health</Text>
      </View>
      <View style={styles.telemetryGrid}>
        <TelemetryCard
          label="Store activation"
          value={`${activeStoreRate.toFixed(0)}%`}
          sub={`${s?.activeStores ?? 0} of ${s?.stores ?? 0} live`}
          pct={activeStoreRate}
          icon="storefront-outline"
          color={colors.olive[600]}
        />
        <TelemetryCard
          label="Customer share"
          value={`${customerShare.toFixed(0)}%`}
          sub={`${s?.customers ?? 0} purchasers`}
          pct={customerShare}
          icon="people-outline"
          color={colors.accent2.ochre}
        />
        <TelemetryCard
          label="Low stock"
          value={String(lowStockCount)}
          sub="Variants near limit"
          pct={Math.min(100, lowStockCount * 20)}
          icon="alert-circle-outline"
          color={colors.accent2.rust}
          alert={lowStockCount > 0}
        />
        <TelemetryCard
          label="New accounts"
          value={String(signupCount)}
          sub="Recent registrations"
          pct={Math.min(100, signupCount * 25)}
          icon="person-add-outline"
          color={colors.olive[400]}
        />
      </View>

      {/* ── 5. Recent Orders Stream ────────────────────────────── */}
      <View style={styles.sectionCard}>
        <SectionHead
          eyebrow="DISPATCH"
          title="Recent Orders"
          linkLabel="View all"
          onLink={() => router.push("/(admin)/orders" as any)}
        />

        {(ordersQ.data ?? []).length === 0 ? (
          <EmptyBlock icon="receipt-outline" title="No orders yet" sub="New orders will stream in here." />
        ) : (
          (ordersQ.data ?? []).map((o: any, i: number) => {
            const tone = STATUS_TONE[o.status] ?? "muted";
            const name = o.user?.full_name ?? "Direct Customer";
            return (
              <Pressable
                key={o.id}
                onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: o.id } })}
                style={({ pressed }) => [styles.orderRow, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
              >
                <View style={styles.monogram}>
                  <Text style={styles.monogramText}>{initials(name)}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.rowMetaMono} numberOfLines={1}>
                    #{o.order_number ?? o.id.slice(0, 8)} · {formatRelative(o.placed_at)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 5 }}>
                  <Text style={styles.orderAmount}>{formatPrice(Number(o.total ?? 0), o.currency ?? "LKR")}</Text>
                  <View style={[styles.statusPill, { backgroundColor: pillBg(tone) }]}>
                    <View style={[styles.statusPillDot, { backgroundColor: pillFg(tone) }]} />
                    <Text style={[styles.statusPillText, { color: pillFg(tone) }]}>
                      {String(o.status).replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      {/* ── 6. Activity Timeline ───────────────────────────────── */}
      <View style={styles.sectionCard}>
        <SectionHead
          eyebrow="AUDIT LOG"
          title="Live Activity"
          linkLabel="Stream"
          onLink={() => router.push("/(admin)/audit-log" as any)}
        />

        {(auditQ.data ?? []).length === 0 ? (
          <EmptyBlock icon="time-outline" title="All quiet" sub="No recent system activity recorded." />
        ) : (
          (auditQ.data ?? []).map((e: any, i: number, arr: any[]) => (
            <View key={e.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDotOuter, { borderColor: auditColor(e.action) + "55" }]}>
                  <View style={[styles.timelineDot, { backgroundColor: auditColor(e.action) }]} />
                </View>
                {i < arr.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineBody}>
                <View style={styles.timelineHead}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {humanize(e.action)}
                  </Text>
                  <Text style={styles.timelineTime}>{formatRelative(e.created_at)}</Text>
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  by {e.actor_name ?? "Administrator"}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── 7. Console Hub ─────────────────────────────────────── */}
      <View style={styles.gridHeader}>
        <Text style={styles.sectionEyebrow}>NAVIGATION</Text>
        <Text style={styles.sectionTitle}>Console Hub</Text>
      </View>
      <View style={styles.hubGrid}>
        <HubTile label="Analytics" sub="Revenue & telemetry" icon="bar-chart-outline" tint={colors.olive[600]} onPress={() => router.push("/(admin)/analytics" as any)} />
        <HubTile label="Delivery" sub="Riders & dispatches" icon="car-outline" tint={colors.accent2.ochre} onPress={() => router.push("/(admin)/delivery" as any)} />
        <HubTile label="Couriers" sub="3PL integrations" icon="bicycle-outline" tint={colors.accent2.rust} onPress={() => router.push("/(admin)/courier" as any)} />
        <HubTile label="Commissions" sub="Payout rates & tiers" icon="wallet-outline" tint={colors.olive[500]} onPress={() => router.push("/(admin)/commissions" as any)} />
        <HubTile label="Homepage CMS" sub="Sections & layout" icon="globe-outline" tint={colors.ink.soft} onPress={() => router.push("/(admin)/homepage" as any)} />
        <HubTile label="Gift Cards" sub="Codes & balances" icon="gift-outline" tint="#8a6a2a" onPress={() => router.push("/(admin)/gift-cards" as any)} />
      </View>
    </ScrollView>
  );
}

/* ───────────────────────── Components ───────────────────────── */

const GOLD_LIGHT = "#e8d496";

function QuickAction({
  label,
  icon,
  count,
  highlight,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  highlight?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, highlight && styles.quickActionHighlight, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, highlight && styles.quickIconHighlight]}>
        <Ionicons name={icon} size={17} color={highlight ? "#7a5b1a" : colors.olive[700]} />
        {count ? (
          <View style={styles.quickBadge}>
            <Text style={styles.quickBadgeText}>{count > 99 ? "99+" : count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.quickLabel, highlight && { color: "#7a5b1a" }]}>{label}</Text>
    </Pressable>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  total,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  total?: number;
  sub: string;
}) {
  return (
    <View style={styles.heroMetric}>
      <View style={styles.heroMetricTop}>
        <Ionicons name={icon} size={11} color="rgba(232,212,150,0.75)" />
        <Text style={styles.heroMetricLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.heroMetricValue} numberOfLines={1}>
        {value}
        {total !== undefined ? <Text style={styles.heroMetricTotal}> / {total}</Text> : null}
      </Text>
      <Text style={styles.heroMetricSub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

function SectionHead({
  eyebrow,
  title,
  count,
  linkLabel,
  onLink,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  linkLabel?: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {count ? (
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{count}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {linkLabel && onLink ? (
        <Pressable onPress={onLink} hitSlop={10} style={({ pressed }) => [styles.linkPill, pressed && styles.pressed]}>
          <Text style={styles.linkPillText}>{linkLabel}</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.olive[700]} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyBlock({ icon, title, sub }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.olive[600]} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

function RingGauge({ pct, color, size = 46, stroke = 4 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.light.muted} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - clamped / 100)}
      />
    </Svg>
  );
}

function TelemetryCard({
  label,
  value,
  sub,
  pct,
  icon,
  color,
  alert,
}: {
  label: string;
  value: string;
  sub: string;
  pct: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  alert?: boolean;
}) {
  return (
    <View style={styles.telemetryCard}>
      <View style={styles.telemetryTop}>
        <View style={styles.ringWrap}>
          <RingGauge pct={pct} color={color} />
          <View style={styles.ringIcon}>
            <Ionicons name={icon} size={15} color={color} />
          </View>
        </View>
        {alert ? (
          <View style={styles.alertChip}>
            <Text style={styles.alertChipText}>ALERT</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.telemetryValue, alert && { color: colors.accent2.rust }]}>{value}</Text>
      <Text style={styles.telemetryLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.telemetrySub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

function HubTile({
  label,
  sub,
  icon,
  tint,
  onPress,
}: {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.hubTile, pressed && styles.pressed]}>
      <View style={styles.hubTop}>
        <View style={[styles.hubIconWrap, { backgroundColor: tint + "1A", borderColor: tint + "33" }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <Ionicons name="arrow-forward" size={14} color={colors.light.mutedForeground} style={styles.hubArrow} />
      </View>
      <Text style={styles.hubLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.hubSub} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

function greetingFor(h: number) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function splitCurrency(formatted: string) {
  const m = formatted.match(/^([A-Za-z]{2,4}|[^\d\s-]+)\s?(.+)$/);
  if (!m) return { currency: "", amount: formatted };
  return { currency: m[1], amount: m[2] };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function kindIcon(kind: string): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "Store": return "storefront-outline";
    case "Brand": return "ribbon-outline";
    default: return "cube-outline";
  }
}

function kindBg(kind: string) {
  switch (kind) {
    case "Store": return "#e4e9dc";
    case "Brand": return "#fbf1d6";
    default: return "#f9e6dd";
  }
}

function kindFg(kind: string) {
  switch (kind) {
    case "Store": return colors.olive[700];
    case "Brand": return "#8a6a2a";
    default: return "#a14a2c";
  }
}

function pillBg(tone: string) {
  switch (tone) {
    case "success": return "#e3ecd0";
    case "warning": return "#fbf1d6";
    case "danger": return "#f9e6dd";
    case "info": return "#e4e9dc";
    default: return colors.light.secondary;
  }
}

function pillFg(tone: string) {
  switch (tone) {
    case "success": return "#3d4a1f";
    case "warning": return "#8a6a2a";
    case "danger": return "#a14a2c";
    case "info": return colors.olive[700];
    default: return colors.light.mutedForeground;
  }
}

function humanize(s: string) {
  return s.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function auditColor(action: string) {
  if (action.includes("delete") || action.includes("reject") || action.includes("ban")) return colors.light.destructive;
  if (action.includes("create") || action.includes("approve")) return colors.olive[600];
  if (action.includes("update")) return colors.accent2.ochre;
  return colors.olive[300];
}

/* ───────────────────────── Styles ───────────────────────── */

const cardShadow = {
  shadowColor: "#2c3119",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.07,
  shadowRadius: 22,
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 140 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  rowPressed: { opacity: 0.6 },

  /* ── Masthead ─────────────────────────────── */
  masthead: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  mastheadTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.paper.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive[200],
  },
  livePillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[700],
    letterSpacing: 1.2,
  },
  clockWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  clockText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 0.2,
  },
  greeting: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.ink.mute,
    marginTop: 22,
  },
  greetingName: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.ink.soft,
  },
  headline: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 42,
    color: colors.ink.DEFAULT,
    letterSpacing: -1.4,
    lineHeight: 48,
    marginTop: 2,
  },
  headlineAccent: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  mastheadRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  mastheadRuleAccent: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent2.ochre,
  },
  mastheadRuleText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.ink.mute,
  },
  mastheadRuleLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
    borderRadius: radii["2xl"],
    backgroundColor: colors.paper.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    ...cardShadow,
    shadowOpacity: 0.05,
  },
  quickActionHighlight: {
    backgroundColor: "#fdf6e2",
    borderColor: "#ecd590",
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  quickIconHighlight: { backgroundColor: "#f7e7b4" },
  quickBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fdf6e2",
  },
  quickBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: "#fff",
  },
  quickLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.ink.soft,
  },

  /* ── Hero ─────────────────────────────────── */
  heroShell: {
    marginHorizontal: 16,
    marginTop: 22,
    borderRadius: 26,
    shadowColor: "#161a0a",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 12,
  },
  heroSkeleton: {
    padding: 22,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  hero: {
    borderRadius: 26,
    padding: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,212,150,0.16)",
  },
  heroHairline: {
    position: "absolute",
    top: 0,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: "rgba(232,212,150,0.45)",
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232,212,150,0.1)",
    borderWidth: 1,
    borderColor: "rgba(232,212,150,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "rgba(244,242,234,0.78)",
    letterSpacing: 1.6,
  },
  heroEyebrowSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: "rgba(244,242,234,0.45)",
    marginTop: 1,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  heroBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[900],
    letterSpacing: 1,
  },
  heroCurrency: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12,
    color: GOLD_LIGHT,
    letterSpacing: 1.6,
    marginTop: 22,
  },
  heroMainValue: {
    alignSelf: "stretch",
    fontFamily: fontFamilies.display.semibold,
    fontSize: 44,
    lineHeight: 50,
    color: colors.paper.cream,
    letterSpacing: -1.4,
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(244,242,234,0.55)",
    marginTop: 2,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
  },
  heroMetric: {
    flex: 1,
    padding: 11,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(244,242,234,0.09)",
  },
  heroMetricTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMetricLabel: {
    flexShrink: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8,
    color: "rgba(244,242,234,0.55)",
    letterSpacing: 1,
  },
  heroMetricValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: colors.paper.cream,
    marginTop: 8,
    letterSpacing: -0.4,
  },
  heroMetricTotal: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(244,242,234,0.45)",
  },
  heroMetricSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: "rgba(244,242,234,0.5)",
    marginTop: 2,
  },
  actionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    paddingRight: 10,
    borderRadius: 18,
    marginTop: 16,
  },
  actionBannerCount: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  actionBannerCountText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: GOLD_LIGHT,
  },
  actionBannerTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: "#5c4413",
  },
  actionBannerSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#8a6a2a",
    marginTop: 1,
  },
  actionBannerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  nominalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(232,212,150,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    marginTop: 16,
  },
  nominalBannerText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "rgba(244,242,234,0.8)",
  },

  /* ── Section cards ────────────────────────── */
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    ...cardShadow,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.accent2.ochre,
    letterSpacing: 1.8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink.DEFAULT,
  },
  sectionCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: GOLD_LIGHT,
  },
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive[200],
  },
  linkPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.olive[700],
  },
  gridHeader: {
    marginHorizontal: 20,
    marginTop: 26,
    marginBottom: 2,
  },

  /* Rows */
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.ink.DEFAULT,
  },
  rowMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.ink.mute,
    marginTop: 2,
  },
  rowMetaMono: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10.5,
    color: colors.ink.mute,
    marginTop: 3,
  },
  rowMetaLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },

  /* Queue */
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  queueIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  kindTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  kindTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  queueActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.glow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#efd3c8",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Empty */
  emptyWrap: { paddingVertical: 26, alignItems: "center", gap: 4 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 17,
    color: colors.ink.DEFAULT,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    textAlign: "center",
  },

  /* ── Telemetry ────────────────────────────── */
  telemetryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 12,
  },
  telemetryCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    ...cardShadow,
  },
  telemetryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ringWrap: { width: 46, height: 46 },
  ringIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  alertChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "#f9e6dd",
  },
  alertChipText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.accent2.rust,
  },
  telemetryValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 30,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.8,
    marginTop: 14,
  },
  telemetryLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.ink.soft,
    marginTop: 2,
  },
  telemetrySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
    marginTop: 1,
  },

  /* ── Orders ───────────────────────────────── */
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(200,164,74,0.55)",
  },
  monogramText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: GOLD_LIGHT,
  },
  orderAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: colors.ink.DEFAULT,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  statusPillDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  /* ── Timeline ─────────────────────────────── */
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 18, alignItems: "center", paddingTop: 14 },
  timelineDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDot: { width: 7, height: 7, borderRadius: 4 },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: colors.light.border,
    marginTop: 4,
  },
  timelineBody: { flex: 1, paddingVertical: 12, minWidth: 0 },
  timelineHead: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" },
  timelineTime: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.ink.mute,
  },

  /* ── Hub ──────────────────────────────────── */
  hubGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  hubTile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.paper.cream,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    padding: 14,
    ...cardShadow,
    shadowOpacity: 0.05,
  },
  hubTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  hubIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hubArrow: { transform: [{ rotate: "-45deg" }] },
  hubLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.ink.DEFAULT,
  },
  hubSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
    marginTop: 2,
  },
});
