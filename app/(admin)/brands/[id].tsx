import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton, EmptyState } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getAdminBrandById } from "@/lib/api";
import { formatPrice, resolveImageUrl } from "@/lib/utils";

const RUST = "#7a2f1a";
const GOLD = "#8a6a2a";

const STATUS_TONES: Record<string, { bg: string; text: string }> = {
  approved: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  pending: { bg: "rgba(200,164,74,0.20)", text: GOLD },
  rejected: { bg: "rgba(184,92,58,0.14)", text: RUST },
};

function primaryImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const primary = images.find((i: any) => i?.is_primary) ?? images[0];
  const url = primary?.url;
  return typeof url === "string" && url ? resolveImageUrl(url) || url : null;
}

function HeroPill({ status }: { status: string }) {
  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={13} color={colors.olive[800]} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function BrandDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const q = useQuery({
    queryKey: ["admin-brand", id],
    queryFn: async () => {
      const r = await getAdminBrandById(String(id));
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: !!id,
  });

  if (q.isLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Skeleton height={140} style={{ borderRadius: radii.xl, marginTop: 16 }} />
        <Skeleton height={110} style={{ borderRadius: radii.xl, marginTop: 14 }} />
        <Skeleton height={220} style={{ borderRadius: radii.xl, marginTop: 14 }} />
      </ScrollView>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Brand not found"
          description={q.error instanceof Error ? q.error.message : "This brand may have been removed."}
        />
      </View>
    );
  }

  const b = q.data;
  const logo = b.logo_url ? resolveImageUrl(b.logo_url) || b.logo_url : null;
  const products = b.products ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />
      }
    >
      {/* Dark brand hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.heroLogo} contentFit="cover" />
          ) : (
            <View style={[styles.heroLogo, styles.heroLogoPlaceholder]}>
              <Ionicons name="pricetag-outline" size={24} color={colors.accent2.ochre} />
            </View>
          )}
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>BRAND</Text>
            <Text style={styles.heroName} numberOfLines={2}>{b.name}</Text>
            <Text style={styles.heroSlug}>@{b.slug}</Text>
          </View>
        </View>
        <View style={styles.heroFooter}>
          <HeroPill status={b.status ?? "pending"} />
          <View style={styles.heroFlags}>
            {b.is_verified ? (
              <View style={styles.heroFlag}>
                <Ionicons name="checkmark-circle" size={12} color={colors.accent2.ochre} />
                <Text style={styles.heroFlagText}>Verified</Text>
              </View>
            ) : null}
            {b.is_featured ? (
              <View style={styles.heroFlag}>
                <Ionicons name="star" size={11} color={colors.accent2.ochre} />
                <Text style={styles.heroFlagText}>Featured</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* About */}
      {b.tagline || b.description ? (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={14} color={colors.olive[800]} />
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          {b.tagline ? <Text style={styles.tagline}>{b.tagline}</Text> : null}
          {b.description ? <Text style={styles.desc}>{b.description}</Text> : null}
        </View>
      ) : null}

      {/* Metrics */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart-outline" size={14} color={colors.olive[800]} />
          <Text style={styles.sectionTitle}>Metrics</Text>
        </View>
        <View style={styles.metricRow}>
          <Metric icon="cube-outline" label="Products" value={String(b.total_products ?? products.length)} />
          <Metric icon="people-outline" label="Followers" value={String(b.total_followers ?? 0)} />
          <Metric icon="star-outline" label="Rating" value={Number(b.rating ?? 0).toFixed(1)} />
        </View>
      </View>

      {/* Catalogue */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="grid-outline" size={14} color={colors.olive[800]} />
          <Text style={styles.sectionTitle}>Catalogue</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{products.length}</Text>
          </View>
        </View>
        {products.length === 0 ? (
          <Text style={styles.empty}>No products yet.</Text>
        ) : (
          products.slice(0, 12).map((p, i) => {
            const img = primaryImage(p.images);
            const tone = STATUS_TONES[p.status] ?? { bg: colors.light.muted, text: colors.light.mutedForeground };
            return (
              <Pressable
                key={p.id}
                onPress={() => router.push({ pathname: "/(admin)/products/[id]", params: { id: p.id } } as any)}
                style={[styles.productRow, i > 0 && styles.productRowBorder]}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.productThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.productThumb, styles.productThumbPlaceholder]}>
                    <Ionicons name="cube-outline" size={15} color={colors.olive[700]} />
                  </View>
                )}
                <View style={styles.productBody}>
                  <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.productMeta} numberOfLines={1}>
                    {typeof p.price === "number" ? `${formatPrice(p.price, p.currency ?? "LKR")} · ` : ""}
                    {p.total_sales ?? 0} sold
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.statusPillText, { color: tone.text }]}>
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
        {products.length > 12 ? (
          <Text style={styles.moreHint}>+{products.length - 12} more in the catalogue tab</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 120 },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    backgroundColor: colors.olive[900],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.olive[800],
    ...shadows.soft,
  },
  heroRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  heroLogo: { width: 64, height: 64, borderRadius: 16 },
  heroLogoPlaceholder: {
    backgroundColor: "rgba(244,242,234,0.1)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBody: { flex: 1, gap: 2 },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.accent2.ochre,
    letterSpacing: 1.6,
  },
  heroName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.paper.cream,
    letterSpacing: -0.4,
  },
  heroSlug: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "rgba(244,242,234,0.55)",
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(244,242,234,0.15)",
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  heroPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.paper.cream,
    textTransform: "uppercase",
  },
  heroFlags: { flexDirection: "row", gap: 10 },
  heroFlag: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroFlagText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: "rgba(244,242,234,0.65)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, flex: 1 },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
  },
  countPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[800],
  },
  tagline: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
    fontStyle: "italic",
  },
  desc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    lineHeight: 20,
    marginTop: 6,
  },
  metricRow: { flexDirection: "row", gap: 10 },
  metric: {
    flex: 1,
    padding: 12,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "flex-start",
    gap: 3,
  },
  metricIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.md,
    backgroundColor: "#e6e6d0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
  },
  metricLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: colors.olive[700],
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  productRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  productRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  productThumb: { width: 40, height: 40, borderRadius: 9, backgroundColor: colors.olive[100] },
  productThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  productBody: { flex: 1, gap: 1 },
  productName: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.light.foreground },
  productMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 10.5, color: colors.light.mutedForeground },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  empty: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: "center",
    paddingVertical: 12,
  },
  moreHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    textAlign: "center",
    paddingTop: 10,
  },
});
