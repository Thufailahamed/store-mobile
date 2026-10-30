import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminStores, approveStore } from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils";
import { AdminMasthead, StatBand, SearchField, ChipRail, premiumCard, GOLD, CREAM, RUST } from "@/components/admin/premium-kit";

const STATUS_TABS = ["all", "pending", "approved", "suspended", "rejected"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_TONE: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  approved: { label: "Approved", dot: "#4f8a2c", text: colors.olive[800], bg: "rgba(83,94,44,0.12)" },
  pending: { label: "Pending", dot: GOLD, text: "#7a5b1a", bg: "rgba(200,164,74,0.18)" },
  suspended: { label: "Suspended", dot: RUST, text: RUST, bg: "rgba(184,92,58,0.1)" },
  rejected: { label: "Rejected", dot: colors.light.destructive, text: colors.light.destructive, bg: "rgba(192,57,43,0.08)" },
};

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  is_suspended?: boolean;
  is_verified?: boolean;
  is_featured?: boolean;
  rating?: number;
  logo_url?: string | null;
  banner_url?: string | null;
  description?: string | null;
  product_count?: number;
  created_at?: string;
  complianceGaps?: string[];
};

const effectiveStatus = (s: StoreRow) => (s.is_suspended ? "suspended" : s.status ?? "pending");
const img = (u?: string | null) => (u ? resolveImageUrl(u) || u : null);

export default function AdminStores() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");

  const storesQuery = useQuery({
    queryKey: ["admin-stores", status, search],
    queryFn: async () => {
      const res = await getAdminStores({ status, search });
      if (!res.ok) throw new Error(res.error);
      return res.data as unknown as { stores: StoreRow[]; total: number };
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ storeId, newStatus }: { storeId: string; newStatus: "approved" | "rejected" }) =>
      approveStore(storeId, newStatus),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Action failed", res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview-stats"] });
    },
  });

  const stores = storesQuery.data?.stores ?? [];
  const total = storesQuery.data?.total ?? 0;
  const products = stores.reduce((n, s) => n + (s.product_count ?? 0), 0);
  const featured = stores.filter((s) => s.is_featured).length;

  const decide = (s: StoreRow, newStatus: "approved" | "rejected") =>
    Alert.alert(
      newStatus === "approved" ? "Approve atelier?" : "Reject atelier?",
      newStatus === "approved"
        ? `“${s.name}” will go live on the marketplace.`
        : `“${s.name}” will be notified that the application was declined.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: newStatus === "approved" ? "Approve" : "Reject",
          style: newStatus === "rejected" ? "destructive" : "default",
          onPress: () => approveMutation.mutate({ storeId: s.id, newStatus }),
        },
      ],
    );

  return (
    <View style={styles.container}>
      <FlatList
        data={storesQuery.isLoading || storesQuery.isError ? [] : stores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={storesQuery.isFetching && !storesQuery.isLoading}
            onRefresh={() => storesQuery.refetch()}
            tintColor={colors.light.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <AdminMasthead
              eyebrow="People"
              title="Atelier"
              italic="Registry"
              subtitle="Every seller storefront on LUXE. Approve newcomers, keep the roster sharp."
            />
            <StatBand
              items={[
                { label: status === "all" ? "Stores" : STATUS_TONE[status]?.label ?? "Stores", value: total, accent: true },
                { label: "Products", value: products },
                { label: "Featured", value: featured },
              ]}
            />
            <SearchField value={search} onChangeText={setSearch} placeholder="Search by name or handle…" />
            <ChipRail<StatusTab>
              value={status}
              onChange={setStatus}
              options={STATUS_TABS.map((t) => ({ value: t, label: t === "all" ? "All" : STATUS_TONE[t].label }))}
            />
          </View>
        }
        ListEmptyComponent={
          storesQuery.isLoading ? (
            <View style={{ paddingHorizontal: 16, gap: 14 }}>
              <Skeleton height={190} style={{ borderRadius: radii["2xl"] }} />
              <Skeleton height={190} style={{ borderRadius: radii["2xl"] }} />
            </View>
          ) : storesQuery.isError ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load stores" description={(storesQuery.error as Error)?.message} />
          ) : (
            <EmptyState
              icon="storefront-outline"
              title={status === "pending" ? "No applications waiting" : "No stores found"}
              description={search ? "Nothing matches that search." : "Try a different filter."}
            />
          )
        }
        renderItem={({ item }) => (
          <StoreCard
            item={item}
            busy={approveMutation.isPending}
            onOpen={() => router.push(`/(admin)/stores/${item.id}` as any)}
            onApprove={() => decide(item, "approved")}
            onReject={() => decide(item, "rejected")}
          />
        )}
      />
    </View>
  );
}

function StoreCard({
  item,
  busy,
  onOpen,
  onApprove,
  onReject,
}: {
  item: StoreRow;
  busy: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const st = effectiveStatus(item);
  const tone = STATUS_TONE[st] ?? STATUS_TONE.pending;
  const banner = img(item.banner_url);
  const logo = img(item.logo_url);
  const gaps = item.complianceGaps?.length ?? 0;
  const pending = st === "pending";

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.banner}>
        {banner ? (
          <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <LinearGradient colors={["#3a4120", "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
            <View style={styles.bannerRing} />
          </LinearGradient>
        )}
        <LinearGradient colors={["rgba(14,15,9,0.25)", "rgba(14,15,9,0)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.bannerTop}>
          {item.is_featured ? (
            <View style={styles.featured}>
              <Ionicons name="star" size={9} color={colors.ink.DEFAULT} />
              <Text style={styles.featuredText}>FEATURED</Text>
            </View>
          ) : <View />}
          <View style={[styles.statusPill, { backgroundColor: tone.bg }, banner && styles.statusPillOnImage]}>
            <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
            <Text style={[styles.statusText, { color: tone.text }]}>{tone.label.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.logoWrap}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" />
        ) : (
          <LinearGradient colors={["#f2f3e2", "#dfe3c2"]} style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoText}>{item.name.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {item.is_verified ? <Ionicons name="checkmark-circle" size={16} color={colors.olive[600]} /> : null}
        </View>
        <Text style={styles.slug} numberOfLines={1}>@{item.slug}</Text>
        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}

        <View style={styles.statsRow}>
          <Stat icon="cube-outline" value={String(item.product_count ?? 0)} label="products" />
          <View style={styles.statDivider} />
          <Stat icon="star-outline" value={(item.rating ?? 0) > 0 ? (item.rating ?? 0).toFixed(1) : "—"} label="rating" />
          {gaps > 0 ? (
            <>
              <View style={styles.statDivider} />
              <View style={styles.gapPill}>
                <Ionicons name="alert-circle-outline" size={11} color={RUST} />
                <Text style={styles.gapText}>{gaps} gap{gaps === 1 ? "" : "s"}</Text>
              </View>
            </>
          ) : null}
          <View style={{ flex: 1 }} />
          {!pending ? <Ionicons name="chevron-forward" size={15} color={colors.light.border} /> : null}
        </View>

        {pending ? (
          <View style={styles.decideRow}>
            <Pressable onPress={onReject} disabled={busy} style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}>
              <Text style={styles.rejectText}>Decline</Text>
            </Pressable>
            <Pressable onPress={onApprove} disabled={busy} style={({ pressed }) => [styles.approveShadow, pressed && styles.pressed]}>
              <LinearGradient colors={["#3a4120", "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.approveBtn}>
                <Ionicons name="checkmark" size={14} color={GOLD} />
                <Text style={styles.approveText}>Approve{gaps === 0 ? " · ready" : ""}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={12} color={colors.light.mutedForeground} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const LOGO = 58;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingBottom: 140, gap: 16 },
  pressed: { opacity: 0.88 },

  card: { ...premiumCard, marginHorizontal: 16, overflow: "hidden" },
  banner: { height: 96, backgroundColor: colors.olive[900] },
  bannerRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -120,
    right: -40,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.18)",
  },
  bannerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  featured: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: GOLD,
  },
  featuredText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, color: colors.ink.DEFAULT, letterSpacing: 1.1 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full },
  statusPillOnImage: { backgroundColor: "rgba(250,248,241,0.92)" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.1 },

  logoWrap: {
    position: "absolute",
    top: 96 - LOGO / 2,
    left: 16,
    padding: 3,
    borderRadius: 18,
    backgroundColor: colors.light.card,
  },
  logo: { width: LOGO, height: LOGO, borderRadius: 15, backgroundColor: colors.olive[100] },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  logoText: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: colors.olive[800] },

  body: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: LOGO / 2 + 12, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontFamily: fontFamilies.display.semibold, fontSize: 21, color: colors.light.foreground, letterSpacing: -0.4, flexShrink: 1 },
  slug: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground },
  desc: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: colors.ink.soft, marginTop: 6 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dddccd",
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { fontFamily: fontFamilies.mono.semibold, fontSize: 12, color: colors.light.foreground },
  statLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.light.mutedForeground },
  statDivider: { width: 1, height: 12, backgroundColor: "#dddccd" },
  gapPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.full, backgroundColor: "rgba(184,92,58,0.1)" },
  gapText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, color: RUST },

  decideRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  rejectBtn: {
    flex: 1,
    height: 42,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(184,92,58,0.45)",
    backgroundColor: "rgba(184,92,58,0.05)",
  },
  rejectText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: RUST },
  approveShadow: { flex: 1.4, borderRadius: radii.full },
  approveBtn: {
    height: 42,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.5)",
  },
  approveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: CREAM },
});
