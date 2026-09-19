import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminProductDetail, approveProduct } from "@/lib/api";
import { Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, resolveImageUrl } from "@/lib/utils";

const CREAM = colors.paper.cream;
const RUST = "#7a2f1a";
const GOLD = "#8a6a2a";

const STATUS_TONES: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  pending: { bg: "rgba(200,164,74,0.22)", text: GOLD },
  draft: { bg: colors.light.muted, text: colors.light.mutedForeground },
  archived: { bg: colors.light.muted, text: colors.light.mutedForeground },
  rejected: { bg: "rgba(184,92,58,0.14)", text: RUST },
};

function statusTone(status?: string) {
  return STATUS_TONES[String(status ?? "").toLowerCase()] ?? STATUS_TONES.draft;
}

function formatRelative(dateStr?: string) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-LK", { month: "short", day: "numeric" });
}

export default function AdminProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-product", id],
    queryFn: async () => {
      const r = await getAdminProductDetail(id!);
      return r.ok ? r.data : null;
    },
    enabled: !!id,
  });

  const approve = useMutation({
    mutationFn: () => approveProduct(id!, "active"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Approve failed", res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      qc.invalidateQueries({ queryKey: ["cat-products"] });
    },
    onError: (e) => Alert.alert("Approve failed", e instanceof Error ? e.message : "Try again."),
  });
  const reject = useMutation({
    mutationFn: () => approveProduct(id!, "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Reject failed", res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      qc.invalidateQueries({ queryKey: ["cat-products"] });
    },
    onError: (e) => Alert.alert("Reject failed", e instanceof Error ? e.message : "Try again."),
  });

  if (q.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          <Skeleton height={220} style={{ borderRadius: radii.xl }} />
          <Skeleton height={110} style={{ borderRadius: radii.xl }} />
          <Skeleton height={150} style={{ borderRadius: radii.xl }} />
        </View>
      </View>
    );
  }

  const data = q.data;
  const p = data?.product;
  if (!p) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cube-outline" size={26} color={colors.olive[700]} />
          </View>
          <Text style={styles.emptyTitle}>Product not found</Text>
          <Text style={styles.emptyText}>This product may have been removed or the link is out of date.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryLabel}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tone = statusTone(p.status);
  const images = Array.isArray(p.images) ? p.images : [];
  const heroImg = (() => {
    const primary = images.find((i: any) => i?.is_primary) ?? images[0];
    return primary?.url ? resolveImageUrl(primary.url) || primary.url : null;
  })();
  const currency = p.currency ?? "LKR";
  const hasDiscount = Number(p.mrp ?? 0) > Number(p.price ?? 0);
  const isPending = p.status === "pending";
  const inventory = data?.inventory;
  const totals = data?.totals;
  const recentOrders = data?.recentOrders ?? [];
  const mutating = approve.isPending || reject.isPending;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: isPending ? 120 : 40 }]}
        refreshControl={
          <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.olive[700]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={styles.heroCard}>
          {heroImg ? (
            <Image source={{ uri: heroImg }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroImageEmpty]}>
              <Ionicons name="cube-outline" size={40} color={colors.olive[300]} />
            </View>
          )}
          <View style={[styles.heroStatusPill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.heroStatusText, { color: tone.text }]}>
              {String(p.status).replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          {hasDiscount && Number(p.discount_pct) > 0 ? (
            <View style={styles.heroDiscountPill}>
              <Text style={styles.heroDiscountText}>-{Math.round(Number(p.discount_pct))}%</Text>
            </View>
          ) : null}
        </View>

        {/* Title + price */}
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>PRODUCT</Text>
          <Text style={styles.title}>{p.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {[p.store?.name, p.brand?.name, p.category?.name].filter(Boolean).join(" · ") || "Independent Atelier"}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(p.price, currency)}</Text>
            {hasDiscount ? (
              <Text style={styles.compare}>{formatPrice(p.mrp!, currency)}</Text>
            ) : null}
            {p.sku ? <Text style={styles.sku}>SKU {p.sku}</Text> : null}
          </View>
        </View>

        {/* Pending review banner */}
        {isPending ? (
          <View style={styles.reviewBanner}>
            <Ionicons name="shield-checkmark-outline" size={16} color={GOLD} />
            <Text style={styles.reviewBannerText}>Awaiting catalogue review — approve or reject below.</Text>
          </View>
        ) : null}

        {/* Performance stats */}
        <View style={styles.statGrid}>
          <StatTile icon="cash-outline" label="REVENUE" value={formatPrice(totals?.revenue ?? 0, currency)} />
          <StatTile icon="bag-check-outline" label="UNITS SOLD" value={String(totals?.units ?? p.total_sales ?? 0)} />
          <StatTile
            icon="star-outline"
            label="RATING"
            value={totals?.rating ? Number(totals.rating).toFixed(1) : "—"}
            sub={`${totals?.reviews ?? 0} reviews`}
          />
          <StatTile icon="eye-outline" label="VIEWS" value={String(totals?.viewCount ?? p.view_count ?? 0)} sub={`${totals?.wishlistCount ?? 0} wishlisted`} />
        </View>

        {/* Inventory health */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="cube-outline" size={16} color={colors.olive[800]} />
            </View>
            <View>
              <Text style={styles.sectionEyebrow}>STOCK</Text>
              <Text style={styles.sectionTitle}>Inventory health</Text>
            </View>
          </View>
          <View style={styles.statRows}>
            <Stat label="Variants tracked" value={inventory?.variants ?? 0} />
            <Stat
              label="Low stock"
              value={inventory?.lowStockCount ?? 0}
              warn={(inventory?.lowStockCount ?? 0) > 0}
            />
            <Stat
              label="Out of stock"
              value={inventory?.outOfStockCount ?? 0}
              danger={(inventory?.outOfStockCount ?? 0) > 0}
            />
          </View>
        </View>

        {/* Last 30 days */}
        {totals && (totals.recentRevenue > 0 || totals.recentUnits > 0) ? (
          <View style={styles.recentCard}>
            <View style={styles.recentCell}>
              <Text style={styles.recentLabel}>LAST 30 DAYS</Text>
              <Text style={styles.recentValue}>{formatPrice(totals.recentRevenue, currency)}</Text>
            </View>
            <View style={styles.recentDivider} />
            <View style={styles.recentCell}>
              <Text style={styles.recentLabel}>UNITS · 30D</Text>
              <Text style={styles.recentValue}>{totals.recentUnits}</Text>
            </View>
          </View>
        ) : null}

        {/* Recent orders */}
        {recentOrders.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="receipt-outline" size={16} color={colors.olive[800]} />
              </View>
              <View>
                <Text style={styles.sectionEyebrow}>DEMAND</Text>
                <Text style={styles.sectionTitle}>Recent orders</Text>
              </View>
            </View>
            {recentOrders.slice(0, 5).map((o, i) => (
              <Pressable
                key={`${o.id ?? o.order_number}-${i}`}
                style={[styles.orderRow, i === Math.min(recentOrders.length, 5) - 1 && styles.orderRowLast]}
                onPress={() => o.id && router.push({ pathname: "/(admin)/orders/[id]", params: { id: o.id } } as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNum}>#{o.order_number ?? "—"}</Text>
                  <Text style={styles.orderMeta}>
                    {o.customer ?? "Customer"} · ×{o.quantity ?? 0} · {formatRelative(o.placed_at)}
                  </Text>
                </View>
                <Text style={styles.orderTotal}>{formatPrice(Number(o.total ?? 0), currency)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Description */}
        {p.description ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="document-text-outline" size={16} color={colors.olive[800]} />
              </View>
              <View>
                <Text style={styles.sectionEyebrow}>LISTING</Text>
                <Text style={styles.sectionTitle}>Description</Text>
              </View>
            </View>
            <Text style={styles.body}>{p.description}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky approve / reject */}
      {isPending ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionReject, mutating && styles.actionDisabled]}
            disabled={mutating}
            onPress={() =>
              Alert.alert("Reject product?", "The seller will see this as rejected.", [
                { text: "Cancel", style: "cancel" },
                { text: "Reject", style: "destructive", onPress: () => reject.mutate() },
              ])
            }
            accessibilityRole="button"
          >
            <Ionicons name="close" size={15} color={RUST} />
            <Text style={styles.actionRejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionApprove, mutating && styles.actionDisabled]}
            disabled={mutating}
            onPress={() =>
              Alert.alert("Approve product?", "This product will go live in the catalogue.", [
                { text: "Cancel", style: "cancel" },
                { text: "Approve", onPress: () => approve.mutate() },
              ])
            }
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={15} color={CREAM} />
            <Text style={styles.actionApproveText}>
              {approve.isPending ? "Approving…" : "Approve listing"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function StatTile({ icon, label, value, sub }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTileIcon}>
        <Ionicons name={icon} size={14} color={colors.olive[700]} />
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={styles.statTileValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.statTileSub}>{sub}</Text> : null}
    </View>
  );
}

function Stat({ label, value, warn, danger }: { label: string; value: number; warn?: boolean; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          warn && { color: GOLD },
          danger && { color: RUST },
        ]}
      >
        {String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  skeletonWrap: { padding: 16, gap: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.olive[900],
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
  },
  retryLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: CREAM,
  },

  /* Hero */
  heroCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  heroImage: {
    width: "100%",
    height: 220,
  },
  heroImageEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  heroStatusPill: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
  },
  heroStatusText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 0.7,
  },
  heroDiscountPill: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.accent2.ochre,
  },
  heroDiscountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[900],
    letterSpacing: 0.4,
  },

  /* Title block */
  titleBlock: {
    paddingHorizontal: 4,
    marginTop: 14,
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.light.foreground,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 8,
  },
  price: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    color: colors.olive[900],
    letterSpacing: -0.5,
  },
  compare: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  sku: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.4,
  },

  /* Review banner */
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(200,164,74,0.14)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.45)",
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  reviewBannerText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: GOLD,
    lineHeight: 16,
  },

  /* Stat grid */
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statTile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    ...shadows.soft,
  },
  statTileIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statTileLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.9,
  },
  statTileValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: colors.light.foreground,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  statTileSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },

  /* Cards */
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    marginBottom: 14,
    ...shadows.soft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 16.5,
    color: colors.light.foreground,
    marginTop: 1,
  },
  statRows: { gap: 2 },
  stat: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#efece3",
  },
  statLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  statValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },

  /* 30-day strip */
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.olive[900],
    borderRadius: radii.xl,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
    ...shadows.soft,
  },
  recentCell: { flex: 1, gap: 2 },
  recentDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(244,242,234,0.16)",
    marginHorizontal: 12,
  },
  recentLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: "rgba(244,242,234,0.55)",
    letterSpacing: 0.9,
  },
  recentValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: CREAM,
    letterSpacing: -0.3,
  },

  /* Recent orders */
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#efece3",
  },
  orderRowLast: { borderBottomWidth: 0 },
  orderNum: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  orderMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  orderTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },

  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.light.foreground,
    lineHeight: 20,
  },

  /* Sticky actions */
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(250,248,243,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0dbcd",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: radii.full,
  },
  actionApprove: {
    backgroundColor: colors.olive[900],
    ...shadows.soft,
  },
  actionApproveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: CREAM,
  },
  actionReject: {
    backgroundColor: "rgba(184,92,58,0.08)",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.35)",
  },
  actionRejectText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: RUST,
  },
  actionDisabled: { opacity: 0.6 },
});
