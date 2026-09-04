import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  StyleSheet,
  TextInput,
} from "react-native";
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
  type AuditEntry,
} from "@/lib/api";
import { Card, Skeleton, ConfirmDialog, useToast } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

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
  };

  const isRefreshing = q.isFetching || statsQ.isFetching || auditQ.isFetching;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} tintColor={colors.light.primary} />}
        showsVerticalScrollIndicator={false}
      >
      {/* ── 1. Header Section ───────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>MODERATION & GOVERNANCE</Text>
          <Text style={styles.title}>
            Approvals <Text style={styles.titleAccent}>Center</Text>
          </Text>
        </View>
        <View style={[styles.countBadge, totalCount > 0 ? styles.countBadgePending : styles.countBadgeNominal]}>
          <View style={[styles.statusDot, totalCount > 0 ? styles.statusDotPending : styles.statusDotNominal]} />
          <Text style={[styles.countText, totalCount > 0 ? styles.countTextPending : styles.countTextNominal]}>
            {totalCount > 0 ? `${totalCount} pending` : "All settled"}
          </Text>
        </View>
      </View>

      {/* Target SLA Indicator */}
      <View style={styles.slaStrip}>
        <View style={styles.slaItem}>
          <Ionicons name="flash-outline" size={13} color={colors.olive[700]} />
          <Text style={styles.slaText}>SLA Target: &lt; 24h Review</Text>
        </View>
        <View style={styles.slaDivider} />
        <View style={styles.slaItem}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.olive[700]} />
          <Text style={styles.slaText}>KYC &amp; Vetting Active</Text>
        </View>
      </View>

      {/* ── 2. Segmented Mode Switcher ──────────────────────────── */}
      <View style={styles.segmentedContainer}>
        <Pressable
          onPress={() => setMode("queue")}
          style={[styles.segmentBtn, mode === "queue" && styles.segmentBtnActive]}
        >
          <Ionicons
            name="file-tray-full-outline"
            size={14}
            color={mode === "queue" ? colors.light.primary : colors.light.mutedForeground}
          />
          <Text style={[styles.segmentText, mode === "queue" && styles.segmentTextActive]}>
            Queue {totalCount > 0 ? `(${totalCount})` : ""}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode("history")}
          style={[styles.segmentBtn, mode === "history" && styles.segmentBtnActive]}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={mode === "history" ? colors.light.primary : colors.light.mutedForeground}
          />
          <Text style={[styles.segmentText, mode === "history" && styles.segmentTextActive]}>
            Audit Log
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode("guidelines")}
          style={[styles.segmentBtn, mode === "guidelines" && styles.segmentBtnActive]}
        >
          <Ionicons
            name="document-text-outline"
            size={14}
            color={mode === "guidelines" ? colors.light.primary : colors.light.mutedForeground}
          />
          <Text style={[styles.segmentText, mode === "guidelines" && styles.segmentTextActive]}>
            Standards
          </Text>
        </Pressable>
      </View>

      {/* ── 3. Mode Content Rendering ───────────────────────────── */}
      {mode === "queue" ? (
        <>
          {totalCount > 0 ? (
            <>
              {/* Search Bar */}
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={colors.light.mutedForeground} style={styles.searchIcon} />
                <TextInput
                  style={styles.search}
                  placeholder="Search by name, brand, or store…"
                  placeholderTextColor={colors.light.mutedForeground}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
                {search ? (
                  <Pressable onPress={() => setSearch("")} hitSlop={10} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color={colors.light.mutedForeground} />
                  </Pressable>
                ) : null}
              </View>

              {/* Filter Chips with live counts */}
              <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                  {filters.map((f) => {
                    const isActive = filter === f.key;
                    return (
                      <Pressable
                        key={f.key}
                        onPress={() => setFilter(f.key)}
                        style={[styles.chip, isActive && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f.label}</Text>
                        <View style={[styles.chipCountBadge, isActive && styles.chipCountBadgeActive]}>
                          <Text style={[styles.chipCountText, isActive && styles.chipCountTextActive]}>{f.count}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Pending List */}
              {q.isLoading ? (
                <View style={styles.list}>
                  {[1, 2, 3].map((i) => (
                    <Card key={i} style={styles.rowCard}>
                      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                        <Skeleton width={36} height={36} style={{ borderRadius: 10 }} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <Skeleton width="60%" height={14} />
                          <Skeleton width="40%" height={10} />
                        </View>
                      </View>
                      <Skeleton width="100%" height={36} style={{ marginTop: 14, borderRadius: radii.md }} />
                    </Card>
                  ))}
                </View>
              ) : rows.length === 0 ? (
                <View style={styles.emptyFilteredWrap}>
                  <Ionicons name="search-outline" size={32} color={colors.light.mutedForeground} />
                  <Text style={styles.emptyFilteredTitle}>No Matching Submissions</Text>
                  <Text style={styles.emptyFilteredSub}>No pending items match “{search}”. Try clearing your search.</Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {rows.map((row) => (
                    <Card key={`${row.kind}-${row.id}`} style={styles.rowCard}>
                      <View style={styles.rowHead}>
                        <View style={styles.rowHeadLeft}>
                          <View style={[styles.kindIcon, { backgroundColor: kindBg(row.kind) }]}>
                            <Ionicons name={row.icon} size={16} color={kindFg(row.kind)} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowName} numberOfLines={1}>
                              {row.name}
                            </Text>
                            <Text style={styles.rowMeta}>
                              {row.kindLabel} · Submitted {formatRelative(row.created_at)}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.kindPill, { backgroundColor: kindBg(row.kind) }]}>
                          <Text style={[styles.kindPillText, { color: kindFg(row.kind) }]}>{row.kindLabel}</Text>
                        </View>
                      </View>

                      <View style={styles.rowActions}>
                        <Pressable onPress={() => handle(row, "approve")} style={[styles.btn, styles.btnApprove]}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                          <Text style={styles.btnApproveText}>Approve</Text>
                        </Pressable>
                        <Pressable onPress={() => handle(row, "reject")} style={[styles.btn, styles.btnReject]}>
                          <Ionicons name="close" size={14} color={colors.light.destructive} />
                          <Text style={styles.btnRejectText}>Reject</Text>
                        </Pressable>
                        <Pressable onPress={() => router.push(row.route as any)} style={[styles.btn, styles.btnView]}>
                          <Ionicons name="open-outline" size={14} color={colors.light.foreground} />
                          <Text style={styles.btnViewText}>Inspect</Text>
                        </Pressable>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </>
          ) : (
            /* Zero Inbox Luxury Experience */
            <View style={styles.zeroStateContainer}>
              {/* Hero Status Card */}
              <Card style={styles.heroCard}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroPulseBadge}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.heroPulseText}>QUEUE NOMINAL</Text>
                  </View>
                  <Pressable onPress={refreshAll} style={styles.heroRefreshBtn}>
                    <Ionicons name="sync-outline" size={13} color={colors.olive[800]} />
                    <Text style={styles.heroRefreshText}>Sync</Text>
                  </Pressable>
                </View>

                <View style={styles.heroIconCircle}>
                  <Ionicons name="shield-checkmark" size={32} color={colors.olive[700]} />
                </View>

                <Text style={styles.heroTitle}>Queue Fully Settled</Text>
                <Text style={styles.heroSub}>
                  All incoming seller applications, brand certifications, and catalog submissions have been reviewed and processed.
                </Text>

                {/* Telemetry Strip */}
                <View style={styles.telemetryStrip}>
                  <View style={styles.telemetryCol}>
                    <Text style={styles.telemetryNum}>
                      {statsQ.data?.totalStores ? statsQ.data.totalStores - (statsQ.data.pendingStores ?? 0) : 0}
                    </Text>
                    <Text style={styles.telemetryLbl}>Live Ateliers</Text>
                  </View>
                  <View style={styles.telemetryDivider} />
                  <View style={styles.telemetryCol}>
                    <Text style={styles.telemetryNum}>{statsQ.data?.totalStores ?? 0}</Text>
                    <Text style={styles.telemetryLbl}>Total Stores</Text>
                  </View>
                  <View style={styles.telemetryDivider} />
                  <View style={styles.telemetryCol}>
                    <Text style={styles.telemetryNum}>{statsQ.data?.totalProducts ?? 0}</Text>
                    <Text style={styles.telemetryLbl}>Live SKUs</Text>
                  </View>
                </View>
              </Card>

              {/* Recent Decisions Audit Preview */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>COMPLIANCE LOG</Text>
                    <Text style={styles.sectionTitle}>Recent Decisions</Text>
                  </View>
                  <Pressable onPress={() => setMode("history")} hitSlop={10}>
                    <Text style={styles.headerLink}>View all →</Text>
                  </Pressable>
                </View>

                {(auditQ.data ?? []).length === 0 ? (
                  <View style={styles.emptyLogWrap}>
                    <Ionicons name="time-outline" size={24} color={colors.light.mutedForeground} />
                    <Text style={styles.emptyLogText}>No recent moderation actions recorded.</Text>
                  </View>
                ) : (
                  (auditQ.data ?? []).slice(0, 5).map((e: AuditEntry) => (
                    <View key={e.id} style={styles.decisionRow}>
                      <View style={[styles.decisionDot, { backgroundColor: auditActionColor(e.action) }]} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.decisionActor}>{e.actor_name ?? "Administrator"}</Text>
                        <Text style={styles.decisionAction}>{humanize(e.action)}</Text>
                      </View>
                      <Text style={styles.decisionTime}>{formatRelative(e.created_at)}</Text>
                    </View>
                  ))
                )}
              </Card>

              {/* Quick Directory Shortcuts */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>DIRECTORIES</Text>
                    <Text style={styles.sectionTitle}>Manage Approved Assets</Text>
                  </View>
                </View>

                <View style={styles.shortcutsGrid}>
                  <Pressable
                    onPress={() => router.push("/(admin)/catalogue" as any)}
                    style={styles.shortcutTile}
                  >
                    <View style={[styles.shortcutIcon, { backgroundColor: "#dde4d6" }]}>
                      <Ionicons name="storefront-outline" size={16} color={colors.olive[800]} />
                    </View>
                    <Text style={styles.shortcutTitle}>Active Ateliers</Text>
                    <Text style={styles.shortcutSub}>Review approved stores</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.push("/(admin)/catalogue" as any)}
                    style={styles.shortcutTile}
                  >
                    <View style={[styles.shortcutIcon, { backgroundColor: "#fdf3d7" }]}>
                      <Ionicons name="cube-outline" size={16} color="#7a5b1a" />
                    </View>
                    <Text style={styles.shortcutTitle}>Catalog Items</Text>
                    <Text style={styles.shortcutSub}>Browse live listings</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.push("/(admin)/commissions" as any)}
                    style={styles.shortcutTile}
                  >
                    <View style={[styles.shortcutIcon, { backgroundColor: "#e6e6d0" }]}>
                      <Ionicons name="wallet-outline" size={16} color={colors.olive[700]} />
                    </View>
                    <Text style={styles.shortcutTitle}>Commissions</Text>
                    <Text style={styles.shortcutSub}>Manage seller tiers</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setMode("guidelines")}
                    style={styles.shortcutTile}
                  >
                    <View style={[styles.shortcutIcon, { backgroundColor: "#efece2" }]}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#5c5b52" />
                    </View>
                    <Text style={styles.shortcutTitle}>Vetting Rules</Text>
                    <Text style={styles.shortcutSub}>SOP &amp; compliance</Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          )}
        </>
      ) : mode === "history" ? (
        /* Audit & History Mode */
        <View style={styles.historyContainer}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.light.mutedForeground} style={styles.searchIcon} />
            <TextInput
              style={styles.search}
              placeholder="Search audit trail by action or admin…"
              placeholderTextColor={colors.light.mutedForeground}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={10} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={colors.light.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filtersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Pressable
                onPress={() => setHistoryFilter("all")}
                style={[styles.chip, historyFilter === "all" && styles.chipActive]}
              >
                <Text style={[styles.chipText, historyFilter === "all" && styles.chipTextActive]}>All Actions</Text>
              </Pressable>
              <Pressable
                onPress={() => setHistoryFilter("approved")}
                style={[styles.chip, historyFilter === "approved" && styles.chipActive]}
              >
                <Text style={[styles.chipText, historyFilter === "approved" && styles.chipTextActive]}>Approvals</Text>
              </Pressable>
              <Pressable
                onPress={() => setHistoryFilter("rejected")}
                style={[styles.chip, historyFilter === "rejected" && styles.chipActive]}
              >
                <Text style={[styles.chipText, historyFilter === "rejected" && styles.chipTextActive]}>Rejections</Text>
              </Pressable>
            </ScrollView>
          </View>

          {auditEntries.length === 0 ? (
            <View style={styles.emptyFilteredWrap}>
              <Ionicons name="time-outline" size={32} color={colors.light.mutedForeground} />
              <Text style={styles.emptyFilteredTitle}>No Matching Audit Events</Text>
              <Text style={styles.emptyFilteredSub}>No recorded decisions match your query filter.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {auditEntries.map((e: AuditEntry) => (
                <Card key={e.id} style={styles.historyCard}>
                  <View style={styles.historyHead}>
                    <View style={styles.historyBadgeWrap}>
                      <View style={[styles.historyDot, { backgroundColor: auditActionColor(e.action) }]} />
                      <Text style={[styles.historyActionText, { color: auditActionColor(e.action) }]}>
                        {humanize(e.action)}
                      </Text>
                    </View>
                    <Text style={styles.historyDate}>{formatRelative(e.created_at)}</Text>
                  </View>
                  <Text style={styles.historyActor}>
                    Moderated by <Text style={styles.historyActorBold}>{e.actor_name ?? "Administrator"}</Text>
                  </Text>
                  {e.target_type ? (
                    <Text style={styles.historyTarget}>
                      Target: {e.target_type} {e.target_id ? `(#${e.target_id.slice(0, 8)})` : ""}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        </View>
      ) : (
        /* Vetting Guidelines Mode */
        <View style={styles.guidelinesContainer}>
          <Card style={styles.guidelineCard}>
            <View style={styles.guidelineHead}>
              <View style={[styles.guidelineIcon, { backgroundColor: "#dde4d6" }]}>
                <Ionicons name="storefront-outline" size={18} color={colors.olive[800]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>Atelier &amp; Boutique Criteria</Text>
                <Text style={styles.guidelineSub}>Mandatory standards for merchant activation</Text>
              </View>
            </View>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>Registered business entity or verified artisan credentials.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>High-resolution editorial hero banners and clear logo asset.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>Clear return and fulfillment policy adherence (&lt; 48h dispatch).</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.guidelineCard}>
            <View style={styles.guidelineHead}>
              <View style={[styles.guidelineIcon, { backgroundColor: "#fdf3d7" }]}>
                <Ionicons name="cube-outline" size={18} color="#7a5b1a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>Catalog &amp; Product Quality</Text>
                <Text style={styles.guidelineSub}>Product listing curation rules</Text>
              </View>
            </View>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>Minimum 3 high-resolution studio photos on clean backgrounds.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>Accurate material composition, sizing specs, and origin disclosure.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>Authentic pricing conforming to verified retail market ranges.</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.guidelineCard}>
            <View style={styles.guidelineHead}>
              <View style={[styles.guidelineIcon, { backgroundColor: "#e6e6d0" }]}>
                <Ionicons name="timer-outline" size={18} color={colors.olive[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>Service Level &amp; Escalation</Text>
                <Text style={styles.guidelineSub}>Turnaround commitments &amp; rejection process</Text>
              </View>
            </View>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>Review target SLA: 24 hours from initial submission timestamp.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.olive[700]} />
                <Text style={styles.bulletText}>All rejections must provide specific, actionable remediation reasons.</Text>
              </View>
            </View>
          </Card>
        </View>
      )}
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

function kindBg(k: string) {
  if (k === "store") return "#dde4d6";
  if (k === "brand") return "#fdf3d7";
  return "#e6e6d0";
}

function kindFg(k: string) {
  if (k === "store") return colors.olive[800];
  if (k === "brand") return "#7a5b1a";
  return colors.light.foreground;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 120 },

  /* 1. Header */
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    marginTop: 2,
    letterSpacing: -0.6,
  },
  titleAccent: {
    fontFamily: fontFamilies.display.regular,
    fontStyle: "italic",
    color: colors.olive[600],
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  countBadgePending: {
    backgroundColor: "#fdf3d7",
    borderColor: "#e0d0a5",
  },
  countBadgeNominal: {
    backgroundColor: colors.paper.DEFAULT,
    borderColor: colors.light.border,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotPending: { backgroundColor: "#c8a44a" },
  statusDotNominal: { backgroundColor: colors.olive[600] },
  countText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  countTextPending: { color: "#7a5b1a" },
  countTextNominal: { color: colors.olive[700] },

  /* SLA Strip */
  slaStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#dde4d6" + "66",
    borderRadius: radii.md,
    gap: 10,
  },
  slaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  slaText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.olive[800],
  },
  slaDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.olive[400],
  },

  /* 2. Segmented Mode Switcher */
  segmentedContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    padding: 3,
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.lg,
  },
  segmentBtnActive: {
    backgroundColor: colors.light.card,
    ...shadows.soft,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  segmentText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  segmentTextActive: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },

  /* Search & Filter */
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 14,
    height: 42,
  },
  searchIcon: { marginRight: 8 },
  search: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
    height: "100%",
  },
  clearBtn: { padding: 4 },

  filtersContainer: { marginTop: 10, marginBottom: 4 },
  filters: { paddingHorizontal: 16, gap: 6, paddingBottom: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  chipTextActive: { color: "#fff" },
  chipCountBadge: {
    backgroundColor: colors.light.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  chipCountBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  chipCountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  chipCountTextActive: { color: "#fff" },

  /* List & Cards */
  list: { paddingHorizontal: 16, gap: 10, paddingTop: 6 },
  rowCard: {
    padding: 16,
    gap: 14,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowHeadLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  kindIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  rowMeta: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  kindPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  kindPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  rowActions: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  btnApprove: {
    backgroundColor: colors.olive[600],
    borderColor: colors.olive[600],
  },
  btnApproveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#fff",
  },
  btnReject: {
    backgroundColor: colors.light.card,
    borderColor: colors.light.border,
  },
  btnRejectText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.destructive,
  },
  btnView: {
    backgroundColor: colors.light.card,
    borderColor: colors.light.border,
  },
  btnViewText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },

  /* Empty Filtered */
  emptyFilteredWrap: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyFilteredTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    marginTop: 4,
  },
  emptyFilteredSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: "center",
    maxWidth: 260,
  },

  /* Zero State Luxury Layout */
  zeroStateContainer: {
    paddingHorizontal: 16,
    gap: 14,
    marginTop: 4,
  },
  heroCard: {
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 20,
    alignItems: "center",
    ...shadows.soft,
  },
  heroBadgeRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroPulseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "#dde4d6",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
  heroPulseText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[800],
    letterSpacing: 0.8,
  },
  heroRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  heroRefreshText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: "#dde4d6" + "99",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#c8c8b8",
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 12,
  },
  telemetryStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  telemetryCol: { flex: 1, alignItems: "center" },
  telemetryNum: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
  },
  telemetryLbl: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.light.border,
  },

  /* Section Card (Decisions & Directories) */
  sectionCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    ...shadows.soft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.primary,
    letterSpacing: 1.2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
    marginTop: 1,
  },
  headerLink: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.olive[700],
  },
  emptyLogWrap: {
    paddingVertical: 18,
    alignItems: "center",
    gap: 6,
  },
  emptyLogText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  decisionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  decisionDot: { width: 7, height: 7, borderRadius: 4 },
  decisionActor: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  decisionAction: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  decisionTime: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },

  /* Shortcuts Grid */
  shortcutsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shortcutTile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
    gap: 3,
  },
  shortcutIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  shortcutTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  shortcutSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },

  /* History Tab */
  historyContainer: { gap: 10 },
  historyCard: {
    padding: 14,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 6,
    ...shadows.soft,
  },
  historyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyBadgeWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyDot: { width: 6, height: 6, borderRadius: 3 },
  historyActionText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  historyDate: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  historyActor: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.foreground,
  },
  historyActorBold: { fontFamily: fontFamilies.sans.semibold },
  historyTarget: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },

  /* Guidelines Tab */
  guidelinesContainer: { paddingHorizontal: 16, gap: 12 },
  guidelineCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    gap: 12,
    ...shadows.soft,
  },
  guidelineHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  guidelineIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  guidelineTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  guidelineSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  bulletList: { gap: 8, paddingLeft: 4 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.foreground,
    lineHeight: 18,
  },
});

