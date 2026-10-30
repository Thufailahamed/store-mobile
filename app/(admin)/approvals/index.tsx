import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminPendingApprovals,
  approveStore,
  approveBrand,
  approveProduct,
  getAdminAuditLog,
  getAdminStats,
  getAdminProducts,
  type AuditEntry,
} from "@/lib/api";
import type { Product } from "@/lib/types";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Skeleton, ConfirmDialog, useToast } from "@/components/ui";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, resolveImageUrl } from "@/lib/utils";
import { INK, LIME, HAIRLINE, cardSurface, Chip, SearchBar, Empty, SectionCount, kit } from "@/components/admin/catalog-kit";

function formatRelative(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function auditActionColor(action: string) {
  const a = action.toLowerCase();
  if (a.includes("approve") || a.includes("active") || a.includes("create")) return "#47573e";
  if (a.includes("reject") || a.includes("delete") || a.includes("suspend")) return "#923b28";
  if (a.includes("update") || a.includes("edit")) return "#8c6b23";
  return "#5c5b52";
}

function humanize(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type ModeTab = "queue" | "history" | "guidelines";

export default function ApprovalsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<ModeTab>("queue");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected">("all");

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconTone: "olive" | "destructive";
    confirmText: string;
    destructive: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    description: "",
    icon: "shield-checkmark-outline",
    iconTone: "olive",
    confirmText: "Approve",
    destructive: false,
    onConfirm: () => {},
  });

  const q = useQuery({
    queryKey: ["admin-approvals"],
    queryFn: async () => {
      const r = await getAdminPendingApprovals(50);
      return r.ok ? r.data : { stores: [], brands: [], products: [] };
    },
    refetchInterval: 30_000,
  });

  const statsQ = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const r = await getAdminStats();
      return r.ok ? r.data : null;
    },
    refetchInterval: 30_000,
  });

  const auditQ = useQuery({
    queryKey: ["admin-approvals-audit"],
    queryFn: async () => {
      const r = await getAdminAuditLog(30);
      return r.ok ? r.data : [];
    },
    refetchInterval: 30_000,
  });

  // The pending-approvals payload is name-only; pull image/price/store for
  // pending products so queue cards can show what's actually being reviewed.
  const pendingProductsQ = useQuery({
    queryKey: ["admin-approvals-products"],
    queryFn: async () => {
      const r = await getAdminProducts({ status: "pending", limit: 100 });
      return r.ok ? r.data.products : [];
    },
    refetchInterval: 30_000,
  });
  const productDetail = useMemo(
    () => new Map((pendingProductsQ.data ?? []).map((p) => [p.id, p] as const)),
    [pendingProductsQ.data],
  );

  const storesCount = q.data?.stores?.length ?? 0;
  const brandsCount = q.data?.brands?.length ?? 0;
  const productsCount = q.data?.products?.length ?? 0;
  const totalCount = storesCount + brandsCount + productsCount;

  const filters = [
    { key: "all", label: "All", count: totalCount },
    { key: "store", label: "Stores", count: storesCount },
    { key: "brand", label: "Brands", count: brandsCount },
    { key: "product", label: "Products", count: productsCount },
  ];

  const rows = useMemo(() => {
    const all = [
      ...(q.data?.stores ?? []).map((r) => ({
        ...r,
        kind: "store" as const,
        kindLabel: "Store",
        icon: "storefront-outline" as const,
        route: `/(admin)/stores/${r.id}`,
      })),
      ...(q.data?.brands ?? []).map((r) => ({
        ...r,
        kind: "brand" as const,
        kindLabel: "Brand",
        icon: "pricetag-outline" as const,
        route: `/(admin)/brands/${r.id}`,
      })),
      ...(q.data?.products ?? []).map((r) => ({
        ...r,
        kind: "product" as const,
        kindLabel: "Product",
        icon: "cube-outline" as const,
        route: `/(admin)/products/${r.id}`,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return all.filter((r) => {
      if (filter !== "all" && r.kind !== filter) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [q.data, filter, search]);

  const auditEntries = useMemo(() => {
    const entries = auditQ.data ?? [];
    return entries.filter((e) => {
      const a = e.action.toLowerCase();
      if (historyFilter === "approved" && !a.includes("approve") && !a.includes("active")) return false;
      if (historyFilter === "rejected" && !a.includes("reject") && !a.includes("suspend")) return false;
      if (search && !e.action.toLowerCase().includes(search.toLowerCase()) && !(e.actor_name ?? "").toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [auditQ.data, historyFilter, search]);

  const approveStoreM = useMutation({
    mutationFn: (id: string) => approveStore(id, "approved"),
    onSuccess: (res) => {
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Store approved successfully", "success");
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-products"] });
    },
  });

  const rejectStoreM = useMutation({
    mutationFn: (id: string) => approveStore(id, "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Store application rejected", "info");
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-products"] });
    },
  });

  const approveBrandM = useMutation({
    mutationFn: (id: string) => approveBrand(id, "approved"),
    onSuccess: (res) => {
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Brand verified and approved", "success");
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-products"] });
    },
  });

  const rejectBrandM = useMutation({
    mutationFn: (id: string) => approveBrand(id, "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Brand application rejected", "info");
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-products"] });
    },
  });

  const approveProductM = useMutation({
    mutationFn: (id: string) => approveProduct(id, "active"),
    onSuccess: (res) => {
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Product activated in catalog", "success");
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-products"] });
    },
  });

  const rejectProductM = useMutation({
    mutationFn: (id: string) => approveProduct(id, "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Product submission rejected", "info");
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-approvals-products"] });
    },
  });

  const handle = (row: any, action: "approve" | "reject") => {
    const fn =
      row.kind === "store"
        ? (action === "approve" ? approveStoreM : rejectStoreM).mutate
        : row.kind === "brand"
        ? (action === "approve" ? approveBrandM : rejectBrandM).mutate
        : (action === "approve" ? approveProductM : rejectProductM).mutate;

    setConfirmModal({
      visible: true,
      title: `${action === "approve" ? "Approve" : "Reject"} ${row.kindLabel}`,
      description: `Are you sure you want to ${action} “${row.name}”? This will immediately update the live marketplace status.`,
      icon: action === "approve" ? "checkmark-circle-outline" : "alert-circle-outline",
      iconTone: action === "approve" ? "olive" : "destructive",
      confirmText: action === "approve" ? "Approve" : "Reject",
      destructive: action === "reject",
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        fn(row.id);
      },
    });
  };

  const refreshAll = () => {
    q.refetch();
    statsQ.refetch();
    auditQ.refetch();
    pendingProductsQ.refetch();
  };

  const isRefreshing = q.isFetching || statsQ.isFetching || auditQ.isFetching;

  const oldestPending = useMemo(() => {
    const all = [...(q.data?.stores ?? []), ...(q.data?.brands ?? []), ...(q.data?.products ?? [])];
    if (all.length === 0) return null;
    return all.reduce((min, r) => (new Date(r.created_at) < new Date(min.created_at) ? r : min)).created_at;
  }, [q.data]);
  const overdueCount = useMemo(() => {
    const all = [...(q.data?.stores ?? []), ...(q.data?.brands ?? []), ...(q.data?.products ?? [])];
    return all.filter((r) => hoursSince(r.created_at) >= SLA_HOURS).length;
  }, [q.data]);

  const modes: { key: ModeTab; label: string; icon: keyof typeof Ionicons.glyphMap; count?: number }[] = [
    { key: "queue", label: "Queue", icon: "file-tray-full-outline", count: totalCount },
    { key: "history", label: "Audit Log", icon: "time-outline" },
    { key: "guidelines", label: "Standards", icon: "document-text-outline" },
  ];


  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} tintColor={colors.olive[800]} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Masthead ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>MODERATION & GOVERNANCE</Text>
            </View>
            <Text style={styles.title}>Approvals</Text>
            <Text style={styles.subtitle}>Every store, label and listing passes through here before shoppers see it.</Text>
          </View>
          <Pressable
            onPress={refreshAll}
            style={({ pressed }) => [styles.roundBtn, pressed && kit.pressed]}
            accessibilityLabel="Refresh queue"
          >
            <Ionicons name="refresh-outline" size={18} color={INK} />
          </Pressable>
        </View>

        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.heroShell}>
          <LinearGradient colors={["#2a2c1f", "#14150f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="apGlow" cx="95%" cy="0%" r="70%">
                    <Stop offset="0" stopColor={LIME} stopOpacity="0.22" />
                    <Stop offset="1" stopColor={LIME} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#apGlow)" />
                {[70, 115, 160, 205].map((r) => (
                  <Circle key={r} cx="100%" cy="0" r={r} stroke="rgba(200,224,138,0.07)" strokeWidth={1} fill="none" />
                ))}
              </Svg>
            </View>

            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>AWAITING REVIEW</Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{q.isLoading ? "—" : totalCount}</Text>
                  <Text style={styles.heroValueUnit}>{totalCount === 1 ? "submission" : "submissions"}</Text>
                </View>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {oldestPending ? `Oldest waiting ${formatRelative(oldestPending).toLowerCase()}` : "Queue fully settled"}
                </Text>
              </View>
              <View style={[styles.heroMedal, overdueCount > 0 && styles.heroMedalAlert]}>
                <Ionicons
                  name={totalCount > 0 ? "hourglass-outline" : "shield-checkmark"}
                  size={22}
                  color={overdueCount > 0 ? "#f3b9a4" : LIME}
                />
                {overdueCount > 0 ? (
                  <View style={styles.heroMedalBadge}>
                    <Text style={styles.heroMedalBadgeText}>{overdueCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Mix bar */}
            {totalCount > 0 && (
              <View style={styles.mixBar}>
                {[
                  [storesCount, KIND.store.bar],
                  [brandsCount, KIND.brand.bar],
                  [productsCount, KIND.product.bar],
                ].map(([n, c], i) =>
                  (n as number) > 0 ? <View key={i} style={{ flex: n as number, backgroundColor: c as string }} /> : null,
                )}
              </View>
            )}

            <View style={styles.heroStats}>
              <HeroStat kind="store" label="STORES" value={storesCount} active={filter === "store"} onPress={() => { setMode("queue"); setFilter(filter === "store" ? "all" : "store"); }} />
              <HeroStat kind="brand" label="BRANDS" value={brandsCount} active={filter === "brand"} onPress={() => { setMode("queue"); setFilter(filter === "brand" ? "all" : "brand"); }} />
              <HeroStat kind="product" label="PRODUCTS" value={productsCount} active={filter === "product"} onPress={() => { setMode("queue"); setFilter(filter === "product" ? "all" : "product"); }} />
            </View>

            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Ionicons name="flash" size={11} color={LIME} />
                <Text style={styles.heroChipText}>SLA &lt; 24H</Text>
              </View>
              <View style={styles.heroChip}>
                <Ionicons name="shield-checkmark" size={11} color={LIME} />
                <Text style={styles.heroChipText}>KYC ACTIVE</Text>
              </View>
              {overdueCount > 0 ? (
                <View style={[styles.heroChip, styles.heroChipAlert]}>
                  <Ionicons name="alert-circle" size={11} color="#f3b9a4" />
                  <Text style={[styles.heroChipText, { color: "#f3b9a4" }]}>{overdueCount} OVERDUE</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.body}>
          {/* ── Mode switch ── */}
          <View style={styles.segment}>
            {modes.map((m) => {
              const on = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  style={[styles.segmentItem, on && styles.segmentItemOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <View style={styles.segmentIconRow}>
                    <Ionicons name={m.icon} size={16} color={on ? LIME : colors.ink.mute} />
                    {m.count ? (
                      <View style={[styles.segmentCount, on && styles.segmentCountOn]}>
                        <Text style={[styles.segmentCountText, on && { color: INK }]}>{m.count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === "queue" ? (
            totalCount > 0 || q.isLoading ? (
              <>
                <SearchBar value={search} onChange={setSearch} placeholder="Search by name, brand, or store…" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {filters.map((f) => (
                    <Chip
                      key={f.key}
                      label={f.label}
                      count={f.count}
                      dot={f.key !== "all" ? KIND[f.key as Kind].bar : undefined}
                      active={filter === f.key}
                      onPress={() => setFilter(f.key)}
                    />
                  ))}
                </ScrollView>

                {q.isLoading ? (
                  <View style={{ gap: 12 }}>
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} width="100%" height={168} style={{ borderRadius: 24 }} />
                    ))}
                  </View>
                ) : rows.length === 0 ? (
                  <Empty
                    icon="search-outline"
                    title="No matches"
                    body={search ? `Nothing pending matches “${search}”.` : "Nothing pending in this category."}
                    onReset={search || filter !== "all" ? () => { setSearch(""); setFilter("all"); } : undefined}
                  />
                ) : (
                  <>
                    <SectionCount>
                      {rows.length} PENDING · OLDEST FIRST
                    </SectionCount>
                    {[...rows]
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((row, i) => (
                        <QueueCard
                          key={`${row.kind}-${row.id}`}
                          row={row}
                          index={i}
                          detail={row.kind === "product" ? productDetail.get(row.id) : undefined}
                          onInspect={() => router.push(row.route as any)}
                          onApprove={() => handle(row, "approve")}
                          onReject={() => handle(row, "reject")}
                        />
                      ))}
                  </>
                )}
              </>
            ) : (
              /* Zero-inbox */
              <>
                <View style={[styles.card, styles.zeroCard]}>
                  <View style={styles.zeroTop}>
                    <View style={styles.livePill}>
                      <View style={styles.liveDot} />
                      <Text style={styles.livePillText}>QUEUE CLEAR</Text>
                    </View>
                    <Pressable onPress={refreshAll} style={({ pressed }) => [styles.syncBtn, pressed && kit.pressed]}>
                      <Ionicons name="sync-outline" size={13} color={INK} />
                      <Text style={styles.syncText}>Sync</Text>
                    </Pressable>
                  </View>
                  <View style={styles.medal}>
                    <Ionicons name="shield-checkmark" size={28} color={LIME} />
                  </View>
                  <Text style={styles.zeroTitle}>
                    All <Text style={styles.zeroTitleItalic}>settled</Text>
                  </Text>
                  <Text style={styles.zeroSub}>
                    Every seller application, brand certification and catalogue submission has been reviewed.
                  </Text>
                  <View style={styles.zeroStats}>
                    <ZeroStat
                      value={statsQ.data?.totalStores ? statsQ.data.totalStores - (statsQ.data.pendingStores ?? 0) : 0}
                      label="LIVE STORES"
                    />
                    <View style={styles.zeroDivider} />
                    <ZeroStat value={statsQ.data?.totalStores ?? 0} label="ALL STORES" />
                    <View style={styles.zeroDivider} />
                    <ZeroStat value={statsQ.data?.totalProducts ?? 0} label="SKUS" />
                  </View>
                </View>

                <View style={[styles.card, styles.sectionCard]}>
                  <SectionHead index="01" eyebrow="COMPLIANCE LOG" title="Recent decisions" linkLabel="All" onLink={() => setMode("history")} />
                  {(auditQ.data ?? []).length === 0 ? (
                    <Empty icon="time-outline" title="No decisions yet" body="Moderation actions will appear here." />
                  ) : (
                    <Timeline entries={(auditQ.data ?? []).slice(0, 5)} />
                  )}
                </View>

                <SectionHead index="02" eyebrow="DIRECTORIES" title="Approved assets" />
                <View style={styles.tileGrid}>
                  <Tile icon="storefront-outline" title="Stores" sub="Approved boutiques" onPress={() => router.push("/(admin)/products" as any)} />
                  <Tile icon="cube-outline" title="Catalogue" sub="Live listings" onPress={() => router.push("/(admin)/catalogue" as any)} />
                  <Tile icon="wallet-outline" title="Commissions" sub="Seller tiers" onPress={() => router.push("/(admin)/commissions" as any)} />
                  <Tile icon="document-text-outline" title="Standards" sub="Vetting rules" onPress={() => setMode("guidelines")} />
                </View>
              </>
            )
          ) : mode === "history" ? (
            <>
              <SearchBar value={search} onChange={setSearch} placeholder="Search by action or admin…" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="All actions" active={historyFilter === "all"} onPress={() => setHistoryFilter("all")} />
                <Chip label="Approvals" dot="#22a35a" active={historyFilter === "approved"} onPress={() => setHistoryFilter("approved")} />
                <Chip label="Rejections" dot="#e05252" active={historyFilter === "rejected"} onPress={() => setHistoryFilter("rejected")} />
              </ScrollView>
              {auditEntries.length === 0 ? (
                <Empty icon="time-outline" title="No matching events" body="No recorded decisions match your filters." />
              ) : (
                <>
                  <SectionCount>{auditEntries.length} EVENTS</SectionCount>
                  <View style={[styles.card, styles.sectionCard]}>
                    <Timeline entries={auditEntries} detailed />
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              <GuidelineCard
                index="01"
                icon="storefront-outline"
                title="Store criteria"
                sub="Mandatory standards for merchant activation"
                bullets={[
                  "Registered business entity or verified artisan credentials.",
                  "High-resolution editorial hero banners and a clear logo asset.",
                  "Return and fulfilment policy adherence (< 48h dispatch).",
                ]}
              />
              <GuidelineCard
                index="02"
                icon="cube-outline"
                title="Listing quality"
                sub="Product curation rules"
                bullets={[
                  "Minimum 3 high-resolution studio photos on clean backgrounds.",
                  "Accurate material, sizing and origin disclosure.",
                  "Pricing within verified retail market ranges.",
                ]}
              />
              <GuidelineCard
                index="03"
                icon="timer-outline"
                title="Service level"
                sub="Turnaround and rejection process"
                bullets={[
                  "Review target: 24 hours from submission.",
                  "Every rejection gives a specific, actionable reason.",
                ]}
              />
            </>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmModal.visible}
        title={confirmModal.title}
        description={confirmModal.description}
        icon={confirmModal.icon}
        iconTone={confirmModal.iconTone}
        confirmText={confirmModal.confirmText}
        destructive={confirmModal.destructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

const SLA_HOURS = 24;

type Kind = "store" | "brand" | "product";
const KIND: Record<Kind, { bar: string; tint: string; fg: string }> = {
  store: { bar: "#a8b06b", tint: "#eef0dc", fg: colors.olive[700] },
  brand: { bar: "#e0b040", tint: "#fbf1d6", fg: "#8a6116" },
  product: { bar: "#d27a5a", tint: "#f9e6dd", fg: "#a14a2c" },
};

function hoursSince(s: string) {
  return (Date.now() - new Date(s).getTime()) / 3_600_000;
}

function rowImage(row: any, detail?: Product): string | undefined {
  const fromDetail = detail?.images?.find((i) => i.is_primary)?.url ?? detail?.images?.[0]?.url;
  const img = row?.images?.[0];
  const candidates = [fromDetail, typeof img === "string" ? img : img?.url, row?.image_url, row?.thumbnail, row?.logo_url, row?.logo];
  const hit = candidates.find((c) => typeof c === "string" && c.length > 0);
  return hit ? resolveImageUrl(hit) || hit : undefined;
}

function rowLabel(row: any, detail?: Product): string {
  if (row.kind === "product") {
    return detail?.store?.name ?? row.store?.name ?? row.store_name ?? detail?.brand?.name ?? row.brand?.name ?? "Product";
  }
  return row.owner?.full_name ?? row.owner_name ?? row.email ?? (row.slug ? `@${row.slug}` : row.kind === "store" ? "Store" : "Brand");
}

function HeroStat({ kind, label, value, active, onPress }: { kind: Kind; label: string; value: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroStat, active && styles.heroStatActive, pressed && kit.pressed]}>
      <View style={styles.heroStatTop}>
        <View style={[styles.heroStatDot, { backgroundColor: KIND[kind].bar }]} />
        <Text style={styles.heroStatLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.heroStatValue, value === 0 && { color: "rgba(244,242,234,0.35)" }]}>{value}</Text>
    </Pressable>
  );
}

function QueueCard({
  row,
  index,
  detail,
  onInspect,
  onApprove,
  onReject,
}: {
  row: any;
  index: number;
  detail?: Product;
  onInspect: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const kind = row.kind as Kind;
  const img = rowImage(row, detail);
  const label = rowLabel(row, detail);
  const hours = hoursSince(row.created_at);
  const overdue = hours >= SLA_HOURS;
  const slaPct = Math.min(100, (hours / SLA_HOURS) * 100);
  const slaTone = overdue ? "#c4472f" : hours >= SLA_HOURS / 2 ? "#d39a1c" : "#22a35a";
  const slaLabel = overdue ? `OVERDUE · ${Math.floor(hours - SLA_HOURS) + 1}H` : `${Math.max(1, Math.ceil(SLA_HOURS - hours))}H LEFT`;
  const price = detail?.price ?? row.price;
  const mrp = detail?.mrp ?? row.mrp;
  const discount = mrp && price && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 50)}>
      <View style={[styles.card, styles.queueCard, overdue && styles.queueCardOverdue]}>
        <Pressable onPress={onInspect} style={({ pressed }) => [styles.queueRow, pressed && { opacity: 0.85 }]}>
          <View style={[styles.thumb, kind !== "product" && styles.thumbSquare, { backgroundColor: KIND[kind].tint }]}>
            {img ? (
              <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : kind === "product" ? (
              <Ionicons name="cube-outline" size={24} color={KIND[kind].fg} />
            ) : (
              <Text style={[styles.thumbInitials, { color: KIND[kind].fg }]}>{initialsOf(row.name)}</Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.queueTop}>
              <View style={[styles.kindTag, { backgroundColor: KIND[kind].tint }]}>
                <View style={[styles.kindDot, { backgroundColor: KIND[kind].bar }]} />
                <Text style={[styles.kindTagText, { color: KIND[kind].fg }]}>{row.kindLabel.toUpperCase()}</Text>
              </View>
              <Text style={styles.queueTime}>{formatRelative(row.created_at)}</Text>
            </View>
            <Text style={styles.queueName} numberOfLines={2}>{row.name}</Text>
            <Text style={styles.queueLabel} numberOfLines={1}>{label.toUpperCase()}</Text>
            {typeof price === "number" && (
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatPrice(price)}</Text>
                {discount > 0 && (
                  <>
                    <Text style={styles.mrp}>{formatPrice(mrp)}</Text>
                    <Text style={styles.discount}>−{discount}%</Text>
                  </>
                )}
              </View>
            )}
          </View>
          <Ionicons name="arrow-forward" size={14} color="rgba(22,23,15,0.35)" style={{ alignSelf: "center" }} />
        </Pressable>

        {/* SLA meter */}
        <View style={styles.slaRow}>
          <Ionicons name="time-outline" size={11} color={slaTone} />
          <View style={styles.slaTrack}>
            <View style={[styles.slaFill, { width: `${slaPct}%`, backgroundColor: slaTone }]} />
          </View>
          <Text style={[styles.slaLabel, { color: slaTone }]}>{slaLabel}</Text>
        </View>

        {/* Decision bar */}
        <View style={[styles.decision, overdue && styles.decisionOverdue]}>
          <Pressable onPress={onReject} style={({ pressed }) => [styles.rejectBtn, pressed && kit.pressed]} accessibilityLabel="Reject">
            <Ionicons name="close" size={15} color="#b03a3a" />
            <Text style={styles.rejectText}>Reject</Text>
          </Pressable>
          <Pressable onPress={onApprove} style={({ pressed }) => [styles.approveBtn, pressed && kit.pressed]}>
            <Ionicons name="checkmark" size={15} color={LIME} />
            <Text style={styles.approveText}>Approve {row.kindLabel.toLowerCase()}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function SectionHead({
  index,
  eyebrow,
  title,
  linkLabel,
  onLink,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  linkLabel?: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <View style={styles.sectionEyebrowRow}>
          {index ? <Text style={styles.sectionIndex}>{index}</Text> : null}
          {index ? <View style={styles.sectionRule} /> : null}
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {linkLabel && onLink ? (
        <Pressable onPress={onLink} hitSlop={10} style={({ pressed }) => [styles.linkPill, pressed && kit.pressed]}>
          <Text style={styles.linkPillText}>{linkLabel}</Text>
          <Ionicons name="arrow-forward" size={12} color={INK} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Timeline({ entries, detailed }: { entries: AuditEntry[]; detailed?: boolean }) {
  return (
    <View>
      {entries.map((e, i) => {
        const tone = auditActionColor(e.action);
        return (
          <View key={e.id} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlDotOuter, { borderColor: tone + "40" }]}>
                <View style={[styles.tlDot, { backgroundColor: tone }]} />
              </View>
              {i < entries.length - 1 ? <View style={styles.tlLine} /> : null}
            </View>
            <View style={styles.tlBody}>
              <View style={styles.tlHead}>
                <Text style={[styles.tlAction, detailed && { color: tone }]} numberOfLines={1}>
                  {humanize(e.action)}
                </Text>
                <Text style={styles.tlTime}>{formatRelative(e.created_at)}</Text>
              </View>
              <Text style={styles.tlActor} numberOfLines={1}>
                by <Text style={styles.tlActorBold}>{e.actor_name ?? "Administrator"}</Text>
              </Text>
              {detailed && e.target_type ? (
                <View style={styles.tlTarget}>
                  <Text style={styles.tlTargetText}>
                    {e.target_type.toUpperCase()}
                    {e.target_id ? ` · #${e.target_id.slice(0, 8)}` : ""}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ZeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.zeroStatValue}>{value.toLocaleString()}</Text>
      <Text style={styles.zeroStatLabel}>{label}</Text>
    </View>
  );
}

function Tile({ icon, title, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, styles.tile, pressed && kit.pressedCard]}>
      <View style={styles.tileTop}>
        <View style={styles.tileIcon}>
          <Ionicons name={icon} size={17} color={colors.olive[700]} />
        </View>
        <Ionicons name="arrow-forward" size={14} color="rgba(22,23,15,0.35)" style={{ transform: [{ rotate: "-45deg" }] }} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

function GuidelineCard({
  index,
  icon,
  title,
  sub,
  bullets,
}: {
  index: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  bullets: string[];
}) {
  return (
    <View style={[styles.card, styles.guideCard]}>
      <View style={styles.guideHead}>
        <View style={styles.guideIcon}>
          <Ionicons name={icon} size={18} color={LIME} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.guideIndex}>STANDARD {index}</Text>
          <Text style={styles.guideTitle}>{title}</Text>
          <Text style={styles.guideSub}>{sub}</Text>
        </View>
      </View>
      <View style={styles.guideList}>
        {bullets.map((b, i) => (
          <View key={i} style={styles.guideBullet}>
            <View style={styles.guideCheck}>
              <Ionicons name="checkmark" size={11} color={colors.olive[700]} />
            </View>
            <Text style={styles.guideText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const initialsOf = (name?: string | null) =>
  (name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* ───────────────────────── Styles ───────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 140 },
  body: { paddingHorizontal: 18 },
  card: { ...cardSurface, borderRadius: 24, marginBottom: 12, overflow: "hidden" },

  /* Masthead */
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 18, paddingTop: 18, marginBottom: 18 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 2.2, color: colors.olive[700] },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 44, lineHeight: 46, letterSpacing: -1.6, color: INK },
  subtitle: { marginTop: 8, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: colors.ink.mute, maxWidth: 300 },
  roundBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: HAIRLINE, ...shadows.soft,
  },

  /* Hero */
  heroShell: { marginHorizontal: 18, marginBottom: 16, borderRadius: 28, ...shadows.editorial },
  hero: { borderRadius: 28, padding: 20, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroEyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 2, color: "rgba(244,242,234,0.55)" },
  heroValueRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  heroValue: { fontFamily: fontFamilies.display.regular, fontSize: 60, lineHeight: 62, letterSpacing: -2, color: colors.paper.cream },
  heroValueUnit: { fontFamily: fontFamilies.display.italic, fontSize: 20, color: LIME },
  heroSub: { marginTop: 4, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(244,242,234,0.55)" },
  heroMedal: {
    width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(200,224,138,0.08)", borderWidth: 1, borderColor: "rgba(200,224,138,0.25)",
  },
  heroMedalAlert: { backgroundColor: "rgba(243,185,164,0.08)", borderColor: "rgba(243,185,164,0.3)" },
  heroMedalBadge: {
    position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: "#c4472f", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1d1f15",
  },
  heroMedalBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: "#fff" },
  mixBar: { flexDirection: "row", height: 5, gap: 3, borderRadius: 3, overflow: "hidden", marginTop: 18 },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroStat: {
    flex: 1, padding: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  heroStatActive: { borderColor: "rgba(200,224,138,0.55)", backgroundColor: "rgba(200,224,138,0.08)" },
  heroStatTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroStatDot: { width: 6, height: 6, borderRadius: 3 },
  heroStatLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, letterSpacing: 1.5, color: "rgba(244,242,234,0.55)" },
  heroStatValue: { marginTop: 6, fontFamily: fontFamilies.display.regular, fontSize: 30, lineHeight: 32, color: colors.paper.cream },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  heroChip: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  heroChipAlert: { backgroundColor: "rgba(196,71,47,0.2)", borderColor: "rgba(243,185,164,0.3)" },
  heroChipText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.2, color: "rgba(244,242,234,0.8)" },

  /* Segment */
  segment: {
    flexDirection: "row", padding: 4, borderRadius: 24, marginBottom: 14, gap: 2,
    backgroundColor: "rgba(239,236,226,0.8)", borderWidth: 1, borderColor: HAIRLINE,
  },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 56, borderRadius: 20 },
  segmentItemOn: { backgroundColor: INK, ...shadows.soft },
  segmentIconRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  segmentText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: colors.ink.mute },
  segmentTextOn: { color: colors.paper.cream },
  segmentCount: { minWidth: 18, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(22,23,15,0.08)" },
  segmentCountOn: { backgroundColor: LIME },
  segmentCountText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, color: colors.ink.mute },
  chips: { gap: 7, paddingBottom: 14 },

  /* Queue card */
  queueCard: { padding: 0 },
  queueCardOverdue: { borderColor: "rgba(196,71,47,0.3)" },
  queueRow: { flexDirection: "row", gap: 13, padding: 10, paddingRight: 14 },
  thumb: { width: 80, height: 100, borderRadius: 18, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbSquare: { height: 80, borderRadius: 22 },
  thumbInitials: { fontFamily: fontFamilies.display.regular, fontSize: 26 },
  queueTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  kindTag: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  kindDot: { width: 5, height: 5, borderRadius: 3 },
  kindTagText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.2 },
  queueTime: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: "rgba(22,23,15,0.45)" },
  queueName: { marginTop: 6, fontFamily: fontFamilies.display.regular, fontSize: 17, lineHeight: 21, letterSpacing: -0.3, color: INK },
  queueLabel: { marginTop: 4, fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.4, color: colors.olive[700] },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 5 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: INK },
  mrp: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: "rgba(22,23,15,0.4)", textDecorationLine: "line-through" },
  discount: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.accent2.rust },
  slaRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  slaTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(22,23,15,0.06)", overflow: "hidden" },
  slaFill: { height: "100%", borderRadius: 2 },
  slaLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.2 },
  decision: {
    flexDirection: "row", gap: 8, padding: 10, backgroundColor: "rgba(239,236,226,0.55)",
    borderTopWidth: 1, borderTopColor: HAIRLINE,
  },
  decisionOverdue: { backgroundColor: "rgba(250,232,226,0.6)", borderTopColor: "rgba(196,71,47,0.15)" },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 42, borderRadius: 21,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(176,58,58,0.22)",
  },
  rejectText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "#b03a3a" },
  approveBtn: {
    flex: 1.7, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 21, backgroundColor: INK,
  },
  approveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.paper.cream },

  /* Sections */
  sectionCard: { padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 12, marginTop: 4 },
  sectionEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionIndex: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.olive[600] },
  sectionRule: { width: 18, height: 1, backgroundColor: "rgba(22,23,15,0.18)" },
  sectionEyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.8, color: "rgba(22,23,15,0.45)" },
  sectionTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, letterSpacing: -0.4, color: INK },
  linkPill: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: "rgba(22,23,15,0.12)",
  },
  linkPillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: INK },

  /* Timeline */
  tlRow: { flexDirection: "row", gap: 12 },
  tlRail: { width: 18, alignItems: "center" },
  tlDotOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 2 },
  tlDot: { width: 8, height: 8, borderRadius: 4 },
  tlLine: { flex: 1, width: 1, backgroundColor: "rgba(22,23,15,0.08)", marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 16 },
  tlHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  tlAction: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: INK },
  tlTime: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: "rgba(22,23,15,0.4)" },
  tlActor: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  tlActorBold: { fontFamily: fontFamilies.sans.semibold, color: INK },
  tlTarget: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(239,236,226,0.8)" },
  tlTargetText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1, color: colors.ink.mute },

  /* Zero state */
  zeroCard: { padding: 20, alignItems: "center" },
  zeroTop: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "#ecf6ec" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22a35a" },
  livePillText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.4, color: "#2e5a27" },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(22,23,15,0.12)" },
  syncText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: INK },
  medal: {
    width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginTop: 18,
    backgroundColor: INK, borderWidth: 6, borderColor: "rgba(200,224,138,0.18)",
  },
  zeroTitle: { marginTop: 16, fontFamily: fontFamilies.display.regular, fontSize: 30, letterSpacing: -0.8, color: INK },
  zeroTitleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  zeroSub: { marginTop: 6, textAlign: "center", fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: colors.ink.mute, maxWidth: 280 },
  zeroStats: {
    alignSelf: "stretch", flexDirection: "row", marginTop: 18, paddingVertical: 12, borderRadius: 18,
    backgroundColor: "rgba(239,236,226,0.6)", borderWidth: 1, borderColor: "rgba(22,23,15,0.04)",
  },
  zeroDivider: { width: 1, backgroundColor: "rgba(22,23,15,0.07)" },
  zeroStatValue: { fontFamily: fontFamilies.display.regular, fontSize: 24, color: INK },
  zeroStatLabel: { marginTop: 2, fontFamily: fontFamilies.mono.medium, fontSize: 8.5, letterSpacing: 1.4, color: "rgba(22,23,15,0.4)" },

  /* Tiles */
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47%", flexGrow: 1, padding: 14, marginBottom: 0 },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tileIcon: {
    width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.olive[50], borderWidth: 1, borderColor: "rgba(83,94,44,0.12)",
  },
  tileTitle: { marginTop: 14, fontFamily: fontFamilies.display.regular, fontSize: 18, color: INK },
  tileSub: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.ink.mute },

  /* Guidelines */
  guideCard: { padding: 16 },
  guideHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  guideIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: INK },
  guideIndex: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.6, color: colors.olive[600] },
  guideTitle: { marginTop: 2, fontFamily: fontFamilies.display.regular, fontSize: 20, letterSpacing: -0.4, color: INK },
  guideSub: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  guideList: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIRLINE, gap: 10 },
  guideBullet: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  guideCheck: {
    width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[50], marginTop: 1,
  },
  guideText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: INK },
});
