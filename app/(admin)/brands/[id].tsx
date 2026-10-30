import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable, Alert, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getAdminBrandById, approveBrand } from "@/lib/api";
import { formatPrice, resolveImageUrl } from "@/lib/utils";
import { INK, LIME, HAIRLINE, StatusPill, Empty, statusTone } from "@/components/admin/catalog-kit";

const CREAM = colors.paper.cream;
const RUST = "#7a2f1a";
const GOLD = "#8a6a2a";

const initialsOf = (name?: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function primaryImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const primary = images.find((i: any) => i?.is_primary) ?? images[0];
  const url = primary?.url;
  return typeof url === "string" && url ? resolveImageUrl(url) || url : null;
}

function formatRelative(dateStr?: string | null) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "today";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" });
}

export default function BrandDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-brand", id],
    queryFn: async () => {
      const r = await getAdminBrandById(String(id));
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-brand", id] });
    qc.invalidateQueries({ queryKey: ["admin-brands"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };
  const approve = useMutation({
    mutationFn: () => approveBrand(String(id), "approved"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Approve failed", res.error);
        return;
      }
      invalidate();
    },
    onError: (e) => Alert.alert("Approve failed", e instanceof Error ? e.message : "Try again."),
  });
  const reject = useMutation({
    mutationFn: () => approveBrand(String(id), "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Reject failed", res.error);
        return;
      }
      invalidate();
    },
    onError: (e) => Alert.alert("Reject failed", e instanceof Error ? e.message : "Try again."),
  });

  if (q.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          <Skeleton height={300} style={{ borderRadius: radii.xl }} />
          <Skeleton height={110} style={{ borderRadius: radii.xl }} />
          <Skeleton height={150} style={{ borderRadius: radii.xl }} />
        </View>
      </View>
    );
  }

  const b = q.data;
  if (q.isError || !b) {
    return (
      <View style={styles.container}>
        <Empty
          icon="cloud-offline-outline"
          title="Brand not found"
          body={q.error instanceof Error ? q.error.message : "This brand may have been removed."}
        />
      </View>
    );
  }

  const logo = b.logo_url ? resolveImageUrl(b.logo_url) || b.logo_url : null;
  const products = b.products ?? [];
  const isPending = b.status === "pending";
  const mutating = approve.isPending || reject.isPending;

  const banner = b.banner_url
    ? resolveImageUrl(b.banner_url) || b.banner_url
    : products.map((p: any) => primaryImage(p.images)).find(Boolean) ?? null;

  const liveCount = products.filter((p: any) => p.status === "active").length;
  const pendingCount = products.filter((p: any) => p.status === "pending").length;
  const soldTotal = products.reduce((n: number, p: any) => n + (p.total_sales ?? 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: isPending ? 120 : 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => q.refetch()}
            tintColor={colors.olive[700]}
            colors={[colors.olive[800]]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — banner mosaic + overlapping logo */}
        <Animated.View entering={FadeInDown.duration(380)} style={styles.heroCard}>
          <View style={styles.banner}>
            {banner ? (
              <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
              <LinearGradient
                colors={["#e6e6d0", "#cccca0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerEmpty}
              >
                <Text style={styles.bannerInitials}>{initialsOf(b.name)}</Text>
              </LinearGradient>
            )}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.heroStatusPill, { backgroundColor: statusTone(b.status).bg }]}>
              <View style={[styles.heroStatusDot, { backgroundColor: statusTone(b.status).dot }]} />
              <Text style={[styles.heroStatusText, { color: statusTone(b.status).text }]}>
                {statusTone(b.status).label.toUpperCase()}
              </Text>
            </View>
            {b.is_featured ? (
              <View style={styles.heroFeaturedPill}>
                <Ionicons name="star" size={10} color={colors.olive[900]} />
                <Text style={styles.heroFeaturedText}>FEATURED</Text>
              </View>
            ) : null}
            <View style={styles.itemsPill}>
              <Text style={styles.itemsPillText}>{b.total_products ?? products.length} ITEMS</Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.logoWrap}>
              <View style={styles.heroLogo}>
                {logo ? (
                  <Image source={{ uri: logo }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
                ) : (
                  <Text style={styles.heroInitials}>{initialsOf(b.name)}</Text>
                )}
              </View>
            </View>
            <View style={styles.heroTitleRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroEyebrow}>BRAND</Text>
                <View style={styles.heroNameRow}>
                  <Text style={styles.heroName} numberOfLines={2}>{b.name}</Text>
                  {b.is_verified ? (
                    <Ionicons name="checkmark-circle" size={15} color={colors.olive[700]} />
                  ) : null}
                </View>
                <Text style={styles.heroSlug}>
                  @{b.slug}
                  {(b as any).created_at ? `  ·  joined ${formatRelative((b as any).created_at)}` : ""}
                </Text>
              </View>
            </View>

            {/* Stats strip */}
            <View style={styles.stats}>
              <Stat label="PRODUCTS" value={String(b.total_products ?? products.length)} />
              <View style={styles.statDivider} />
              <Stat label="FOLLOWERS" value={Number(b.total_followers ?? 0).toLocaleString()} />
              <View style={styles.statDivider} />
              <Stat label="RATING" value={b.rating ? Number(b.rating).toFixed(1) : "—"} />
            </View>
          </View>
        </Animated.View>

        {/* Pending review banner */}
        {isPending ? (
          <Animated.View entering={FadeInDown.duration(380).delay(50)} style={styles.reviewBanner}>
            <Ionicons name="shield-checkmark-outline" size={16} color={GOLD} />
            <Text style={styles.reviewBannerText}>Awaiting moderation — approve or reject below.</Text>
          </Animated.View>
        ) : null}

        {/* Stat tiles */}
        <Animated.View entering={FadeInDown.duration(380).delay(90)} style={styles.statGrid}>
          <StatTile icon="cube-outline" label="CATALOGUE" value={String(products.length)} sub={`${liveCount} live`} />
          <StatTile
            icon="time-outline"
            label="TO REVIEW"
            value={String(pendingCount)}
            sub={pendingCount ? "products pending" : "queue clear"}
            warn={pendingCount > 0}
          />
          <StatTile icon="bag-check-outline" label="UNITS SOLD" value={soldTotal.toLocaleString()} sub="across the label" />
          <StatTile
            icon="star-outline"
            label="RATING"
            value={b.rating ? Number(b.rating).toFixed(1) : "—"}
            sub={b.is_verified ? "verified label" : "unverified"}
          />
        </Animated.View>

        {/* About */}
        {b.tagline || b.description ? (
          <Animated.View entering={FadeInDown.duration(380).delay(140)} style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="document-text-outline" size={16} color={colors.olive[800]} />
              </View>
              <View>
                <Text style={styles.sectionEyebrow}>PROFILE</Text>
                <Text style={styles.sectionTitle}>About the label</Text>
              </View>
            </View>
            {b.tagline ? <Text style={styles.tagline}>{b.tagline}</Text> : null}
            {b.description ? <Text style={styles.body}>{b.description}</Text> : null}
          </Animated.View>
        ) : null}

        {/* Catalogue */}
        <Animated.View entering={FadeInDown.duration(380).delay(190)} style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="grid-outline" size={16} color={colors.olive[800]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>CATALOGUE</Text>
              <Text style={styles.sectionTitle}>Products</Text>
            </View>
            {products.length > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{products.length}</Text>
              </View>
            ) : null}
          </View>
          {products.length === 0 ? (
            <View style={styles.catalogueEmpty}>
              <Ionicons name="cube-outline" size={18} color="rgba(22,23,15,0.3)" />
              <Text style={styles.catalogueEmptyText}>No products yet</Text>
            </View>
          ) : (
            products.slice(0, 12).map((p, i) => {
              const img = primaryImage(p.images);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: "/(admin)/products/[id]", params: { id: p.id } } as any)}
                  style={({ pressed }) => [
                    styles.productRow,
                    i === Math.min(products.length, 12) - 1 && styles.productRowLast,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.productThumb}>
                    {img ? (
                      <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    ) : (
                      <View style={styles.productThumbEmpty}>
                        <Ionicons name="image-outline" size={15} color="rgba(22,23,15,0.25)" />
                      </View>
                    )}
                  </View>
                  <View style={styles.productBody}>
                    <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.productMeta} numberOfLines={1}>
                      {typeof p.price === "number" ? `${formatPrice(p.price, p.currency ?? "LKR")} · ` : ""}
                      {p.total_sales ?? 0} sold
                    </Text>
                  </View>
                  <StatusPill status={p.status} />
                </Pressable>
              );
            })
          )}
          {products.length > 12 ? (
            <Text style={styles.moreHint}>+{products.length - 12} more in the catalogue tab</Text>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Sticky approve / reject */}
      {isPending ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionReject, mutating && styles.actionDisabled]}
            disabled={mutating}
            onPress={() =>
              Alert.alert("Reject brand?", `${b.name} will be marked as rejected.`, [
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
              Alert.alert("Approve brand?", `${b.name} will go live on the storefront.`, [
                { text: "Cancel", style: "cancel" },
                { text: "Approve", onPress: () => approve.mutate() },
              ])
            }
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={15} color={CREAM} />
            <Text style={styles.actionApproveText}>
              {approve.isPending ? "Approving…" : "Approve label"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTileTop}>
        <View style={[styles.statTileIcon, warn && styles.statTileIconWarn]}>
          <Ionicons name={icon} size={14} color={warn ? "#b7791f" : colors.olive[700]} />
        </View>
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={[styles.statTileValue, warn && { color: "#b7791f" }]} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.statTileSub}>{sub}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  skeletonWrap: { padding: 16, gap: 14 },

  /* Hero card (StoreCard anatomy) */
  heroCard: {
    borderRadius: 28,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 7,
    marginBottom: 14,
    ...shadows.soft,
  },
  banner: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
  },
  bannerEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  bannerInitials: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 64,
    color: "rgba(22,23,15,0.15)",
  },
  heroStatusPill: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  heroStatusDot: { width: 5, height: 5, borderRadius: 3 },
  heroStatusText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 0.7,
  },
  heroFeaturedPill: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: LIME,
  },
  heroFeaturedText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[900],
    letterSpacing: 0.8,
  },
  itemsPill: {
    position: "absolute",
    bottom: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(245,244,239,0.92)",
  },
  itemsPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: "rgba(22,23,15,0.75)",
  },
  heroBody: { paddingHorizontal: 14, paddingBottom: 14 },
  logoWrap: { marginTop: -34, alignSelf: "flex-start", borderRadius: 18, borderWidth: 4, borderColor: "#fbfaf6" },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitials: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    color: LIME,
  },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  heroName: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 25,
    lineHeight: 28,
    letterSpacing: -0.6,
    color: INK,
    flexShrink: 1,
  },
  heroSlug: {
    marginTop: 3,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  stats: {
    flexDirection: "row",
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: "rgba(239,236,226,0.6)",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.04)",
  },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  statDivider: { width: 1, backgroundColor: "rgba(22,23,15,0.07)" },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: "rgba(22,23,15,0.4)",
  },
  statValue: {
    marginTop: 4,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    color: INK,
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
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
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
  statTileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  statTileIconWarn: { backgroundColor: "#fdf3dc", borderColor: "rgba(200,164,74,0.3)" },
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

  /* Section cards */
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
  countPill: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: LIME,
  },

  /* About */
  tagline: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
    color: INK,
    marginBottom: 6,
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.light.mutedForeground,
    lineHeight: 20,
  },

  /* Catalogue rows */
  catalogueEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  catalogueEmptyText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: "rgba(22,23,15,0.45)",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#efece3",
  },
  productRowLast: { borderBottomWidth: 0 },
  productThumb: {
    width: 44,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
  },
  productThumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  productBody: { flex: 1, gap: 2, minWidth: 0 },
  productName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: INK,
  },
  productMeta: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: "rgba(22,23,15,0.5)",
  },
  moreHint: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.ink.mute,
    textAlign: "center",
    paddingTop: 12,
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
