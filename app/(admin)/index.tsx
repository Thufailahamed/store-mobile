import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
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
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { themedAlert } from "@/lib/themed-alert";
// Same palette as the buyer Account screen so the admin console reads as
// part of one product rather than a separate dashboard skin.
import { C } from "@/components/orders/parcel-track";

type IconName = keyof typeof Ionicons.glyphMap;

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

const HUB: { label: string; sub: string; icon: IconName; route: string }[] = [
  { label: "Analytics", sub: "Revenue & telemetry", icon: "bar-chart-outline", route: "/(admin)/analytics" },
  { label: "Delivery", sub: "Riders & dispatches", icon: "car-outline", route: "/(admin)/delivery" },
  { label: "Couriers", sub: "3PL integrations", icon: "bicycle-outline", route: "/(admin)/courier" },
  { label: "Commissions", sub: "Payout rates & tiers", icon: "wallet-outline", route: "/(admin)/commissions" },
  { label: "Homepage CMS", sub: "Sections & layout", icon: "globe-outline", route: "/(admin)/homepage" },
  { label: "Gift Cards", sub: "Codes & balances", icon: "gift-outline", route: "/(admin)/gift-cards" },
];

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

  const adminName: string = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Admin";
  const adminEmail = user?.email ?? "";

  const greeting = greetingFor(new Date().getHours());
  const revenueParts = splitCurrency(formatPrice(s?.revenue ?? 0));
  const lowStockCount = lowStockQ.data?.length ?? 0;
  const signupCount = signupsQ.data?.length ?? 0;

  const go = (route: string) => router.push(route as never);

  const confirmApprove = (row: { id: string; name: string; kind: "Store" | "Brand" | "Product" }) => {
    const m = row.kind === "Store" ? approveStoreM : row.kind === "Brand" ? approveBrandM : approveProductM;
    themedAlert(`Approve ${row.kind}`, row.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => m.mutate(row.id) },
    ]);
  };

  const confirmRejectStore = (row: { id: string; name: string }) =>
    themedAlert("Reject Store", row.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => rejectStoreM.mutate(row.id) },
    ]);

  const stats = [
    { key: "orders", value: (s?.orders ?? 0).toLocaleString(), label: "Orders", route: "/(admin)/orders" },
    { key: "stores", value: `${s?.activeStores ?? 0}/${s?.stores ?? 0}`, label: "Ateliers", route: "/(admin)/stores" },
    { key: "products", value: (s?.products ?? 0).toLocaleString(), label: "Products", route: "/(admin)/catalogue" },
  ];

  const quick: { icon: IconName; label: string; route: string }[] = [
    { icon: "bar-chart-outline", label: "Analytics", route: "/(admin)/analytics" },
    { icon: "storefront-outline", label: "Stores", route: "/(admin)/stores" },
    { icon: "people-outline", label: "Users", route: "/(admin)/users" },
    { icon: "document-text-outline", label: "Reports", route: "/(admin)/reports" },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glowSoft, C.paper]}
        locations={[0, 1]}
        style={styles.glow}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Admin profile card ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(420)} style={styles.cardShadow}>
          <View style={styles.profileCard}>
            <View pointerEvents="none" style={styles.ribbonClip}>
              <View style={styles.ribbon}>
                <Text style={styles.ribbonText}>ADMIN</Text>
              </View>
            </View>

            <View style={styles.profileRow}>
              <View style={styles.avatarRing}>
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials(adminName)}</Text>
                </View>
              </View>
              <View style={styles.profileText}>
                <Text style={styles.profileGreeting} numberOfLines={1}>
                  {greeting}
                </Text>
                <Text style={styles.profileName} numberOfLines={1}>
                  {adminName}
                </Text>
                {adminEmail ? (
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {adminEmail}
                  </Text>
                ) : null}
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>Platform online · {clock}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsStrip}>
              {stats.map((st, i) => (
                <React.Fragment key={st.key}>
                  {i > 0 ? <View style={styles.statDivider} /> : null}
                  <Pressable
                    style={({ pressed }) => [styles.stat, pressed && { opacity: 0.7 }]}
                    onPress={() => go(st.route)}
                    accessibilityRole="button"
                    accessibilityLabel={`${st.value} ${st.label}`}
                  >
                    {isLoading ? (
                      <View style={styles.statSkeleton} />
                    ) : (
                      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                        {st.value}
                      </Text>
                    )}
                    <Text style={styles.statLabel}>{st.label}</Text>
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── Quick actions ──────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(420).delay(60)} style={styles.quickRow}>
          {quick.map((q) => (
            <Pressable
              key={q.label}
              style={({ pressed }) => [styles.quick, pressed && { transform: [{ scale: 0.96 }] }]}
              onPress={() => go(q.route)}
              accessibilityRole="button"
              accessibilityLabel={q.label}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={q.icon} size={21} color={C.text} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* ── Marketplace volume ─────────────────────────────── */}
        <SectionHead title="Marketplace volume" action="Analytics" onAction={() => go("/(admin)/analytics")} />
        <Animated.View entering={FadeInDown.duration(420).delay(120)} style={styles.cardShadow}>
          <View style={styles.volumeCard}>
            <View style={styles.volumeTop}>
              <Text style={styles.kicker}>GROSS · SETTLED</Text>
              <View style={styles.liveChip}>
                <Ionicons name="trending-up" size={11} color={C.ink} />
                <Text style={styles.liveChipText}>LIVE</Text>
              </View>
            </View>
            {isLoading ? (
              <Skeleton width="70%" height={40} style={{ marginTop: 12 }} />
            ) : (
              <View style={styles.volumeValueRow}>
                {revenueParts.currency ? <Text style={styles.volumeCurrency}>{revenueParts.currency}</Text> : null}
                <Text style={styles.volumeValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {revenueParts.amount}
                </Text>
              </View>
            )}
            <View style={styles.volumeSplit}>
              <MiniStat label="Avg order" value={formatPrice(s?.aov ?? 0)} />
              <View style={styles.volumeDivider} />
              <MiniStat label="Stores live" value={`${activeStoreRate.toFixed(0)}%`} />
              <View style={styles.volumeDivider} />
              <MiniStat label="Brands" value={String(s?.brands ?? 0)} />
            </View>
          </View>
        </Animated.View>

        {pendingTotal > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.darkCta, pressed && { transform: [{ scale: 0.985 }] }]}
            onPress={() => go("/(admin)/approvals")}
            accessibilityRole="button"
            accessibilityLabel={`${pendingTotal} submissions awaiting review`}
          >
            <View style={styles.darkCtaCount}>
              <Text style={styles.darkCtaCountText}>{pendingTotal > 99 ? "99+" : pendingTotal}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.darkCtaTitle}>
                Submission{pendingTotal > 1 ? "s" : ""} awaiting review
              </Text>
              <Text style={styles.darkCtaSub}>Stores, brands & products in the queue</Text>
            </View>
            <Ionicons name="arrow-forward" size={17} color={C.lime} />
          </Pressable>
        ) : !isLoading ? (
          <View style={styles.clearPill}>
            <Ionicons name="checkmark-circle" size={15} color={colors.olive[700]} />
            <Text style={styles.clearPillText}>All submission queues clear</Text>
          </View>
        ) : null}

        {/* ── Priority queue ─────────────────────────────────── */}
        <SectionHead
          title="Priority queue"
          count={pendingTotal}
          action="View all"
          onAction={() => go("/(admin)/approvals")}
        />
        <View style={styles.menuCard}>
          {merged.length === 0 ? (
            <EmptyBlock icon="checkmark-done-outline" title="Inbox zero" sub="Every submission has been reviewed." />
          ) : (
            merged.map((row, i) => (
              <View key={`${row.kind}-${row.id}`} style={[styles.menuRow, i > 0 && styles.menuDivider]}>
                <View style={[styles.menuIcon, { backgroundColor: kindBg(row.kind) }]}>
                  <Ionicons name={kindIcon(row.kind)} size={18} color={kindFg(row.kind)} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.menuLabel} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.menuSub} numberOfLines={1}>
                    {row.kind} · {formatRelative(row.created_at)}
                  </Text>
                </View>
                <View style={styles.queueActions}>
                  {row.kind === "Store" ? (
                    <Pressable
                      onPress={() => confirmRejectStore(row)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}
                      accessibilityLabel={`Reject ${row.name}`}
                    >
                      <Ionicons name="close" size={16} color={C.rust} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => confirmApprove(row)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.approveBtn, pressed && styles.pressed]}
                    accessibilityLabel={`Approve ${row.name}`}
                  >
                    <Ionicons name="checkmark" size={17} color={C.ink} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Operational health ─────────────────────────────── */}
        <SectionHead title="Operational health" />
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
            color={C.gold}
          />
          <TelemetryCard
            label="Low stock"
            value={String(lowStockCount)}
            sub="Variants near limit"
            pct={Math.min(100, lowStockCount * 20)}
            icon="alert-circle-outline"
            color={C.rust}
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

        {/* ── Recent orders ──────────────────────────────────── */}
        <SectionHead title="Recent orders" action="All orders" onAction={() => go("/(admin)/orders")} />
        <View style={styles.menuCard}>
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
                  style={({ pressed }) => [styles.menuRow, i > 0 && styles.menuDivider, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${o.order_number ?? ""} from ${name}`}
                >
                  <View style={styles.monogram}>
                    <Text style={styles.monogramText}>{initials(name)}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.menuLabel} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.menuSub} numberOfLines={1}>
                      #{o.order_number ?? String(o.id).slice(0, 8)} · {formatRelative(o.placed_at)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <Text style={styles.orderAmount}>{formatPrice(Number(o.total ?? 0), o.currency ?? "LKR")}</Text>
                    <View style={[styles.statusPill, { backgroundColor: pillBg(tone) }]}>
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

        {/* ── Live activity ──────────────────────────────────── */}
        <SectionHead title="Live activity" action="Audit log" onAction={() => go("/(admin)/audit-log")} />
        <View style={[styles.menuCard, { paddingVertical: 6 }]}>
          {(auditQ.data ?? []).length === 0 ? (
            <EmptyBlock icon="time-outline" title="All quiet" sub="No recent system activity recorded." />
          ) : (
            (auditQ.data ?? []).map((e: any, i: number, arr: any[]) => (
              <View key={e.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { backgroundColor: auditColor(e.action) }]} />
                  {i < arr.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.timelineBody}>
                  <View style={styles.timelineHead}>
                    <Text style={[styles.menuLabel, { flex: 1 }]} numberOfLines={1}>
                      {humanize(e.action)}
                    </Text>
                    <Text style={styles.timelineTime}>{formatRelative(e.created_at)}</Text>
                  </View>
                  <Text style={styles.menuSub} numberOfLines={1}>
                    by {e.actor_name ?? "Administrator"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Console hub ────────────────────────────────────── */}
        <SectionHead title="Console" />
        <View style={styles.menuCard}>
          {HUB.map((h, i) => (
            <Pressable
              key={h.route}
              style={({ pressed }) => [styles.menuRow, i > 0 && styles.menuDivider, pressed && { opacity: 0.65 }]}
              onPress={() => go(h.route)}
              accessibilityRole="button"
              accessibilityLabel={h.label}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={h.icon} size={18} color={C.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.menuLabel} numberOfLines={1}>
                  {h.label}
                </Text>
                <Text style={styles.menuSub} numberOfLines={1}>
                  {h.sub}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerMark}>
            <MaterialCommunityIcons name="hanger" size={16} color={C.goldSoft} />
          </View>
          <Text style={styles.footerWord}>VESTARA</Text>
          <Text style={styles.footerCaption}>Admin console</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── Components ───────────────────────── */

function SectionHead({
  title,
  count,
  action,
  onAction,
}: {
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count ? (
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={({ pressed }) => [styles.sectionAction, pressed && { opacity: 0.7 }]}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={13} color={C.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.miniStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function EmptyBlock({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={20} color={C.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

function RingGauge({ pct, color, size = 48, stroke = 4 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.accentSoft} strokeWidth={stroke} fill="none" />
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
  icon: IconName;
  color: string;
  alert?: boolean;
}) {
  return (
    <View style={styles.telemetryCard}>
      <View style={styles.telemetryTop}>
        <View style={styles.ringWrap}>
          <RingGauge pct={pct} color={color} />
          <View style={styles.ringIcon}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
        </View>
        {alert ? (
          <View style={styles.alertChip}>
            <Text style={styles.alertChipText}>ALERT</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.telemetryValue, alert && { color: C.rust }]}>{value}</Text>
      <Text style={styles.telemetryLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.telemetrySub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
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

function kindIcon(kind: string): IconName {
  switch (kind) {
    case "Store":
      return "storefront-outline";
    case "Brand":
      return "ribbon-outline";
    default:
      return "cube-outline";
  }
}

function kindBg(kind: string) {
  switch (kind) {
    case "Store":
      return C.accentSoft;
    case "Brand":
      return "#fbf1d6";
    default:
      return "#f9e6dd";
  }
}

function kindFg(kind: string) {
  switch (kind) {
    case "Store":
      return colors.olive[700];
    case "Brand":
      return "#8a6a2a";
    default:
      return "#a14a2c";
  }
}

function pillBg(tone: string) {
  switch (tone) {
    case "success":
      return C.lime;
    case "warning":
      return "#fbf1d6";
    case "danger":
      return "#f9e6dd";
    case "info":
      return C.accentSoft;
    default:
      return "#efede4";
  }
}

function pillFg(tone: string) {
  switch (tone) {
    case "success":
      return C.ink;
    case "warning":
      return "#8a6a2a";
    case "danger":
      return "#a14a2c";
    case "info":
      return colors.olive[700];
    default:
      return C.muted;
  }
}

function humanize(s: string) {
  return s.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function auditColor(action: string) {
  if (action.includes("delete") || action.includes("reject") || action.includes("ban")) return C.rust;
  if (action.includes("create") || action.includes("approve")) return colors.olive[600];
  if (action.includes("update")) return C.gold;
  return colors.olive[300];
}

/* ───────────────────────── Styles ───────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  scroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32 },
  pressed: { transform: [{ scale: 0.94 }] },

  cardShadow: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },

  /* Profile card */
  profileCard: { borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: C.line, padding: 18 },
  ribbonClip: { position: "absolute", top: 0, right: 0, width: 116, height: 116, overflow: "hidden" },
  ribbon: {
    position: "absolute",
    top: 24,
    right: -44,
    width: 170,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: C.ink,
    transform: [{ rotate: "35deg" }],
  },
  ribbonText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, letterSpacing: 1.6, color: C.goldSoft },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 56 },
  avatarRing: { width: 72, height: 72, borderRadius: 36, padding: 3, borderWidth: 2, borderColor: C.goldSoft },
  avatarFallback: { flex: 1, borderRadius: 33, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: C.goldSoft },
  profileText: { flex: 1, minWidth: 0, gap: 1 },
  profileGreeting: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },
  profileName: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.4, color: C.text },
  profileEmail: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted },
  livePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[500] },
  livePillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: colors.olive[800] },

  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: C.ink,
  },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 6 },
  statValue: { fontFamily: fontFamilies.sans.bold, fontSize: 21, color: C.cream, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },
  statSkeleton: { width: 36, height: 22, borderRadius: 6, backgroundColor: "rgba(250,248,241,0.12)" },

  /* Quick row */
  quickRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  quick: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.text },

  /* Section head */
  sectionHead: { flexDirection: "row", alignItems: "flex-end", marginTop: 28, marginBottom: 12, paddingHorizontal: 2 },
  sectionTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  sectionCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: C.goldSoft },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, paddingBottom: 2 },
  sectionActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.accent },

  /* Volume card */
  volumeCard: { borderRadius: 26, borderWidth: 1, borderColor: C.line, padding: 18 },
  volumeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.lime,
  },
  liveChipText: { fontFamily: fontFamilies.sans.bold, fontSize: 10.5, letterSpacing: 1, color: C.ink },
  volumeValueRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  volumeCurrency: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    letterSpacing: 0.6,
    color: C.muted,
    marginTop: 8,
  },
  volumeValue: {
    flexShrink: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 42,
    letterSpacing: -1,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  volumeSplit: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  volumeDivider: { width: 1, height: 26, backgroundColor: C.line },
  miniStat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
  miniStatValue: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.text, fontVariant: ["tabular-nums"] },
  miniStatLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: C.muted },

  /* Dark CTA */
  darkCta: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  darkCtaCount: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  darkCtaCountText: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.ink, fontVariant: ["tabular-nums"] },
  darkCtaTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },
  darkCtaSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(250,248,241,0.6)", marginTop: 1 },
  clearPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.accentSoft,
  },
  clearPillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: colors.olive[800] },

  /* Menu cards */
  menuCard: {
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  menuDivider: { borderTopWidth: 1, borderTopColor: C.line },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0 },
  menuLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  menuSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },

  queueActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.3)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },

  monogram: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: { fontFamily: fontFamilies.display.semibold, fontSize: 15, color: C.goldSoft },
  orderAmount: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text, fontVariant: ["tabular-nums"] },
  statusPill: { paddingHorizontal: 9, height: 22, borderRadius: 11, justifyContent: "center" },
  statusPillText: { fontFamily: fontFamilies.sans.bold, fontSize: 10.5, textTransform: "capitalize" },

  /* Telemetry */
  telemetryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  telemetryCard: {
    width: "48.5%",
    flexGrow: 1,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  telemetryTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  ringWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  ringIcon: { position: "absolute" },
  alertChip: { paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: C.rust, justifyContent: "center" },
  alertChipText: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, letterSpacing: 0.8, color: C.cream },
  telemetryValue: {
    marginTop: 12,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  telemetryLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text, marginTop: 2 },
  telemetrySub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted, marginTop: 1 },

  /* Timeline */
  timelineRow: { flexDirection: "row", gap: 12, paddingVertical: 8 },
  timelineRail: { width: 12, alignItems: "center", paddingTop: 6 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { flex: 1, width: 1, backgroundColor: C.line, marginTop: 4, marginBottom: -14 },
  timelineBody: { flex: 1, minWidth: 0 },
  timelineHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  timelineTime: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: C.muted },

  /* Empty */
  emptyWrap: { alignItems: "center", paddingVertical: 22, gap: 4 },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.text, marginTop: 6 },
  emptySub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, textAlign: "center" },

  /* Footer */
  footer: { alignItems: "center", marginTop: 30, gap: 4 },
  footerMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  footerWord: { fontFamily: fontFamilies.display.semibold, fontSize: 15, letterSpacing: 4, color: C.text },
  footerCaption: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
});
