import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminBrands, approveBrand } from "@/lib/api";
import { Skeleton, useToast } from "@/components/ui";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils";
import {
  INK,
  LIME,
  HAIRLINE,
  cardSurface as card,
  Chip,
  SearchBar,
  Empty,
  StatusPill,
  kit,
} from "@/components/admin/catalog-kit";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
] as const;

const STATUS_DOT: Record<string, string | undefined> = {
  all: undefined,
  approved: "#22a35a",
  pending: "#e0a526",
  rejected: "#e05252",
};

const initialsOf = (name?: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminBrands() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-brands", status, search],
    queryFn: async () => {
      const r = await getAdminBrands({ status, search });
      if (r.ok) return { brands: r.data.brands, error: null as string | null };
      return { brands: [] as any[], error: r.error ?? "Failed to load brands" };
    },
  });

  // Unfiltered rollup for the KPI bento + chip counts.
  const statsQuery = useQuery({
    queryKey: ["admin-brands", "stats"],
    queryFn: async () => {
      const r = await getAdminBrands({ status: "all", limit: 500 });
      return r.ok ? r.data.brands : [];
    },
    staleTime: 30_000,
  });

  const brands = q.data?.brands ?? [];
  const loadError = q.data?.error ?? null;
  const isFiltered = status !== "all" || search.trim().length > 0;

  const counts = useMemo(() => {
    const src =
      statsQuery.data && statsQuery.data.length ? statsQuery.data : !isFiltered ? brands : null;
    if (!src) return null;
    return {
      total: src.length,
      approved: src.filter((b: any) => b.status === "approved").length,
      pending: src.filter((b: any) => b.status === "pending").length,
      rejected: src.filter((b: any) => b.status === "rejected").length,
    };
  }, [statsQuery.data, brands, isFiltered]);

  const chipCount = (id: string) =>
    counts ? (id === "all" ? counts.total : counts[id as keyof typeof counts]) : undefined;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-brands"] });
    qc.invalidateQueries({ queryKey: ["cat-brands"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };
  const approveM = useMutation({
    mutationFn: (id: string) => approveBrand(id, "approved"),
    onSuccess: () => {
      invalidate();
      toast.success("Brand approved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });
  const rejectM = useMutation({
    mutationFn: (id: string) => approveBrand(id, "rejected"),
    onSuccess: () => {
      invalidate();
      toast.success("Brand rejected");
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const onApprove = (item: any) =>
    Alert.alert("Approve brand", item.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => approveM.mutate(item.id) },
    ]);
  const onReject = (item: any) =>
    Alert.alert("Reject brand", item.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => rejectM.mutate(item.id) },
    ]);

  const header = (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>BRAND MODERATION</Text>
          </View>
          <Text style={styles.title}>Directory</Text>
          <Text style={styles.subtitle}>
            Create the brands sellers attach to products, and curate what shoppers see.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(admin)/brands/new" as any)}
          style={({ pressed }) => [styles.roundBtn, styles.roundBtnInk, pressed && styles.pressed]}
          accessibilityLabel="New brand"
        >
          <Ionicons name="add" size={19} color={LIME} />
        </Pressable>
        <Pressable
          onPress={() => {
            q.refetch();
            statsQuery.refetch();
          }}
          style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
          accessibilityLabel="Refresh brands"
        >
          <Ionicons name="refresh-outline" size={17} color={INK} />
        </Pressable>
      </View>

      {/* KPI bento */}
      <View style={styles.kpiGrid}>
        <Kpi
          index="01"
          icon="pricetags-outline"
          label="LABELS"
          value={counts?.total}
          sub="registered ateliers"
          loading={statsQuery.isLoading && !counts}
        />
        <Kpi
          index="02"
          icon="checkmark-circle-outline"
          label="APPROVED"
          value={counts?.approved}
          sub="live on storefront"
          loading={statsQuery.isLoading && !counts}
        />
        <Kpi
          index="03"
          icon="time-outline"
          label="TO REVIEW"
          value={counts?.pending}
          sub="awaiting moderation"
          alert={!!counts?.pending}
          loading={statsQuery.isLoading && !counts}
          onPress={() => setStatus("pending")}
        />
        <Kpi
          index="04"
          icon="close-circle-outline"
          label="REJECTED"
          value={counts?.rejected}
          sub="declined labels"
          loading={statsQuery.isLoading && !counts}
        />
      </View>

      <SearchBar value={search} onChange={setSearch} placeholder="Search brands…" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {STATUS_TABS.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            dot={STATUS_DOT[t.id]}
            count={chipCount(t.id)}
            active={status === t.id}
            onPress={() => setStatus(t.id)}
          />
        ))}
      </ScrollView>

      {!q.isLoading ? (
        <View style={styles.countRow}>
          <Text style={styles.resultCount}>
            {brands.length} {brands.length === 1 ? "LABEL" : "LABELS"}
            {isFiltered ? " MATCHING" : ""}
          </Text>
          {isFiltered ? (
            <Pressable onPress={resetFilters} hitSlop={8}>
              <Text style={styles.clearText}>CLEAR</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={brands}
        keyExtractor={(b: any) => b.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => {
              q.refetch();
              statsQuery.refetch();
            }}
            tintColor={colors.olive[800]}
            colors={[colors.olive[800]]}
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <Skeleton width={76} height={76} style={{ borderRadius: 20 }} />
                  <View style={{ flex: 1, justifyContent: "center", gap: 8 }}>
                    <Skeleton width="45%" height={10} />
                    <Skeleton width="80%" height={16} />
                    <Skeleton width="60%" height={11} />
                  </View>
                </View>
              ))}
            </View>
          ) : loadError ? (
            <Empty
              icon="cloud-offline-outline"
              title="Couldn't load brands"
              body={loadError}
              actionLabel="Retry"
              onReset={() => q.refetch()}
            />
          ) : (
            <Empty
              icon="pricetag-outline"
              title="No brands found"
              body="No labels match your search or status filter."
              onReset={isFiltered ? resetFilters : undefined}
            />
          )
        }
        renderItem={({ item, index }: any) => {
          const pending = item.status === "pending";
          const busy =
            (approveM.isPending && approveM.variables === item.id) ||
            (rejectM.isPending && rejectM.variables === item.id);
          return (
            <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 40)}>
              <BrandCard
                brand={item}
                pending={pending}
                busy={busy}
                onPress={() =>
                  router.push({ pathname: "/(admin)/brands/[id]", params: { id: item.id } } as any)
                }
                onApprove={() => onApprove(item)}
                onReject={() => onReject(item)}
              />
            </Animated.View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

function Kpi({
  index,
  icon,
  label,
  value,
  sub,
  alert,
  loading,
  onPress,
}: {
  index: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: number;
  sub: string;
  alert?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.kpi, alert && styles.kpiAlert, pressed && styles.pressed]}
    >
      <View style={styles.kpiTop}>
        <Text style={styles.kpiIndex}>{index}</Text>
        <View style={[styles.kpiIcon, alert && styles.kpiIconAlert]}>
          <Ionicons name={icon} size={14} color={alert ? "#b7791f" : colors.olive[700]} />
        </View>
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{loading || value === undefined ? "—" : value.toLocaleString()}</Text>
      <Text style={styles.kpiSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

function MetaItem({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={11} color="rgba(22,23,15,0.4)" />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function BrandCard({
  brand: item,
  pending,
  busy,
  onPress,
  onApprove,
  onReject,
}: {
  brand: any;
  pending: boolean;
  busy: boolean;
  onPress: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const logo = item.logo_url ? resolveImageUrl(item.logo_url) || item.logo_url : null;
  return (
    <View style={[styles.brandCard, pending && styles.brandCardPending]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.brandMain, pressed && { opacity: 0.9 }]}>
        <View style={styles.logo}>
          {logo ? (
            <Image
              source={{ uri: logo }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Text style={styles.logoInitials}>{initialsOf(item.name)}</Text>
          )}
          {item.is_verified ? (
            <View style={styles.logoBadge}>
              <Ionicons name="checkmark" size={9} color={INK} />
            </View>
          ) : null}
        </View>

        <View style={styles.brandInfo}>
          <View style={styles.brandTop}>
            <Text style={styles.brandLabel} numberOfLines={1}>
              @{(item.slug ?? "").toUpperCase()}
            </Text>
            <StatusPill status={item.status} />
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.brandName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.is_featured ? (
              <Ionicons name="star" size={12} color={colors.accent2.ochre} />
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <MetaItem icon="people-outline" text={`${(item.total_followers ?? 0).toLocaleString()} followers`} />
            <MetaItem icon="cube-outline" text={`${item.total_products ?? 0} products`} />
            {item.created_at ? (
              <MetaItem icon="calendar-outline" text={`joined ${rel(item.created_at)} ago`} />
            ) : null}
          </View>
        </View>
      </Pressable>

      {pending ? (
        <View style={styles.actions}>
          <View style={styles.modHint}>
            <View style={styles.modHintDot} />
            <Text style={styles.modHintText}>AWAITING REVIEW</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            disabled={busy}
            onPress={onReject}
            style={({ pressed }) => [styles.rejectBtn, (pressed || busy) && styles.pressed]}
            accessibilityLabel="Reject brand"
          >
            <Ionicons name="close" size={15} color="#b03a3a" />
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onApprove}
            style={({ pressed }) => [styles.approveBtn, (pressed || busy) && styles.pressed]}
          >
            <Ionicons name="checkmark" size={13} color={LIME} />
            <Text style={styles.approveText}>Approve</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>Open label</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.ink.mute} />
        </View>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingHorizontal: 18, paddingBottom: 120 },
  pressed: kit.pressed,

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 18,
    marginBottom: 18,
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.olive[700],
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.6,
    color: INK,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink.mute,
    maxWidth: 300,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: HAIRLINE,
    ...shadows.soft,
  },

  roundBtnInk: { backgroundColor: INK, borderColor: INK },

  /* KPIs */
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  kpi: { ...card, width: "48.5%", flexGrow: 1, flexBasis: "45%", borderRadius: 22, padding: 14 },
  kpiAlert: { borderColor: "rgba(224,165,38,0.45)" },
  kpiTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kpiIndex: { fontFamily: fontFamilies.mono.regular, fontSize: 9.5, letterSpacing: 2, color: "rgba(22,23,15,0.35)" },
  kpiIcon: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.olive[50], borderWidth: 1, borderColor: "rgba(22,23,15,0.04)",
  },
  kpiIconAlert: { backgroundColor: "#fdf3dc" },
  kpiLabel: { marginTop: 12, fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.8, color: "rgba(22,23,15,0.5)" },
  kpiValue: { marginTop: 4, fontFamily: fontFamilies.display.regular, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: INK },
  kpiSub: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },

  /* Chips + count */
  chips: { gap: 7, paddingBottom: 14 },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: "rgba(22,23,15,0.4)",
    marginBottom: 10,
  },
  clearText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: colors.accent2.rust,
    marginBottom: 10,
  },

  /* Brand card */
  brandCard: { ...card, borderRadius: 24, padding: 10, marginBottom: 12 },
  brandCardPending: { borderColor: "rgba(224,165,38,0.45)" },
  brandMain: { flexDirection: "row", gap: 13 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    overflow: "visible",
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInitials: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 24,
    color: LIME,
  },
  logoBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fbfaf6",
  },
  brandInfo: { flex: 1, minWidth: 0, paddingTop: 2, paddingRight: 2 },
  brandTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  brandLabel: {
    flex: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: colors.olive[700],
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  brandName: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: -0.4,
    color: INK,
    flexShrink: 1,
  },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 7 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: "rgba(22,23,15,0.5)" },

  /* Action footer (mirrors product card actions) */
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 9,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  modHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  modHintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e0a526" },
  modHintText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#8a6116",
  },
  rejectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fdeeee",
  },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: INK,
  },
  approveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.paper.cream,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 9,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  cardFooterText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: "rgba(22,23,15,0.7)",
  },

  /* Loading */
  skeletonCard: { ...card, flexDirection: "row", gap: 13, padding: 10, borderRadius: 24 },
});
