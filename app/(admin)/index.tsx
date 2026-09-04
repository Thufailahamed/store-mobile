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
import {
  Card,
  ListRow,
  EmptyState,
  StatusDot,
  ProgressBar,
  Skeleton,
} from "@/components/ui";
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.light.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. Executive Masthead ─────────────────────────────── */}
      <View style={styles.masthead}>
        <View style={styles.mastheadTop}>
          <View style={styles.liveIndicator}>
            <StatusDot tone="live" size={7} />
            <Text style={styles.liveText}>PLATFORM ONLINE</Text>
          </View>
          <View style={styles.clockWrap}>
            <Ionicons name="time-outline" size={12} color={colors.light.mutedForeground} />
            <Text style={styles.clockText}>{clock}</Text>
          </View>
        </View>

        <Text style={styles.headline}>
          Command <Text style={styles.headlineAccent}>Deck</Text>
        </Text>
        <Text style={styles.subline}>
          Welcome, {adminName} · LUXE Executive Overview
        </Text>

        {/* Action Pills */}
        <View style={styles.quickPillsRow}>
          <Pressable
            onPress={() => router.push("/(admin)/analytics" as any)}
            style={styles.quickPill}
          >
            <Ionicons name="bar-chart-outline" size={13} color={colors.light.primary} />
            <Text style={styles.quickPillText}>Analytics</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(admin)/catalogue" as any)}
            style={styles.quickPill}
          >
            <Ionicons name="cube-outline" size={13} color={colors.light.primary} />
            <Text style={styles.quickPillText}>Inventory</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(admin)/approvals" as any)}
            style={[styles.quickPill, pendingTotal > 0 && styles.quickPillHighlight]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={pendingTotal > 0 ? "#7a5b1a" : colors.light.primary}
            />
            <Text style={[styles.quickPillText, pendingTotal > 0 && styles.quickPillTextHighlight]}>
              Approvals {pendingTotal > 0 ? `(${pendingTotal})` : ""}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── 2. Unified Executive Performance Deck (Non-redundant) ── */}
      {isLoading ? (
        <Card style={styles.heroDeck}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="60%" height={36} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: "row", gap: 16, marginTop: 20 }}>
            <Skeleton width="30%" height={32} />
            <Skeleton width="30%" height={32} />
            <Skeleton width="30%" height={32} />
          </View>
        </Card>
      ) : (
        <Card style={styles.heroDeck}>
          <View style={styles.heroTop}>
            <Text style={styles.heroEyebrow}>MARKETPLACE VOLUME</Text>
            <View style={styles.heroBadge}>
              <Ionicons name="trending-up" size={12} color={colors.olive[700]} />
              <Text style={styles.heroBadgeText}>GROSS REVENUE</Text>
            </View>
          </View>

          <Text style={styles.heroMainValue}>
            {formatPrice(s?.revenue ?? 0)}
          </Text>
          <Text style={styles.heroSub}>Aggregated settled marketplace volume</Text>

          {/* 3-Column Inline Metrics */}
          <View style={styles.heroTripleRow}>
            <View style={styles.tripleCol}>
              <Text style={styles.tripleLabel}>ORDERS</Text>
              <Text style={styles.tripleValue}>{(s?.orders ?? 0).toLocaleString()}</Text>
              <Text style={styles.tripleSub}>{formatPrice(s?.aov ?? 0)} avg</Text>
            </View>

            <View style={styles.tripleDivider} />

            <View style={styles.tripleCol}>
              <Text style={styles.tripleLabel}>ACTIVE ATELIERS</Text>
              <Text style={styles.tripleValue}>
                {s?.activeStores ?? 0}
                <Text style={styles.tripleTotal}> / {s?.stores ?? 0}</Text>
              </Text>
              <Text style={styles.tripleSub}>{activeStoreRate.toFixed(0)}% approved</Text>
            </View>

            <View style={styles.tripleDivider} />

            <View style={styles.tripleCol}>
              <Text style={styles.tripleLabel}>CATALOGUE</Text>
              <Text style={styles.tripleValue}>{(s?.products ?? 0).toLocaleString()}</Text>
              <Text style={styles.tripleSub}>{s?.brands ?? 0} brands</Text>
            </View>
          </View>

          {/* Action Attention Banner */}
          {pendingTotal > 0 ? (
            <Pressable
              onPress={() => router.push("/(admin)/approvals" as any)}
              style={styles.actionBanner}
            >
              <View style={styles.actionBannerLeft}>
                <Ionicons name="flash" size={14} color="#7a5b1a" />
                <Text style={styles.actionBannerText}>
                  {pendingTotal} submission{pendingTotal > 1 ? "s" : ""} require attention
                </Text>
              </View>
              <View style={styles.actionBannerBtn}>
                <Text style={styles.actionBannerBtnText}>Review →</Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.nominalBanner}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.olive[700]} />
              <Text style={styles.nominalBannerText}>All submission queues nominal · 0 pending</Text>
            </View>
          )}
        </Card>
      )}

      {/* ── 3. Priority Moderation Queue ───────────────────────── */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>MODERATION</Text>
            <Text style={styles.sectionTitle}>Priority Queue</Text>
          </View>
          <Pressable onPress={() => router.push("/(admin)/approvals" as any)} hitSlop={10}>
            <Text style={styles.headerLink}>View all →</Text>
          </Pressable>
        </View>

        {merged.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.olive[600]} />
            <Text style={styles.emptyTitle}>Inbox Zero</Text>
            <Text style={styles.emptySub}>All submissions have been approved or handled.</Text>
          </View>
        ) : (
          merged.map((row, i) => (
            <ListRow
              key={`${row.kind}-${row.id}`}
              index={i + 1}
              title={row.name}
              subtitle={`${row.kind} · Submitted ${formatRelative(row.created_at)}`}
              right={
                <View style={styles.queueActions}>
                  {row.kind === "Store" ? (
                    <>
                      <Pressable
                        onPress={() =>
                          Alert.alert("Approve Store", row.name, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Approve", onPress: () => approveStoreM.mutate(row.id) },
                          ])
                        }
                        style={[styles.iconBtn, styles.iconBtnApprove]}
                      >
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          Alert.alert("Reject Store", row.name, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Reject", style: "destructive", onPress: () => rejectStoreM.mutate(row.id) },
                          ])
                        }
                        style={styles.iconBtn}
                      >
                        <Ionicons name="close" size={13} color={colors.light.destructive} />
                      </Pressable>
                    </>
                  ) : row.kind === "Brand" ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert("Approve Brand", row.name, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Approve", onPress: () => approveBrandM.mutate(row.id) },
                        ])
                      }
                      style={[styles.iconBtn, styles.iconBtnApprove]}
                    >
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() =>
                        Alert.alert("Approve Product", row.name, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Approve", onPress: () => approveProductM.mutate(row.id) },
                        ])
                      }
                      style={[styles.iconBtn, styles.iconBtnApprove]}
                    >
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    </Pressable>
                  )}
                </View>
              }
            />
          ))
        )}
      </Card>

      {/* ── 4. Operational Health & Telemetry (2x2 Grid) ───────── */}
      <View style={styles.telemetryGrid}>
        <View style={styles.telemetryCard}>
          <View style={styles.telemetryTop}>
            <Text style={styles.telemetryLabel}>STORE ACTIVATION</Text>
            <View style={[styles.telemetryIcon, { backgroundColor: "#dde4d6" }]}>
              <Ionicons name="storefront-outline" size={13} color={colors.olive[800]} />
            </View>
          </View>
          <Text style={styles.telemetryValue}>{activeStoreRate.toFixed(0)}%</Text>
          <Text style={styles.telemetrySub}>{s?.activeStores ?? 0} of {s?.stores ?? 0} stores live</Text>
          <ProgressBar value={activeStoreRate} fillColor={colors.olive[600]} style={{ marginTop: 8 }} />
        </View>

        <View style={styles.telemetryCard}>
          <View style={styles.telemetryTop}>
            <Text style={styles.telemetryLabel}>CUSTOMER SHARE</Text>
            <View style={[styles.telemetryIcon, { backgroundColor: "#fdf3d7" }]}>
              <Ionicons name="people-outline" size={13} color="#7a5b1a" />
            </View>
          </View>
          <Text style={styles.telemetryValue}>{customerShare.toFixed(0)}%</Text>
          <Text style={styles.telemetrySub}>{s?.customers ?? 0} purchasers</Text>
          <ProgressBar value={customerShare} fillColor="#c8a44a" style={{ marginTop: 8 }} />
        </View>

        <View style={styles.telemetryCard}>
          <View style={styles.telemetryTop}>
            <Text style={styles.telemetryLabel}>LOW STOCK ALERT</Text>
            <View style={[styles.telemetryIcon, { backgroundColor: "#fbe5dc" }]}>
              <Ionicons name="alert-circle-outline" size={13} color="#7a2f1a" />
            </View>
          </View>
          <Text style={[styles.telemetryValue, (lowStockQ.data?.length ?? 0) > 0 && { color: colors.light.destructive }]}>
            {lowStockQ.data?.length ?? 0}
          </Text>
          <Text style={styles.telemetrySub}>Variants near limit</Text>
          <ProgressBar
            value={Math.min(100, (lowStockQ.data?.length ?? 0) * 20)}
            fillColor={colors.light.destructive}
            style={{ marginTop: 8 }}
          />
        </View>

        <View style={styles.telemetryCard}>
          <View style={styles.telemetryTop}>
            <Text style={styles.telemetryLabel}>NEW ACCOUNTS</Text>
            <View style={[styles.telemetryIcon, { backgroundColor: "#e6e6d0" }]}>
              <Ionicons name="person-add-outline" size={13} color={colors.olive[700]} />
            </View>
          </View>
          <Text style={styles.telemetryValue}>{signupsQ.data?.length ?? 0}</Text>
          <Text style={styles.telemetrySub}>Recent registrations</Text>
          <ProgressBar
            value={Math.min(100, (signupsQ.data?.length ?? 0) * 25)}
            fillColor={colors.olive[500]}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>

      {/* ── 5. Recent Orders Stream ────────────────────────────── */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>DISPATCH</Text>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
          </View>
          <Pressable onPress={() => router.push("/(admin)/orders" as any)} hitSlop={10}>
            <Text style={styles.headerLink}>View all →</Text>
          </Pressable>
        </View>

        {(ordersQ.data ?? []).length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={28} color={colors.light.mutedForeground} />
            <Text style={styles.emptySub}>No orders received yet.</Text>
          </View>
        ) : (
          (ordersQ.data ?? []).map((o: any, i: number) => (
            <Pressable
              key={o.id}
              onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: o.id } })}
            >
              <ListRow
                index={i + 1}
                title={o.user?.full_name ?? "Direct Customer"}
                subtitle={`#${o.order_number ?? o.id.slice(0, 8)} · ${formatRelative(o.placed_at)}`}
                right={
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Text style={styles.orderAmount}>{formatPrice(Number(o.total ?? 0), o.currency ?? "LKR")}</Text>
                    <View style={[styles.statusPill, { backgroundColor: pillBg(STATUS_TONE[o.status] ?? "muted") }]}>
                      <Text style={[styles.statusPillText, { color: pillFg(STATUS_TONE[o.status] ?? "muted") }]}>
                        {o.status}
                      </Text>
                    </View>
                  </View>
                }
              />
            </Pressable>
          ))
        )}
      </Card>

      {/* ── 6. Activity & Security Stream ──────────────────────── */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>AUDIT LOG</Text>
            <Text style={styles.sectionTitle}>Live Activity</Text>
          </View>
          <Pressable onPress={() => router.push("/(admin)/audit-log" as any)} hitSlop={10}>
            <Text style={styles.headerLink}>Stream →</Text>
          </Pressable>
        </View>

        {(auditQ.data ?? []).length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="time-outline" size={28} color={colors.light.mutedForeground} />
            <Text style={styles.emptySub}>No recent system activity recorded.</Text>
          </View>
        ) : (
          (auditQ.data ?? []).map((e: any) => (
            <ListRow
              key={e.id}
              leftIcon={<View style={[styles.auditDot, { backgroundColor: auditColor(e.action) }]} />}
              title={e.actor_name ?? "Administrator"}
              subtitle={humanize(e.action)}
              meta={formatRelative(e.created_at)}
            />
          ))
        )}
      </Card>

      {/* ── 7. Console Navigation Grid ─────────────────────────── */}
      <Card style={[styles.sectionCard, { marginBottom: 24 }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>NAVIGATION</Text>
            <Text style={styles.sectionTitle}>Console Hub</Text>
          </View>
        </View>

        <View style={styles.hubGrid}>
          <HubTile
            label="Analytics"
            sub="Revenue & telemetry"
            icon="bar-chart-outline"
            bg="#dde4d6"
            onPress={() => router.push("/(admin)/analytics" as any)}
          />
          <HubTile
            label="Delivery"
            sub="Riders & dispatches"
            icon="car-outline"
            bg="#fdf3d7"
            onPress={() => router.push("/(admin)/delivery" as any)}
          />
          <HubTile
            label="Couriers"
            sub="3PL Integrations"
            icon="bicycle-outline"
            bg="#fbe5dc"
            onPress={() => router.push("/(admin)/courier" as any)}
          />
          <HubTile
            label="Commissions"
            sub="Payout rates & tiers"
            icon="wallet-outline"
            bg="#e6e6d0"
            onPress={() => router.push("/(admin)/commissions" as any)}
          />
          <HubTile
            label="Homepage CMS"
            sub="Sections & layout"
            icon="globe-outline"
            bg="#efece2"
            onPress={() => router.push("/(admin)/homepage" as any)}
          />
          <HubTile
            label="Gift Cards"
            sub="Codes & balances"
            icon="gift-outline"
            bg="#d4d4b5"
            onPress={() => router.push("/(admin)/gift-cards" as any)}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function HubTile({
  label,
  sub,
  icon,
  bg,
  onPress,
}: {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.hubTile}>
      <View style={[styles.hubIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={colors.light.foreground} />
      </View>
      <Text style={styles.hubLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.hubSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

function pillBg(tone: string) {
  switch (tone) {
    case "success": return "#dce8c4";
    case "warning": return "#fdf3d7";
    case "danger": return "#fbe5dc";
    case "info": return "#dde4d6";
    default: return colors.light.secondary;
  }
}

function pillFg(tone: string) {
  switch (tone) {
    case "success": return "#3d4a1f";
    case "warning": return "#7a5b1a";
    case "danger": return "#7a2f1a";
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
  if (action.includes("update")) return "#c8a44a";
  return colors.light.muted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },

  /* ── 1. Masthead ─────────────────────────────── */
  masthead: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  mastheadTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  liveText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[800],
    letterSpacing: 0.8,
  },
  clockWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clockText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  headline: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    color: colors.light.foreground,
    letterSpacing: -0.8,
    lineHeight: 36,
    marginTop: 12,
  },
  headlineAccent: {
    fontStyle: "italic",
    color: colors.olive[600],
  },
  subline: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  quickPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  quickPillHighlight: {
    backgroundColor: "#fdf3d7",
    borderColor: "#f5d97a",
  },
  quickPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.primary,
  },
  quickPillTextHighlight: {
    color: "#7a5b1a",
  },

  /* ── 2. Unified Executive Performance Deck ───── */
  heroDeck: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 20,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  heroBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[800],
    letterSpacing: 0.6,
  },
  heroMainValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    color: colors.light.foreground,
    letterSpacing: -0.8,
    marginTop: 8,
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  heroTripleRow: {
    flexDirection: "row",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  tripleCol: {
    flex: 1,
  },
  tripleDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.light.border,
    marginHorizontal: 10,
    alignSelf: "center",
  },
  tripleLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.8,
  },
  tripleValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
    marginTop: 2,
  },
  tripleTotal: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  tripleSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  actionBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fdf3d7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#f5d97a",
  },
  actionBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  actionBannerText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#7a5b1a",
  },
  actionBannerBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  actionBannerBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#7a5b1a",
  },
  nominalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    marginTop: 16,
  },
  nominalBannerText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.olive[800],
  },

  /* ── 3. Section Cards ───────────────────────── */
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    ...shadows.soft,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.primary,
    letterSpacing: 1.2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: colors.light.foreground,
    marginTop: 2,
  },
  headerLink: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.primary,
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    marginTop: 4,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  queueActions: {
    flexDirection: "row",
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnApprove: {
    backgroundColor: colors.olive[600],
    borderColor: colors.olive[600],
  },

  /* ── 4. Telemetry 2x2 Grid ──────────────────── */
  telemetryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 14,
  },
  telemetryCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  telemetryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  telemetryLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.8,
  },
  telemetryIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  telemetryValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
    letterSpacing: -0.4,
    marginTop: 8,
  },
  telemetrySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  /* ── 5. Orders Stream ───────────────────────── */
  orderAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  /* ── 6. Audit Dot ───────────────────────────── */
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },

  /* ── 7. Console Hub Grid ────────────────────── */
  hubGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  hubTile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.light.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
    gap: 3,
  },
  hubIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  hubLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  hubSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
});

