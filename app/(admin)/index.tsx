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
import Ionicons from "@expo/vector-icons/Ionicons";
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
  StatTile,
  ListRow,
  SectionHeader,
  EmptyState,
  StatusDot,
  ProgressBar,
  Chip,
  Skeleton,
} from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

function formatRelative(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
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

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  pending: "warning",
  confirmed: "info",
  processing: "info",
  shipped: "info",
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
      const r = await getAdminPendingApprovals(8);
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
      const r = await getAdminRecentSignups(5);
      return r.ok ? r.data : [];
    },
  });
  const ordersQ = useQuery({
    queryKey: ["admin-overview", "recent-orders"],
    queryFn: async () => {
      const r = await getAdminRecentOrders(5);
      return r.ok ? r.data : [];
    },
  });
  const auditQ = useQuery({
    queryKey: ["admin-overview", "audit"],
    queryFn: async () => {
      const r = await getAdminAuditLog(8);
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
    .slice(0, 6);

  const pendingTotal = (s?.pendingStores ?? 0) + (s?.pendingBrands ?? 0) + (s?.pendingProducts ?? 0);
  const activeStoreRate = s?.stores ? (s.activeStores / s.stores) * 100 : 0;
  const customerShare = s?.users ? (s.customers / s.users) * 100 : 0;
  const approvalLoad = s ? (s.stores + s.brands + s.products ? (pendingTotal / (s.stores + s.brands + s.products)) * 100 : 0) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.light.primary} />
      }
    >
      {/* Masthead */}
      <View style={styles.masthead}>
        <View style={styles.mastheadTop}>
          <View style={styles.liveRow}>
            <StatusDot tone="live" size={8} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.clock}>{clock}</Text>
        </View>
        <Text style={styles.headline}>
          The LUXE{`\n`}<Text style={styles.headlineAccent}>Marketplace</Text>
        </Text>
        <Text style={styles.subline}>
          {user?.user_metadata?.full_name ?? "Admin"} · platform command centre
        </Text>
        <View style={styles.mastheadStats}>
          <View style={styles.mastheadStat}>
            <Text style={styles.mastLabel}>AOV</Text>
            <Text style={styles.mastValue}>{formatPrice(s?.aov ?? 0)}</Text>
          </View>
          <View style={styles.mastheadDivider} />
          <View style={styles.mastheadStat}>
            <Text style={styles.mastLabel}>Pending</Text>
            <Text style={styles.mastValue}>{pendingTotal}</Text>
          </View>
          <View style={styles.mastheadDivider} />
          <View style={styles.mastheadStat}>
            <Text style={styles.mastLabel}>Revenue</Text>
            <Text style={[styles.mastValue, { color: colors.olive[600] }]}>{formatPrice(s?.revenue ?? 0)}</Text>
          </View>
        </View>
      </View>

      {/* Bento KPIs */}
      {isLoading ? (
        <View style={styles.bento}>
          <View style={styles.bentoLarge}>
            <Skeleton height={36} width="60%" />
            <Skeleton height={20} width="40%" style={{ marginTop: 12 }} />
          </View>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.bentoSmall}>
              <Skeleton height={12} width="60%" />
              <Skeleton height={28} width="50%" style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.bento}>
          <View style={[styles.bentoLarge, styles.bentoRevenue]}>
            <Text style={styles.bentoLabel}>Total Revenue</Text>
            <Text style={styles.bentoRevenueValue}>{formatPrice(s?.revenue ?? 0)}</Text>
            <Text style={styles.bentoSub}>LKR marketplace gross</Text>
            <View style={styles.bentoFooter}>
              <Text style={styles.bentoFootText}>{(s?.orders ?? 0).toLocaleString()} orders</Text>
              <Text style={styles.bentoFootText}>AOV {formatPrice(s?.aov ?? 0)}</Text>
            </View>
            <ProgressBar value={Math.min(100, Math.max(8, approvalLoad))} fillColor={colors.olive[400]} style={{ marginTop: 12 }} />
          </View>
          <StatTile label="Orders" value={(s?.orders ?? 0).toLocaleString()} sub={`${formatPrice(s?.aov ?? 0)} avg`} style={styles.bentoSmall} />
          <StatTile label="Customers" value={(s?.customers ?? 0).toLocaleString()} sub={`${customerShare.toFixed(0)}% of users`} style={styles.bentoSmall} />
          <StatTile label="Active Stores" value={`${s?.activeStores ?? 0}/${s?.stores ?? 0}`} sub="approved ratio" style={styles.bentoSmall} />
          <StatTile label="Catalogue" value={(s?.products ?? 0).toLocaleString()} sub={`${s?.brands ?? 0} brands`} style={styles.bentoSmall} />
          <View style={[styles.bentoWide, styles.bentoPending]}>
            <View style={styles.pendingBlob} />
            <View style={styles.pendingInner}>
              <Text style={styles.bentoLabel}>Pending Reviews</Text>
              <Text style={styles.bentoValue}>{pendingTotal.toLocaleString()}</Text>
              <View style={styles.pendingChips}>
                <Chip tone="amber">{s?.pendingStores ?? 0} stores</Chip>
                <Chip tone="amber">{s?.pendingBrands ?? 0} brands</Chip>
                <Chip tone="amber">{s?.pendingProducts ?? 0} products</Chip>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Approval queue + alerts + sidebar */}
      <View style={styles.queueBlock}>
        <View style={[styles.queue, styles.queueCol]}>
          <View style={styles.queueHeader}>
            <View>
              <Text style={styles.queueLabel}>QUEUE</Text>
              <Text style={styles.queueTitle}>Approval Queue</Text>
            </View>
            <Pressable onPress={() => router.push("/(admin)/approvals" as any)} hitSlop={10}>
              <Text style={styles.queueLink}>View all →</Text>
            </Pressable>
          </View>
          {merged.length === 0 ? (
            <View style={styles.queueEmpty}>
              <Ionicons name="checkmark-done" size={22} color={colors.light.primary} />
              <Text style={styles.queueEmptyText}>All caught up — nothing pending.</Text>
            </View>
          ) : (
            merged.map((row, i) => (
              <ListRow
                key={`${row.kind}-${row.id}`}
                index={i + 1}
                title={row.name}
                subtitle={`${row.kind} · ${formatRelative(row.created_at)}`}
                right={
                  <View style={styles.queueActions}>
                    {row.kind === "Store" ? (
                      <>
                        <Pressable
                          onPress={() =>
                            Alert.alert("Approve store", row.name, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Approve", onPress: () => approveStoreM.mutate(row.id) },
                            ])
                          }
                          style={[styles.iconBtn, styles.iconBtnPrimary]}
                        >
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            Alert.alert("Reject store", row.name, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Reject", style: "destructive", onPress: () => rejectStoreM.mutate(row.id) },
                            ])
                          }
                          style={styles.iconBtn}
                        >
                          <Ionicons name="close" size={14} color={colors.light.foreground} />
                        </Pressable>
                      </>
                    ) : row.kind === "Brand" ? (
                      <Pressable
                        onPress={() =>
                          Alert.alert("Approve brand", row.name, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Approve", onPress: () => approveBrandM.mutate(row.id) },
                          ])
                        }
                        style={[styles.iconBtn, styles.iconBtnPrimary]}
                      >
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() =>
                          Alert.alert("Approve product", row.name, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Approve", onPress: () => approveProductM.mutate(row.id) },
                          ])
                        }
                        style={[styles.iconBtn, styles.iconBtnPrimary]}
                      >
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </Pressable>
                    )}
                  </View>
                }
              />
            ))
          )}
        </View>

        <View style={[styles.queue, styles.alertsCol]}>
          <View style={styles.alertsHeader}>
            <Ionicons name="flash-outline" size={14} color={colors.light.primary} />
            <Text style={styles.alertsTitle}>Alerts</Text>
          </View>
          <AlertTile
            icon="alert-circle-outline"
            tone="warning"
            label="Low Stock"
            value={String(lowStockQ.data?.length ?? 0)}
            sub="variants"
            onPress={() => router.push("/(admin)/products" as any)}
          />
          <AlertTile
            icon="shield-checkmark-outline"
            tone="default"
            label="KYC"
            value={String(s?.pendingStores ?? 0)}
            sub="stores"
            onPress={() => router.push("/(admin)/stores" as any)}
          />
          <AlertTile
            icon="cube-outline"
            tone="info"
            label="Products"
            value={String(s?.pendingProducts ?? 0)}
            sub="awaiting review"
            onPress={() => router.push("/(admin)/products" as any)}
          />
          <AlertTile
            icon="chatbubbles-outline"
            tone="info"
            label="Content"
            value="Open"
            sub="reviews & Q&A"
            onPress={() => router.push("/(admin)/content" as any)}
          />
        </View>
      </View>

      {/* Recent orders + Audit log */}
      <View style={styles.splitBlock}>
        <View style={styles.splitCol}>
          <View style={styles.splitHeader}>
            <View>
              <Text style={styles.queueLabel}>ORDERS</Text>
              <Text style={styles.splitTitle}>Recent</Text>
            </View>
            <Pressable onPress={() => router.push("/(admin)/orders" as any)} hitSlop={10}>
              <Text style={styles.queueLink}>All →</Text>
            </Pressable>
          </View>
          {(ordersQ.data ?? []).length === 0 ? (
            <View style={styles.miniEmpty}><Text style={styles.miniEmptyText}>No orders yet</Text></View>
          ) : (
            (ordersQ.data ?? []).map((o: any, i: number) => (
              <Pressable
                key={o.id}
                onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: o.id } })}
              >
                <ListRow
                  index={i + 1}
                  title={o.user?.full_name ?? "Customer"}
                  subtitle={`${o.order_number ?? o.id.slice(0, 8)} · ${formatRelative(o.placed_at)}`}
                  right={
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.orderAmount}>{formatPrice(Number(o.total ?? 0), o.currency ?? "LKR")}</Text>
                      <View style={[styles.statusPill, { backgroundColor: pillBg(STATUS_TONE[o.status] ?? "muted") }]}>
                        <Text style={[styles.statusPillText, { color: pillFg(STATUS_TONE[o.status] ?? "muted") }]}>{o.status}</Text>
                      </View>
                    </View>
                  }
                />
              </Pressable>
            ))
          )}
        </View>
        <View style={styles.splitCol}>
          <View style={styles.splitHeader}>
            <View>
              <Text style={styles.queueLabel}>ACTIVITY</Text>
              <Text style={styles.splitTitle}>Audit Log</Text>
            </View>
            <Pressable onPress={() => router.push("/(admin)/audit-log" as any)} hitSlop={10}>
              <Text style={styles.queueLink}>All →</Text>
            </Pressable>
          </View>
          {(auditQ.data ?? []).length === 0 ? (
            <View style={styles.miniEmpty}><Text style={styles.miniEmptyText}>No activity yet</Text></View>
          ) : (
            (auditQ.data ?? []).map((e: any) => (
              <ListRow
                key={e.id}
                leftIcon={
                  <View style={[styles.auditDot, { backgroundColor: auditColor(e.action) }]} />
                }
                title={e.actor_name ?? "Admin"}
                subtitle={humanize(e.action)}
                meta={formatRelative(e.created_at)}
              />
            ))
          )}
        </View>
      </View>

      {/* Health strip */}
      <View style={styles.healthBlock}>
        <HealthCard
          label="Store activation"
          value={`${activeStoreRate.toFixed(0)}%`}
          description={`${s?.activeStores ?? 0} of ${s?.stores ?? 0} stores approved`}
          progress={activeStoreRate}
        />
        <HealthCard
          label="Customer share"
          value={`${customerShare.toFixed(0)}%`}
          description={`${s?.customers ?? 0} customers across ${s?.users ?? 0} users`}
          progress={customerShare}
        />
        <HealthCard
          label="Catalogue pipeline"
          value={String(pendingTotal)}
          description={`${s?.pendingProducts ?? 0} products · ${s?.pendingStores ?? 0} stores · ${s?.pendingBrands ?? 0} brands`}
          progress={approvalLoad}
        />
      </View>

      {/* Signups + low stock + quick links */}
      <View style={styles.bottomBlock}>
        <View style={styles.bottomCol}>
          <View style={styles.bottomHeader}>
            <Text style={styles.queueLabel}>USERS</Text>
            <Text style={styles.splitTitle}>Recent signups</Text>
          </View>
          {(signupsQ.data ?? []).length === 0 ? (
            <View style={styles.miniEmpty}><Text style={styles.miniEmptyText}>No users</Text></View>
          ) : (
            (signupsQ.data ?? []).map((u: any) => (
              <ListRow
                key={u.id}
                leftIcon={
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{(u.full_name ?? u.email ?? "U").charAt(0).toUpperCase()}</Text>
                  </View>
                }
                title={u.full_name ?? "User"}
                subtitle={u.email ?? u.phone ?? "—"}
                meta={u.role}
              />
            ))
          )}
        </View>
        <View style={styles.bottomCol}>
          <View style={styles.bottomHeader}>
            <Text style={styles.queueLabel}>INVENTORY</Text>
            <Text style={styles.splitTitle}>Low stock</Text>
          </View>
          {(lowStockQ.data ?? []).length === 0 ? (
            <View style={styles.miniEmpty}><Text style={styles.miniEmptyText}>All stocked up</Text></View>
          ) : (
            (lowStockQ.data ?? []).map((item: any) => (
              <ListRow
                key={item.id}
                leftIcon={
                  <View style={styles.stockIcon}>
                    <Ionicons name="cube-outline" size={14} color={colors.light.destructive} />
                  </View>
                }
                title={item.variant?.product?.name ?? "Variant"}
                subtitle={`${item.available ?? item.quantity} available · threshold ${item.low_stock_threshold}`}
                right={
                  <View style={{ width: 56 }}>
                    <ProgressBar
                      value={item.low_stock_threshold ? ((item.available ?? item.quantity) / item.low_stock_threshold) * 100 : 0}
                      fillColor={colors.light.destructive}
                    />
                  </View>
                }
              />
            ))
          )}
        </View>
        <View style={styles.bottomCol}>
          <View style={styles.bottomHeader}>
            <Text style={styles.queueLabel}>NAVIGATE</Text>
            <Text style={styles.splitTitle}>Quick links</Text>
          </View>
          <QuickLink label="Analytics" icon="analytics-outline" onPress={() => router.push("/(admin)/analytics" as any)} />
          <QuickLink label="Delivery" icon="car-outline" onPress={() => router.push("/(admin)/delivery" as any)} />
          <QuickLink label="Commissions" icon="wallet-outline" onPress={() => router.push("/(admin)/commissions" as any)} />
          <QuickLink label="Homepage CMS" icon="globe-outline" onPress={() => router.push("/(admin)/homepage" as any)} />
          <QuickLink label="Gift Cards" icon="gift-outline" onPress={() => router.push("/(admin)/gift-cards" as any)} />
          <QuickLink label="Reports" icon="download-outline" onPress={() => router.push("/(admin)/reports" as any)} />
        </View>
      </View>
    </ScrollView>
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
  if (action.includes("create") || action.includes("approve")) return colors.olive[500];
  if (action.includes("update")) return "#c8a44a";
  return colors.light.muted;
}

function AlertTile({ icon, tone, label, value, sub, onPress }: any) {
  const c = tone === "warning" ? "#c8a44a" : tone === "danger" ? colors.light.destructive : colors.light.primary;
  return (
    <Pressable onPress={onPress} style={styles.alertTile}>
      <View style={[styles.alertIcon, { backgroundColor: c + "22" }]}>
        <Ionicons name={icon} size={14} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.alertLabel}>{label}</Text>
        <Text style={styles.alertSub}>{sub}</Text>
      </View>
      <Text style={[styles.alertValue, { color: c }]}>{value}</Text>
    </Pressable>
  );
}

function HealthCard({ label, value, description, progress }: { label: string; value: string; description: string; progress: number }) {
  return (
    <View style={styles.healthCard}>
      <View style={styles.healthHead}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthPct}>{Math.round(progress)}%</Text>
      </View>
      <Text style={styles.healthValue}>{value}</Text>
      <Text style={styles.healthDesc}>{description}</Text>
      <ProgressBar value={progress} fillColor={colors.olive[500]} style={{ marginTop: 12 }} />
    </View>
  );
}

function QuickLink({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickLink}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={14} color={colors.light.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },

  masthead: {
    margin: 16,
    marginBottom: 0,
    padding: 24,
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  mastheadTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[600],
    letterSpacing: 1.4,
  },
  clock: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
  },
  headline: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 36,
    color: colors.light.foreground,
    letterSpacing: -1.2,
    lineHeight: 38,
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
    marginTop: 8,
  },
  mastheadStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  mastheadStat: { flex: 1, gap: 4 },
  mastheadDivider: { width: 1, height: 32, backgroundColor: colors.light.border, marginHorizontal: 12 },
  mastLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  mastValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },

  bento: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bentoLarge: {
    width: "100%",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 20,
    minHeight: 180,
    justifyContent: "space-between",
  },
  bentoSmall: {
    width: "49%",
    flexGrow: 1,
  },
  bentoWide: {
    width: "100%",
  },
  bentoRevenue: { minHeight: 200 },
  bentoRevenueValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 36,
    color: colors.light.foreground,
    letterSpacing: -1,
    marginTop: 8,
  },
  bentoValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.light.foreground,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  bentoLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  bentoSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  bentoFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  bentoFootText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 0.5,
  },
  bentoPending: {
    backgroundColor: "#fdf3d7",
    overflow: "hidden",
    minHeight: 110,
  },
  pendingBlob: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f5d97a",
    opacity: 0.4,
  },
  pendingInner: { padding: 20, gap: 6 },
  pendingChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },

  queueBlock: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
  },
  queue: {},
  queueCol: { flex: 2, borderRightWidth: 1, borderRightColor: colors.light.border },
  alertsCol: { flex: 1, paddingVertical: 8 },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  queueLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  queueTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    color: colors.light.foreground,
    marginTop: 2,
  },
  queueLink: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.primary,
  },
  queueEmpty: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 6,
  },
  queueEmptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  queueActions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },

  alertsHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  alertsTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.light.foreground },
  alertTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertIcon: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  alertLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.light.foreground },
  alertSub: { fontFamily: fontFamilies.sans.regular, fontSize: 9, color: colors.light.mutedForeground, marginTop: 1 },
  alertValue: { fontFamily: fontFamilies.display.semibold, fontSize: 14 },

  splitBlock: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  splitCol: {
    flex: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
  },
  splitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  splitTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 14,
    color: colors.light.foreground,
    marginTop: 2,
  },
  orderAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  statusPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  miniEmpty: { padding: 24, alignItems: "center" },
  miniEmptyText: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },

  auditDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },

  healthBlock: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
  },
  healthCard: { flex: 1, padding: 16, borderRightWidth: 1, borderRightColor: colors.light.border },
  healthHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  healthLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  healthPct: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: colors.olive[600] },
  healthValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.light.foreground,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  healthDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },

  bottomBlock: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
  },
  bottomCol: { flex: 1, borderRightWidth: 1, borderRightColor: colors.light.border },
  bottomHeader: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  userAvatarText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.card,
  },
  stockIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fbe5dc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.light.accent + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.light.foreground },
});
