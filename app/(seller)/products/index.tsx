import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  Platform,
  Share,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerProducts,
  deleteSellerProduct,
  duplicateSellerProduct,
  bulkSetSellerStatus,
} from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

const STATUS_TABS = ["all", "active", "draft", "pending", "flagged", "archived"] as const;
type SortKey = "newest" | "oldest" | "price_asc" | "price_desc" | "sales_desc" | "name_asc";
type ViewMode = "list" | "grid";

const SORT_TABS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "sales_desc", label: "Top selling" },
  { key: "price_desc", label: "Price ↓" },
  { key: "price_asc", label: "Price ↑" },
  { key: "name_asc", label: "Name A→Z" },
  { key: "oldest", label: "Oldest" },
];
const PAGE_SIZE = 20;
// Backend caps `limit` at 100 per request, so a full-catalogue export has to
// page through results rather than exporting whatever page happens to be loaded.
const EXPORT_PAGE_SIZE = 100;

interface ProductStats {
  all: number;
  active: number;
  draft: number;
  pending: number;
  archived: number;
  flagged: number;
}

function ModerationChip({ p }: { p: Product }) {
  const reasons = (p.suspicious_reasons ?? []) as { blocking: boolean }[];
  if (p.status === "active" && p.auto_approved) {
    return (
      <View style={[styles.modChip, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
        <Ionicons name="shield-checkmark" size={11} color="#059669" />
        <Text style={[styles.modChipText, { color: "#047857" }]}>auto</Text>
      </View>
    );
  }
  if (p.is_flagged) {
    const blocking = reasons.some((r) => r.blocking);
    return (
      <View
        style={[
          styles.modChip,
          {
            backgroundColor: blocking ? "#ede9fe" : "#fff1f2",
            borderColor: blocking ? "#c4b5fd" : "#fecdd3",
          },
        ]}
      >
        <Ionicons name={blocking ? "close-circle" : "alert-circle"} size={11} color={blocking ? "#7c3aed" : "#e11d48"} />
        <Text style={[styles.modChipText, { color: blocking ? "#6d28d9" : "#be123c" }]}>
          flagged · {p.risk_score ?? 0}
        </Text>
      </View>
    );
  }
  if (p.status === "pending") {
    return (
      <View style={[styles.modChip, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
        <Ionicons name="alert-circle" size={11} color="#d97706" />
        <Text style={[styles.modChipText, { color: "#b45309" }]}>review</Text>
      </View>
    );
  }
  return null;
}

function formatPrice(n: number) {
  try {
    return `Rs. ${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  } catch {
    return `Rs. ${n}`;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function toCsv(products: Product[]): string {
  const header = ["name", "sku", "status", "price", "mrp", "total_sales", "stock", "created_at"];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const p of products) {
    const stock = (p.variants ?? []).reduce((s, v) => s + (v.stock ?? 0), 0);
    lines.push(
      [
        escape(p.name),
        escape(p.sku),
        escape(p.status),
        escape(p.price),
        escape(p.mrp),
        escape(p.total_sales ?? 0),
        escape(stock),
        escape(p.created_at),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function showActions(item: Product, onAction: (key: string) => void) {
  const opts = [
    "View public page",
    item.status === "archived" ? "Restore" : "Archive",
    "Duplicate",
    item.status === "active" ? "Move to draft" : "Activate",
    "Delete",
    "Cancel",
  ];
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: opts, cancelButtonIndex: 5, destructiveButtonIndex: 4 },
      (i) => onAction(opts[i].toLowerCase().split(" ")[0]),
    );
  } else {
    Alert.alert(item.name, undefined, [
      { text: opts[0], onPress: () => onAction("view") },
      { text: opts[1], onPress: () => onAction(item.status === "archived" ? "restore" : "archive") },
      { text: opts[2], onPress: () => onAction("duplicate") },
      { text: opts[3], onPress: () => onAction(item.status === "active" ? "draft" : "activate") },
      { text: opts[4], style: "destructive", onPress: () => onAction("delete") },
      { text: opts[5], style: "cancel" },
    ]);
  }
}

function statusColor(status: string) {
  if (status === "active") return { bg: "#dcfce7", text: "#166534" };
  if (status === "draft") return { bg: "#f3f4f6", text: "#6b7280" };
  if (status === "archived") return { bg: "#fce7f3", text: "#9d174d" };
  return { bg: "#fef9c3", text: "#854d0e" };
}

export default function SellerProducts() {
  const router = useRouter();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Track initial mount so the focus-effect doesn't refetch on first render.
  const mountedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const resetList = useCallback(() => {
    setProducts([]);
    setOffset(0);
    setHasMore(true);
  }, []);

  const loadPage = useCallback(
    async (pageOffset: number, append: boolean) => {
      if (!storeId) return;
      const res = await getSellerProducts(storeId, {
        status: status === "all" ? undefined : status,
        search: debouncedSearch || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: pageOffset,
      });
      if (!res.ok) {
        if (!append) setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        Alert.alert("Error", res.error);
        return;
      }
      const incoming = res.data.products ?? [];
      setTotal(res.data.total ?? 0);
      // Stats come back on the first page (offset 0) — keep the last good payload
      // across pagination/refetches so the KPI banner doesn't flicker.
      if (pageOffset === 0 && res.data && (res.data as unknown as { stats?: ProductStats }).stats) {
        setStats((res.data as unknown as { stats: ProductStats }).stats);
      }
      setProducts((prev) => (append ? [...prev, ...incoming] : incoming));
      setHasMore(incoming.length >= PAGE_SIZE);
      setOffset(pageOffset + incoming.length);
      if (!append) setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    },
    [storeId, status, debouncedSearch, sort],
  );

  useEffect(() => {
    if (!user || storeId) return;
    (async () => {
      const storeRes = await getSellerStore(user.id);
      if (storeRes.ok && storeRes.data) setStoreId(storeRes.data.id);
    })();
  }, [user, storeId]);

  useEffect(() => {
    if (!storeId) return;
    resetList();
    setLoading(true);
    loadPage(0, false);
  }, [storeId, status, sort, debouncedSearch, loadPage, resetList]);

  // Refresh on tab focus so edits on the [id] page land here without pull-to-refresh.
  // Mirror of the dashboard's useFocusEffect pattern.
  useFocusEffect(
    useCallback(() => {
      if (!storeId || !mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      resetList();
      setRefreshing(true);
      loadPage(0, false);
    }, [storeId, resetList, loadPage]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    resetList();
    loadPage(0, false);
  }, [loadPage, resetList]);

  const onEndReached = useCallback(() => {
    if (loadingMore || loading || refreshing || !hasMore) return;
    setLoadingMore(true);
    loadPage(offset, true);
  }, [loadingMore, loading, refreshing, hasMore, offset, loadPage]);

  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      "Delete product?",
      `"${product.name}" will be removed permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusyId(product.id);
            const res = await deleteSellerProduct(product.id);
            setBusyId(null);
            if (res.ok) {
              setProducts((prev) => prev.filter((p) => p.id !== product.id));
              setTotal((t) => Math.max(0, t - 1));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(product.id);
                return next;
              });
            } else {
              Alert.alert("Error", res.error);
            }
          },
        },
      ],
    );
  };

  const handleDuplicate = async (product: Product) => {
    if (!storeId) return;
    setBusyId(product.id);
    const res = await duplicateSellerProduct(product.id, storeId);
    setBusyId(null);
    if (res.ok && res.data?.id) {
      // Mirror web: navigate straight into the new draft so the seller
      // can edit the copy without an intermediate dialog.
      router.replace(`/(seller)/products/${res.data.id}` as any);
    } else if (!res.ok) {
      Alert.alert("Error", res.error);
    }
  };

  const handleArchive = async (product: Product) => {
    if (!storeId) return;
    setBusyId(product.id);
    const target = product.status === "archived" ? "draft" : "archived";
    const res = await bulkSetSellerStatus([product.id], target, storeId);
    setBusyId(null);
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: target as Product["status"] } : p)),
      );
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleActivate = async (product: Product) => {
    if (!storeId) return;
    setBusyId(product.id);
    const target = product.status === "active" ? "draft" : "active";
    const res = await bulkSetSellerStatus([product.id], target, storeId);
    setBusyId(null);
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: target as Product["status"] } : p)),
      );
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleAction = (product: Product, key: string) => {
    switch (key) {
      case "view":
        // Public product route is app/(main)/products/[slug].tsx on mobile.
        router.push(`/(main)/products/${product.slug}` as any);
        break;
      case "delete":
        handleDelete(product);
        break;
      case "duplicate":
        void handleDuplicate(product);
        break;
      case "archive":
      case "restore":
        void handleArchive(product);
        break;
      case "activate":
      case "draft":
        void handleActivate(product);
        break;
    }
  };

  const bulkApply = async (target: "draft" | "active" | "archived") => {
    if (!storeId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkBusy(true);
    const res = await bulkSetSellerStatus(ids, target, storeId);
    setBulkBusy(false);
    if (res.ok) {
      Alert.alert("Done", `${res.data.updated} product(s) moved to ${target}.`);
      exitSelect();
      onRefresh();
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Delete products?",
      `${selectedIds.size} product(s) will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ids = Array.from(selectedIds);
            setBulkBusy(true);
            const results = await Promise.allSettled(ids.map((id) => deleteSellerProduct(id)));
            setBulkBusy(false);
            const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
            if (failed.length) {
              Alert.alert("Partial", `${ids.length - failed.length} deleted, ${failed.length} failed.`);
            } else {
              Alert.alert("Done", `${ids.length} deleted.`);
            }
            exitSelect();
            onRefresh();
          },
        },
      ],
    );
  };

  const exportCsv = async () => {
    if (!storeId || (total === 0 && products.length === 0)) {
      Alert.alert("Nothing to export", "Load some products first.");
      return;
    }
    setExporting(true);
    try {
      // Page through the full result set for the current filter/search/sort —
      // `products` only holds whatever page is currently loaded in the list.
      let all: Product[] = [];
      let pageOffset = 0;
      for (;;) {
        const res = await getSellerProducts(storeId, {
          status: status === "all" ? undefined : status,
          search: debouncedSearch || undefined,
          sort,
          limit: EXPORT_PAGE_SIZE,
          offset: pageOffset,
        });
        if (!res.ok) {
          Alert.alert("Export failed", res.error);
          return;
        }
        const batch = res.data.products ?? [];
        all = all.concat(batch);
        pageOffset += batch.length;
        if (batch.length < EXPORT_PAGE_SIZE) break;
      }
      if (all.length === 0) {
        Alert.alert("Nothing to export", "Load some products first.");
        return;
      }
      const csv = toCsv(all);
      await Share.share({
        message: csv,
        title: `products-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not share");
    } finally {
      setExporting(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const stock = item.variants?.reduce((s, v) => s + (v.stock ?? 0), 0) ?? 0;
    const selected = selectedIds.has(item.id);
    const sc = statusColor(item.status);
    return (
      <View style={[styles.productCard, selected && styles.productCardSelected]}>
        {selectMode && (
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleSelect(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={selected ? "checkbox" : "square-outline"}
              size={22}
              color={selected ? colors.light.primary : colors.light.mutedForeground}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.productCardMain}
          onPress={() => (selectMode ? toggleSelect(item.id) : router.push(`/(seller)/products/${item.id}` as any))}
          onLongPress={() => {
            if (!selectMode) {
              setSelectMode(true);
              setSelectedIds(new Set([item.id]));
            } else {
              toggleSelect(item.id);
            }
          }}
          delayLongPress={350}
        >
          {item.images?.[0]?.url ? (
            <Image source={{ uri: item.images[0].url }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Text style={{ color: colors.light.mutedForeground }}>📦</Text>
            </View>
          )}
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.badges}>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
                </View>
                <ModerationChip p={item} />
              </View>
            </View>
            <Text style={styles.productSku}>{item.sku ?? item.slug ?? "—"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaItem}>{formatPrice(item.price)}</Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={[styles.metaItem, stock === 0 && styles.stockOut, stock > 0 && stock < 10 && styles.stockLow]}>
                {stock} in stock
              </Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaItem}>{item.total_sales ?? 0} sold</Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaItem}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {!selectMode && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => showActions(item, (k) => handleAction(item, k))}
            disabled={busyId === item.id}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderGrid = ({ item }: { item: Product }) => {
    const stock = item.variants?.reduce((s, v) => s + (v.stock ?? 0), 0) ?? 0;
    const selected = selectedIds.has(item.id);
    const sc = statusColor(item.status);
    const stockTone =
      stock === 0
        ? { bg: "#fee2e2", text: "#991b1b" }
        : stock < 10
          ? { bg: "#fef3c7", text: "#92400e" }
          : { bg: "#dcfce7", text: "#166534" };
    return (
      <TouchableOpacity
        style={[styles.gridCard, selected && styles.gridCardSelected]}
        onPress={() => (selectMode ? toggleSelect(item.id) : router.push(`/(seller)/products/${item.id}` as any))}
        onLongPress={() => {
          if (!selectMode) {
            setSelectMode(true);
            setSelectedIds(new Set([item.id]));
          } else {
            toggleSelect(item.id);
          }
        }}
        delayLongPress={350}
        activeOpacity={0.9}
      >
        {selectMode ? (
          <View style={styles.gridCheckbox}>
            <Ionicons
              name={selected ? "checkbox" : "square-outline"}
              size={18}
              color={selected ? colors.light.primary : "#fff"}
            />
          </View>
        ) : null}
        {item.images?.[0]?.url ? (
          <Image source={{ uri: item.images[0].url }} style={styles.gridImage} />
        ) : (
          <View style={[styles.gridImage, styles.productImagePlaceholder]}>
            <Text style={{ fontSize: 24 }}>📦</Text>
          </View>
        )}
        <View style={[styles.gridStatusPill, { backgroundColor: sc.bg }]}>
          <Text style={[styles.gridStatusText, { color: sc.text }]}>{item.status}</Text>
        </View>
        <View style={[styles.gridStockPill, { backgroundColor: stockTone.bg }]}>
          <Text style={[styles.gridStockText, { color: stockTone.text }]}>
            {stock === 0 ? "Out" : `${stock}`}
          </Text>
        </View>
        <View style={styles.gridBody}>
          <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.gridSku} numberOfLines={1}>{item.sku ?? "—"}</Text>
          <View style={styles.gridFooter}>
            <Text style={styles.gridPrice}>{formatPrice(item.price)}</Text>
            <Text style={styles.gridSales}>{item.total_sales ?? 0} sold</Text>
          </View>
          <ModerationChip p={item} />
        </View>
      </TouchableOpacity>
    );
  };

  const empty = useMemo(() => {
    if (search || status !== "all") {
      return {
        icon: "🔍",
        title: "No matches",
        sub: "Try a different search or status filter.",
        showCta: false,
      };
    }
    return {
      icon: "📦",
      title: "No products yet",
      sub: "Add your first product to start selling.",
      showCta: true,
    };
  }, [search, status]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Products</Text>
          <Text style={styles.count}>
            {total > 0 ? `${products.length} of ${total}` : `${products.length} products`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {selectMode ? (
            <TouchableOpacity style={styles.cancelSelectBtn} onPress={exitSelect}>
              <Text style={styles.cancelSelectText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={exportCsv}
                hitSlop={6}
                disabled={exporting}
                accessibilityLabel="Export CSV"
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.light.foreground} />
                ) : (
                  <Ionicons name="share-outline" size={16} color={colors.light.foreground} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.push("/(seller)/bulk-upload" as any)}
                hitSlop={6}
                accessibilityLabel="Bulk upload"
              >
                <Ionicons name="cloud-upload-outline" size={16} color={colors.light.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/(seller)/products/new" as any)}
              >
                <Ionicons name="add" size={16} color={colors.light.card} />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={16} color={colors.light.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.light.mutedForeground}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === "list" && styles.viewBtnActive]}
            onPress={() => setViewMode("list")}
            hitSlop={6}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={viewMode === "list" ? "#fff" : colors.light.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === "grid" && styles.viewBtnActive]}
            onPress={() => setViewMode("grid")}
            hitSlop={6}
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={viewMode === "grid" ? "#fff" : colors.light.foreground}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI banner — status counts from the latest backend payload. */}
      {stats ? (
        <View style={styles.kpiRow}>
          {([
            { key: "all", label: "Total", tone: "#1f2937" },
            { key: "active", label: "Active", tone: "#166534" },
            { key: "draft", label: "Draft", tone: "#6b7280" },
            { key: "pending", label: "Pending", tone: "#854d0e" },
            { key: "flagged", label: "Flagged", tone: "#9d174d" },
            { key: "archived", label: "Archived", tone: "#9d174d" },
          ] as const).map((s) => {
            const active = status === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.kpiChip, active && styles.kpiChipActive]}
                onPress={() => setStatus(s.key)}
              >
                <Text style={[styles.kpiChipValue, { color: active ? "#fff" : s.tone }]}>
                  {stats[s.key] ?? 0}
                </Text>
                <Text style={[styles.kpiChipLabel, active && styles.kpiChipLabelActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={styles.sortRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SORT_TABS}
          keyExtractor={(s) => s.key}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              style={[styles.sortChip, sort === s.key && styles.sortChipActive]}
              onPress={() => setSort(s.key)}
            >
              <Text style={[styles.sortChipText, sort === s.key && styles.sortChipTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {viewMode === "grid" ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderGrid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
          contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 96 }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}><Text style={styles.footerLoaderText}>Loading…</Text></View>
            ) : hasMore && products.length > 0 ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={onEndReached}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : products.length > 0 ? (
              <View style={styles.footerEnd}><Text style={styles.footerEndText}>End of list</Text></View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>{empty.icon}</Text>
                <Text style={styles.emptyTitle}>{empty.title}</Text>
                <Text style={styles.emptySub}>{empty.sub}</Text>
                {empty.showCta ? (
                  <TouchableOpacity
                    style={styles.emptyCta}
                    onPress={() => router.push("/(seller)/products/new" as any)}
                  >
                    <Ionicons name="add" size={16} color={colors.light.card} />
                    <Text style={styles.emptyCtaText}>Add your first product</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
          contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 96 }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}><Text style={styles.footerLoaderText}>Loading…</Text></View>
            ) : hasMore && products.length > 0 ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={onEndReached}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : products.length > 0 ? (
              <View style={styles.footerEnd}><Text style={styles.footerEndText}>End of list</Text></View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>{empty.icon}</Text>
                <Text style={styles.emptyTitle}>{empty.title}</Text>
                <Text style={styles.emptySub}>{empty.sub}</Text>
                {empty.showCta ? (
                  <TouchableOpacity
                    style={styles.emptyCta}
                    onPress={() => router.push("/(seller)/products/new" as any)}
                  >
                    <Ionicons name="add" size={16} color={colors.light.card} />
                    <Text style={styles.emptyCtaText}>Add your first product</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
        />
      )}

      {selectMode && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selectedIds.size} selected</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnGhost]}
              onPress={() => bulkApply("archived")}
              disabled={bulkBusy}
            >
              <Text style={styles.bulkBtnGhostText}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnGhost]}
              onPress={() => bulkApply("active")}
              disabled={bulkBusy}
            >
              <Text style={styles.bulkBtnGhostText}>Activate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnGhost]}
              onPress={() => bulkApply("draft")}
              disabled={bulkBusy}
            >
              <Text style={styles.bulkBtnGhostText}>Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnDanger]}
              onPress={bulkDelete}
              disabled={bulkBusy}
            >
              <Ionicons name="trash" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  count: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  addButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  cancelSelectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  cancelSelectText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
  },

  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.light.muted,
    borderRadius: radii.md,
    padding: 2,
  },
  viewBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  viewBtnActive: { backgroundColor: colors.light.foreground },

  kpiRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  kpiChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    minWidth: 0,
  },
  kpiChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  kpiChipValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
  },
  kpiChipLabel: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  kpiChipLabelActive: { color: "#fff" },

  sortRow: { marginBottom: 10 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  sortChipActive: { backgroundColor: colors.light.foreground },
  sortChipText: {
    fontSize: 11,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.medium as any,
  },
  sortChipTextActive: { color: colors.light.background },

  listContent: { padding: 16, paddingTop: 4 },

  /* List view */
  productCard: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 10,
    overflow: "hidden",
    alignItems: "stretch",
  },
  productCardSelected: {
    borderColor: colors.light.primary,
    backgroundColor: "#f0f9ff",
  },
  productCardMain: { flex: 1, flexDirection: "row" },
  checkbox: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  moreBtn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.light.border,
  },
  productImage: { width: 90, height: 90 },
  productImagePlaceholder: {
    backgroundColor: colors.light.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: { flex: 1, padding: 12, justifyContent: "center" },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },
  badges: { flexDirection: "row", alignItems: "center", gap: 4 },
  modChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  modChipText: { fontSize: 10, fontWeight: "600" },

  productSku: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontFamily: "monospace",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 4,
  },
  metaItem: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  metaSep: { fontSize: 10, color: colors.light.mutedForeground, opacity: 0.5 },
  stockOut: { color: "#dc2626", fontWeight: typography.fontWeights.semibold as any },
  stockLow: { color: "#d97706", fontWeight: typography.fontWeights.semibold as any },

  /* Grid view */
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
  },
  gridCardSelected: {
    borderColor: colors.light.primary,
    backgroundColor: "#f0f9ff",
  },
  gridImage: {
    width: "100%",
    aspectRatio: 1,
  },
  gridCheckbox: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  gridStatusPill: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  gridStatusText: {
    fontSize: 9,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },
  gridStockPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  gridStockText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.semibold as any,
  },
  gridBody: { padding: 10, gap: 2 },
  gridName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    minHeight: 32,
  },
  gridSku: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    fontFamily: "monospace",
  },
  gridFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  gridPrice: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  gridSales: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
  },

  emptyContainer: { alignItems: "center", paddingVertical: 56 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    marginTop: 12,
  },
  emptySub: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    marginTop: 20,
  },
  emptyCtaText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },

  footerLoader: { paddingVertical: 16, alignItems: "center" },
  footerLoaderText: { fontSize: 12, color: colors.light.mutedForeground },
  footerEnd: { paddingVertical: 20, alignItems: "center" },
  footerEndText: { fontSize: 11, color: colors.light.mutedForeground, opacity: 0.6 },
  loadMoreBtn: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
    alignItems: "center",
  },
  loadMoreText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.medium as any,
  },

  bulkBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.light.foreground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  bulkCount: {
    color: colors.light.background,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  bulkActions: { flexDirection: "row", gap: 6 },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  bulkBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.light.background,
  },
  bulkBtnGhostText: {
    color: colors.light.background,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
  },
  bulkBtnDanger: {
    backgroundColor: "#dc2626",
    width: 36,
    paddingHorizontal: 0,
  },
});