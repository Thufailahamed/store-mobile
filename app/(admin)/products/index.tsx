import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminProducts,
  approveProduct,
  setProductFeatured,
  setProductActive,
} from "@/lib/api";
import {
  getAdminCatalogStoresBackend,
  getAdminCatalogStoreProductsBackend,
  type AdminAiHealthStatus,
  type AdminCatalogStore,
  type AdminCatalogProduct,
} from "@/lib/api/backend";
import { SafeImage, ConfirmDialog, useToast, Skeleton } from "@/components/ui";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { INK, LIME, HAIRLINE, STATUS_TONE, cardSurface as card, Chip, SearchBar, Empty, kit } from "@/components/admin/catalog-kit";
import type { Product } from "@/lib/types";

/** The admin API returns `{ ok: false }` instead of throwing — surface it to react-query. */
async function must<T extends { ok: boolean }>(p: Promise<T>): Promise<T> {
  const res = await p;
  if (!res.ok) throw new Error((res as any).error ?? "Request failed");
  return res;
}

/* -------------------------------------------------------------------------- */
/*  Constants + row model                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Live" },
  { id: "pending", label: "Pending" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
] as const;

const STATUS_SEGMENTS = [
  { key: "active", label: "Live", color: "#22a35a" },
  { key: "pending", label: "Pending", color: "#e0b040" },
  { key: "draft", label: "Draft", color: "rgba(22,23,15,0.3)" },
  { key: "rejected", label: "Rejected", color: "#e57373" },
  { key: "archived", label: "Archived", color: "rgba(22,23,15,0.1)" },
];

const AI_SEGMENTS: { key: AdminAiHealthStatus; color: string }[] = [
  { key: "healthy", color: "#22a35a" },
  { key: "pending", color: "#5aa9e6" },
  { key: "warning", color: "#e0b040" },
  { key: "error", color: "#e05252" },
  { key: "missing", color: "rgba(22,23,15,0.12)" },
];

const AI_TONE: Record<AdminAiHealthStatus, string> = {
  healthy: "#22a35a",
  pending: "#5aa9e6",
  warning: "#d39a1c",
  error: "#e05252",
  missing: "rgba(22,23,15,0.25)",
};

type View_ = "stores" | "products";
/** Fallback-grouped stores may not know stock; the rollup endpoint always does. */
type StoreCardData = AdminCatalogStore & { stockKnown?: boolean };
type StoreFilter = "all" | "review" | "ai";

interface Row {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
  isFeatured: boolean;
  price: number;
  mrp: number | null;
  image: string | null;
  label: string;
  stock: number | null;
  sales: number | null;
  ai: { status: AdminAiHealthStatus; score: number } | null;
}

function rowFromProduct(p: Product): Row {
  const anyP = p as any;
  const stock: number | null =
    anyP.stock ??
    anyP.inventory_quantity ??
    (p.variants && p.variants.length > 0 ? p.variants.reduce((n, v) => n + (v.stock ?? 0), 0) : null);
  return {
    id: p.id,
    name: p.name,
    status: p.status ?? "draft",
    isActive: p.is_active !== false,
    isFeatured: !!p.is_featured,
    price: p.price,
    mrp: p.mrp ?? null,
    image: p.images?.find((i) => i.is_primary)?.url || p.images?.[0]?.url || anyP.image_url || null,
    label: p.brand?.name || p.store?.name || p.category?.name || "Collection",
    stock,
    sales: p.total_sales ?? 0,
    ai: null,
  };
}

function rowFromCatalog(p: AdminCatalogProduct, storeName: string): Row {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    isActive: p.is_active !== false,
    isFeatured: p.is_featured,
    price: p.price,
    mrp: p.mrp,
    image: p.image,
    label: p.brand?.name || storeName,
    stock: p.stock,
    sales: null,
    ai: p.ai_health ?? null,
  };
}

const aiAttention = (s: AdminCatalogStore) => (s.ai?.error ?? 0) + (s.ai?.warning ?? 0) + (s.ai?.missing ?? 0);
const worstAi = (s: AdminCatalogStore): AdminAiHealthStatus =>
  s.ai?.error ? "error" : s.ai?.warning || s.ai?.missing ? "warning" : s.ai?.pending ? "pending" : s.total ? "healthy" : "missing";
const initialsOf = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Group a flat product list into store cards when the catalog rollup endpoint isn't available. */
function storesFromProducts(products: Product[]): StoreCardData[] {
  const map = new Map<string, StoreCardData>();
  for (const p of products) {
    const sid = p.store?.id ?? (p as any).store_id ?? "unassigned";
    let s = map.get(sid);
    if (!s) {
      s = {
        id: sid,
        name: p.store?.name ?? "Unassigned",
        slug: null,
        logo_url: (p.store as any)?.logo_url ?? null,
        city: null,
        total: 0,
        by_status: {},
        flagged: 0,
        featured: 0,
        stock: 0,
        value: 0,
        ai: { healthy: 0, warning: 0, error: 0, pending: 0, missing: 0 },
        ai_score: null,
        thumbs: [],
        last_added: null,
        stockKnown: false,
      };
      map.set(sid, s);
    }
    const r = rowFromProduct(p);
    s.total++;
    s.by_status[r.status] = (s.by_status[r.status] ?? 0) + 1;
    if (r.isFeatured) s.featured++;
    if (r.stock != null) {
      s.stockKnown = true;
      s.stock += r.stock;
      s.value += r.stock * r.price;
    }
    if (r.image && s.thumbs.length < 3) s.thumbs.push(r.image);
    const created = (p as any).created_at as string | undefined;
    if (created && (!s.last_added || created > s.last_added)) s.last_added = created;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function AdminProducts() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [view, setView] = useState<View_>("stores");
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [storeQuery, setStoreQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState<AdminCatalogStore | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Row | null>(null);

  // Store rollups (web parity). Falls back to grouping a flat product fetch.
  const catalogQuery = useQuery({
    queryKey: ["admin-catalog-stores"],
    queryFn: async () => {
      const res = await getAdminCatalogStoresBackend();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    retry: 0,
    staleTime: 30_000,
  });
  const rollupAvailable = !!catalogQuery.data;

  const fallbackQuery = useQuery({
    queryKey: ["admin-products", "all-for-stores"],
    enabled: catalogQuery.isError,
    queryFn: async () => {
      const res = await getAdminProducts({ status: "all", limit: 500 });
      return res.ok ? res.data.products : [];
    },
    staleTime: 30_000,
  });

  const allStores: StoreCardData[] = useMemo(
    () => catalogQuery.data?.stores ?? storesFromProducts((fallbackQuery.data ?? []) as Product[]),
    [catalogQuery.data, fallbackQuery.data],
  );

  const totals = useMemo(() => {
    const t = catalogQuery.data?.totals;
    if (t) return t;
    const sum = (k: string) => allStores.reduce((n, s) => n + (s.by_status[k] ?? 0), 0);
    return {
      stores: allStores.length,
      products: allStores.reduce((n, s) => n + s.total, 0),
      active: sum("active"),
      pending: sum("pending"),
      ai_attention: 0,
      ai_healthy: 0,
    } as Record<string, number>;
  }, [catalogQuery.data, allStores]);

  const stores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    return allStores.filter((s) => {
      if (q && !`${s.name} ${s.city ?? ""}`.toLowerCase().includes(q)) return false;
      if (storeFilter === "review") return (s.by_status.pending ?? 0) > 0 || s.flagged > 0;
      if (storeFilter === "ai") return aiAttention(s) > 0;
      return true;
    });
  }, [allStores, storeQuery, storeFilter]);

  // Flat product list (no store selected) — server-side status + search.
  const productsQuery = useQuery({
    queryKey: ["admin-products", status, search],
    enabled: view === "products" && !selectedStore,
    queryFn: async () => {
      const res = await getAdminProducts({ status, search });
      return res.ok ? res.data : { products: [], total: 0 };
    },
    staleTime: 15_000,
  });

  // One store's catalogue — graded endpoint, else filter the flat fallback.
  const storeProductsQuery = useQuery({
    queryKey: ["admin-products", "store", selectedStore?.id],
    enabled: view === "products" && !!selectedStore,
    queryFn: async (): Promise<Row[]> => {
      const store = selectedStore!;
      const res = await getAdminCatalogStoreProductsBackend(store.id);
      if (res.ok) return res.data.products.map((p) => rowFromCatalog(p, store.name));
      const flat = await getAdminProducts({ status: "all", limit: 500 });
      const list = flat.ok ? flat.data.products : [];
      return list
        .filter((p) => (p.store?.id ?? (p as any).store_id ?? "unassigned") === store.id)
        .map(rowFromProduct);
    },
    staleTime: 15_000,
  });

  const rows: Row[] = useMemo(() => {
    if (!selectedStore) return ((productsQuery.data?.products ?? []) as Product[]).map(rowFromProduct);
    const q = search.trim().toLowerCase();
    return (storeProductsQuery.data ?? []).filter(
      (r) => (status === "all" || r.status === status) && (!q || `${r.name} ${r.label}`.toLowerCase().includes(q)),
    );
  }, [selectedStore, productsQuery.data, storeProductsQuery.data, status, search]);

  const productsLoading = selectedStore ? storeProductsQuery.isLoading : productsQuery.isLoading;
  const storesLoading = catalogQuery.isLoading || (catalogQuery.isError && fallbackQuery.isLoading);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["admin-catalog-stores"] });
  };

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => must(approveProduct(productId, "archived")),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Product archived");
      setArchiveTarget(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to archive product"),
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => must(setProductFeatured(id, next)),
    onSuccess: (_res, vars) => {
      invalidate();
      toast.success(vars.next ? "Featured on storefront" : "Removed from featured");
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update featured flag"),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => must(setProductActive(id, next)),
    onSuccess: (_res, vars) => {
      invalidate();
      toast.success(vars.next ? "Product visible for sale" : "Product hidden");
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to toggle visibility"),
  });

  const refreshing =
    catalogQuery.isRefetching || productsQuery.isRefetching || storeProductsQuery.isRefetching || fallbackQuery.isRefetching;
  const handleRefresh = () => {
    catalogQuery.refetch();
    if (catalogQuery.isError) fallbackQuery.refetch();
    if (view === "products") (selectedStore ? storeProductsQuery : productsQuery).refetch();
  };

  const openStore = (s: AdminCatalogStore) => {
    setSelectedStore(s);
    setStatus("all");
    setSearch("");
    setView("products");
  };

  const healthyPct = totals.products ? Math.round(((totals.ai_healthy ?? 0) / totals.products) * 100) : 0;
  const reviewStores = allStores.filter((s) => (s.by_status.pending ?? 0) > 0).length;

  /* ----------------------------- header block ----------------------------- */
  const header = (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>CATALOGUE</Text>
          </View>
          <Text style={styles.title}>Products</Text>
          <Text style={styles.subtitle}>
            Every boutique&apos;s range in one place — open a store, then any piece for full control.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
          onPress={handleRefresh}
          accessibilityLabel="Refresh catalogue"
        >
          <Ionicons name="refresh-outline" size={18} color={INK} />
        </Pressable>
      </View>

      {/* KPI bento */}
      <View style={styles.kpiGrid}>
        <Kpi index="01" icon="storefront-outline" label="BOUTIQUES" value={totals.stores} sub="with a catalogue" loading={storesLoading} />
        <Kpi index="02" icon="cube-outline" label="PRODUCTS" value={totals.products} sub={`${totals.active ?? 0} live for purchase`} loading={storesLoading} />
        <Kpi
          index="03"
          icon="time-outline"
          label="TO REVIEW"
          value={totals.pending}
          sub={`across ${reviewStores} store${reviewStores === 1 ? "" : "s"}`}
          alert={!!totals.pending}
          loading={storesLoading}
          onPress={() => router.push("/(admin)/approvals" as any)}
        />
        <Kpi
          index="04"
          icon="sparkles-outline"
          label="AI ATTENTION"
          value={rollupAvailable ? totals.ai_attention : undefined}
          sub={rollupAvailable ? `${healthyPct}% tagged cleanly` : "Rollup unavailable"}
          alert={!!totals.ai_attention}
          loading={storesLoading}
        />
      </View>

      {/* View switch */}
      <View style={styles.segment}>
        {(
          [
            ["stores", "Boutiques", allStores.length],
            ["products", "All SKUs", totals.products],
          ] as const
        ).map(([k, label, n]) => {
          const on = view === k;
          return (
            <Pressable
              key={k}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
              onPress={() => {
                setView(k);
                if (k === "products") setSelectedStore(null);
              }}
            >
              <Ionicons
                name={k === "stores" ? "grid-outline" : "list-outline"}
                size={14}
                color={on ? colors.paper.cream : colors.ink.mute}
              />
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{label}</Text>
              <Text style={[styles.segmentCount, on && styles.segmentCountOn]}>{n ?? 0}</Text>
            </Pressable>
          );
        })}
      </View>

      {view === "stores" ? (
        <>
          <SearchBar value={storeQuery} onChange={setStoreQuery} placeholder="Search boutiques or cities…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(
              [
                ["all", "All stores", allStores.length],
                ["review", "Needs review", allStores.filter((s) => (s.by_status.pending ?? 0) > 0 || s.flagged > 0).length],
                ...(rollupAvailable ? ([["ai", "AI attention", allStores.filter((s) => aiAttention(s) > 0).length]] as const) : []),
              ] as const
            ).map(([k, label, n]) => (
              <Chip key={k} label={label} count={n} active={storeFilter === k} onPress={() => setStoreFilter(k as StoreFilter)} />
            ))}
          </ScrollView>
        </>
      ) : (
        <>
          {selectedStore && (
            <View style={styles.storeBanner}>
              <StoreLogo store={selectedStore} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.storeBannerKicker}>BOUTIQUE CATALOGUE</Text>
                <Text style={styles.storeBannerName} numberOfLines={1}>{selectedStore.name}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.storeBannerClose, pressed && styles.pressed]}
                onPress={() => {
                  setSelectedStore(null);
                  setView("stores");
                }}
                accessibilityLabel="Back to boutiques"
              >
                <Ionicons name="close" size={16} color={colors.paper.cream} />
              </Pressable>
            </View>
          )}
          <SearchBar value={search} onChange={setSearch} placeholder="Search SKUs, styles, labels…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUS_TABS.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                dot={t.id !== "all" ? STATUS_TONE[t.id]?.dot : undefined}
                active={status === t.id}
                onPress={() => setStatus(t.id)}
              />
            ))}
          </ScrollView>
          {!productsLoading && (
            <Text style={styles.resultCount}>
              {rows.length}
              {!selectedStore && (productsQuery.data?.total ?? 0) > rows.length ? ` OF ${productsQuery.data?.total}` : ""}{" "}
              {rows.length === 1 ? "PIECE" : "PIECES"}
              {selectedStore ? ` · ${selectedStore.name.toUpperCase()}` : ""}
            </Text>
          )}
        </>
      )}
    </View>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.olive[800]} colors={[colors.olive[800]]} />
  );

  return (
    <View style={styles.container}>
      {view === "stores" ? (
        <FlatList
          key="stores"
          data={storesLoading ? [] : stores}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          renderItem={({ item, index }) => (
            <StoreCard store={item} index={index} showAi={rollupAvailable} onPress={() => openStore(item)} />
          )}
          ListEmptyComponent={
            storesLoading ? (
              <View style={{ gap: 14 }}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} width="100%" height={380} style={{ borderRadius: 28 }} />
                ))}
              </View>
            ) : (
              <Empty
                icon="storefront-outline"
                title="No boutiques match"
                body="Try a different search or filter."
                onReset={storeQuery || storeFilter !== "all" ? () => { setStoreQuery(""); setStoreFilter("all"); } : undefined}
              />
            )
          }
        />
      ) : (
        <FlatList
          key="products"
          data={productsLoading ? [] : rows}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          renderItem={({ item, index }) => (
            <ProductCard
              row={item}
              index={index}
              onPress={() => router.push(`/(admin)/products/${item.id}` as any)}
              onFeature={() => featuredMutation.mutate({ id: item.id, next: !item.isFeatured })}
              onToggleActive={() => activeMutation.mutate({ id: item.id, next: !item.isActive })}
              onArchive={() => setArchiveTarget(item)}
            />
          )}
          ListEmptyComponent={
            productsLoading ? (
              <View style={{ gap: 12 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.skeletonCard}>
                    <Skeleton width={88} height={110} style={{ borderRadius: 18 }} />
                    <View style={{ flex: 1, justifyContent: "center", gap: 8 }}>
                      <Skeleton width="40%" height={10} />
                      <Skeleton width="85%" height={16} />
                      <Skeleton width="35%" height={14} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Empty
                icon="bag-handle-outline"
                title="No pieces found"
                body={search ? `Nothing matches “${search}”.` : "No products under this status."}
                onReset={search || status !== "all" ? () => { setSearch(""); setStatus("all"); } : undefined}
              />
            )
          }
        />
      )}

      <ConfirmDialog
        visible={archiveTarget !== null}
        title="Archive this piece?"
        description={
          archiveTarget
            ? `“${archiveTarget.name}” will be retired from storefront browse and search. You can restore it later.`
            : ""
        }
        icon="archive-outline"
        iconTone="destructive"
        confirmText="Archive"
        cancelText="Cancel"
        destructive
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        onCancel={() => setArchiveTarget(null)}
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

function StoreLogo({ store, size }: { store: AdminCatalogStore; size: number }) {
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.3 }]}>
      {store.logo_url ? (
        <SafeImage uri={store.logo_url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Text style={[styles.logoText, { fontSize: size * 0.3 }]}>{initialsOf(store.name)}</Text>
      )}
    </View>
  );
}

function Bar({ segments, total }: { segments: { color: string; value: number }[]; total: number }) {
  return (
    <View style={styles.bar}>
      {segments.map((seg, i) =>
        seg.value ? <View key={i} style={{ flex: seg.value / Math.max(1, total), backgroundColor: seg.color }} /> : null,
      )}
    </View>
  );
}

function StoreCard({ store: s, index, showAi, onPress }: { store: StoreCardData; index: number; showAi: boolean; onPress: () => void }) {
  const pending = s.by_status.pending ?? 0;
  const live = s.by_status.active ?? 0;
  const attention = aiAttention(s);
  const thumbs = s.thumbs ?? [];
  return (
    <Animated.View entering={FadeInDown.duration(450).delay(Math.min(index, 6) * 60)}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.storeCard, pressed && styles.pressedCard]}>
        {/* Mosaic */}
        <View style={styles.mosaicWrap}>
        <View style={styles.mosaic}>
          {thumbs.length ? (
            <View style={styles.mosaicRow}>
              <SafeImage uri={thumbs[0]} style={thumbs.length >= 2 ? styles.mosaicMain : styles.mosaicFull} contentFit="cover" />
              {thumbs.length >= 2 && (
                <View style={styles.mosaicSide}>
                  <SafeImage uri={thumbs[1]} style={styles.mosaicSmall} contentFit="cover" />
                  {thumbs[2] ? (
                    <SafeImage uri={thumbs[2]} style={styles.mosaicSmall} contentFit="cover" />
                  ) : (
                    <View style={[styles.mosaicSmall, { backgroundColor: colors.paper.warm }]} />
                  )}
                </View>
              )}
            </View>
          ) : (
            <LinearGradient colors={["#e6e6d0", "#cccca0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mosaicEmpty}>
              <Text style={styles.mosaicInitials}>{initialsOf(s.name)}</Text>
            </LinearGradient>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.mosaicBadges}>
            {pending > 0 && (
              <View style={[styles.mosaicBadge, { backgroundColor: "rgba(245,190,60,0.96)" }]}>
                <Ionicons name="time-outline" size={11} color="#2a1d00" />
                <Text style={[styles.mosaicBadgeText, { color: "#2a1d00" }]}>{pending} to review</Text>
              </View>
            )}
            {s.flagged > 0 && (
              <View style={[styles.mosaicBadge, { backgroundColor: "rgba(225,72,72,0.95)" }]}>
                <Ionicons name="warning-outline" size={11} color="#fff" />
                <Text style={[styles.mosaicBadgeText, { color: "#fff" }]}>{s.flagged} flagged</Text>
              </View>
            )}
          </View>
          {showAi && s.ai_score != null && (
            <View style={[styles.aiRing, { borderColor: AI_TONE[worstAi(s)] }]}>
              <Text style={styles.aiRingValue}>{s.ai_score}</Text>
              <Text style={styles.aiRingLabel}>AI</Text>
            </View>
          )}
          <View style={styles.itemsPill}>
            <Text style={styles.itemsPillText}>{s.total} ITEMS</Text>
          </View>
        </View>
        </View>

        <View style={styles.storeBody}>
          <View style={styles.storeLogoWrap}>
            <StoreLogo store={s} size={56} />
          </View>
          <View style={styles.storeTitleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.storeName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.storeMeta} numberOfLines={1}>
                {s.city ? `${s.city}  ·  ` : ""}
                {s.last_added
                  ? `Last added ${new Date(s.last_added).toLocaleDateString("en-LK", { day: "numeric", month: "short" })}`
                  : "No products yet"}
              </Text>
            </View>
            <View style={styles.arrowCircle}>
              <Ionicons name="arrow-forward" size={15} color={LIME} />
            </View>
          </View>

          <View style={styles.stats}>
            <Stat label="LIVE" value={live.toLocaleString()} />
            <View style={styles.statDivider} />
            <Stat label="UNITS" value={s.stockKnown === false ? "—" : s.stock.toLocaleString()} />
            <View style={styles.statDivider} />
            {s.stockKnown === false ? (
              <Stat label="FEATURED" value={s.featured.toLocaleString()} />
            ) : (
              <Stat label="STOCK VALUE" value={formatPrice(s.value)} small />
            )}
          </View>

          <View style={styles.barBlock}>
            <View style={styles.barHead}>
              <Text style={styles.barLabel}>STATUS MIX</Text>
              <View style={styles.legend}>
                {STATUS_SEGMENTS.filter((seg) => s.by_status[seg.key])
                  .slice(0, 3)
                  .map((seg) => (
                    <View key={seg.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                      <Text style={styles.legendText}>
                        {seg.label} {s.by_status[seg.key]}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
            <Bar total={s.total} segments={STATUS_SEGMENTS.map((seg) => ({ color: seg.color, value: s.by_status[seg.key] ?? 0 }))} />
          </View>

          {showAi && (
            <View style={styles.barBlock}>
              <View style={styles.barHead}>
                <View style={styles.legendItem}>
                  <Ionicons name="sparkles" size={9} color="rgba(22,23,15,0.4)" />
                  <Text style={styles.barLabel}>AI TAGS</Text>
                </View>
                <Text style={[styles.legendText, { color: attention ? "#b7791f" : "#2e7d4a", fontFamily: fontFamilies.sans.semibold }]}>
                  {attention ? `${attention} need attention` : s.total ? "All clean" : "—"}
                </Text>
              </View>
              <Bar total={s.total} segments={AI_SEGMENTS.map((seg) => ({ color: seg.color, value: s.ai?.[seg.key] ?? 0 }))} />
            </View>
          )}

          <View style={styles.storeFooter}>
            <Text style={styles.storeFooterText}>Open catalogue</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.ink.mute} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, small && { fontSize: 12.5 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function ProductCard({
  row: r,
  index,
  onPress,
  onFeature,
  onToggleActive,
  onArchive,
}: {
  row: Row;
  index: number;
  onPress: () => void;
  onFeature: () => void;
  onToggleActive: () => void;
  onArchive: () => void;
}) {
  const tone = STATUS_TONE[r.status] ?? STATUS_TONE.draft;
  const discount = r.mrp && r.mrp > r.price ? Math.round(((r.mrp - r.price) / r.mrp) * 100) : 0;
  const lowStock = r.stock !== null && r.stock <= 5;
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 40)}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.productCard, pressed && styles.pressedCard]}>
        <View style={styles.productMain}>
          <View style={styles.thumb}>
            {r.image ? (
              <SafeImage uri={r.image} style={styles.thumbImg} contentFit="cover" />
            ) : (
              <View style={styles.thumbEmpty}>
                <Ionicons name="image-outline" size={22} color="rgba(22,23,15,0.25)" />
              </View>
            )}
            {r.isFeatured && (
              <View style={styles.thumbStar}>
                <Ionicons name="star" size={9} color={INK} />
              </View>
            )}
            {!r.isActive && (
              <View style={styles.thumbHidden}>
                <Ionicons name="eye-off" size={11} color="#fff" />
              </View>
            )}
          </View>

          <View style={styles.productInfo}>
            <View style={styles.productTop}>
              <Text style={styles.productLabel} numberOfLines={1}>{r.label.toUpperCase()}</Text>
              <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
                <Text style={[styles.statusText, { color: tone.text }]}>{tone.label}</Text>
              </View>
            </View>
            <Text style={styles.productName} numberOfLines={2}>{r.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(r.price)}</Text>
              {discount > 0 && (
                <>
                  <Text style={styles.mrp}>{formatPrice(r.mrp!)}</Text>
                  <Text style={styles.discount}>−{discount}%</Text>
                </>
              )}
            </View>
            <View style={styles.metaRow}>
              {r.stock !== null && (
                <View style={styles.metaItem}>
                  <View style={[styles.metaDot, { backgroundColor: lowStock ? "#e05252" : "#22a35a" }]} />
                  <Text style={[styles.metaText, lowStock && { color: "#9f2a2a" }]}>
                    {lowStock ? `Low · ${r.stock}` : `${r.stock} in stock`}
                  </Text>
                </View>
              )}
              {r.ai && (
                <View style={styles.metaItem}>
                  <Ionicons name="sparkles" size={10} color={AI_TONE[r.ai.status]} />
                  <Text style={styles.metaText}>AI {r.ai.score}</Text>
                </View>
              )}
              {r.sales !== null && <Text style={styles.metaText}>{r.sales} sold</Text>}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onFeature}
            style={({ pressed }) => [styles.action, r.isFeatured && styles.actionFeatured, pressed && styles.pressed]}
            accessibilityLabel={r.isFeatured ? "Unfeature" : "Feature"}
          >
            <Ionicons name={r.isFeatured ? "star" : "star-outline"} size={13} color={r.isFeatured ? INK : colors.ink.mute} />
            <Text style={[styles.actionText, r.isFeatured && styles.actionTextFeatured]}>
              {r.isFeatured ? "Featured" : "Feature"}
            </Text>
          </Pressable>
          <Pressable
            onPress={onToggleActive}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityLabel={r.isActive ? "Hide product" : "Show product"}
          >
            <View style={[styles.switchTrack, r.isActive && styles.switchTrackOn]}>
              <View style={[styles.switchKnob, r.isActive && styles.switchKnobOn]} />
            </View>
            <Text style={styles.actionText}>{r.isActive ? "Visible" : "Hidden"}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onArchive}
            style={({ pressed }) => [styles.archiveBtn, pressed && styles.pressed]}
            accessibilityLabel="Archive product"
            hitSlop={4}
          >
            <Ionicons name="archive-outline" size={15} color="#b03a3a" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingHorizontal: 18, paddingBottom: 48 },
  pressed: kit.pressed,
  pressedCard: kit.pressedCard,

  /* Header */
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 18, marginBottom: 18 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 2.2, color: colors.olive[700] },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 44, lineHeight: 46, letterSpacing: -1.6, color: INK },
  subtitle: { marginTop: 8, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: colors.ink.mute, maxWidth: 300 },
  roundBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: HAIRLINE, ...shadows.soft,
  },

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

  /* Segment */
  segment: {
    flexDirection: "row", padding: 4, borderRadius: 999, marginBottom: 14,
    backgroundColor: "rgba(239,236,226,0.8)", borderWidth: 1, borderColor: HAIRLINE,
  },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 999 },
  segmentItemOn: { backgroundColor: INK, ...shadows.soft },
  segmentText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.ink.mute },
  segmentTextOn: { color: colors.paper.cream },
  segmentCount: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: "rgba(22,23,15,0.4)" },
  segmentCountOn: { color: LIME },

  /* Search + chips */
  chips: { gap: 7, paddingBottom: 14 },
  resultCount: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.8, color: "rgba(22,23,15,0.4)", marginBottom: 10 },

  /* Store banner (selected) */
  storeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 10, paddingRight: 12, borderRadius: 22,
    backgroundColor: INK, marginBottom: 12, ...shadows.editorial,
  },
  storeBannerKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, letterSpacing: 1.8, color: LIME },
  storeBannerName: { fontFamily: fontFamilies.display.regular, fontSize: 19, color: colors.paper.cream, marginTop: 1 },
  storeBannerClose: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)",
  },

  /* Store card */
  storeCard: { ...card, borderRadius: 28, marginBottom: 16, overflow: "hidden" },
  mosaicWrap: { padding: 7 },
  mosaic: { width: "100%", aspectRatio: 16 / 10, borderRadius: 22, overflow: "hidden", backgroundColor: colors.paper.warm },
  mosaicRow: { flex: 1, flexDirection: "row", gap: 3 },
  mosaicFull: { flex: 1 },
  mosaicMain: { flex: 2 },
  mosaicSide: { flex: 1, gap: 3 },
  mosaicSmall: { flex: 1 },
  mosaicEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  mosaicInitials: { fontFamily: fontFamilies.display.regular, fontSize: 64, color: "rgba(22,23,15,0.15)" },
  mosaicBadges: { position: "absolute", top: 10, left: 10, gap: 5, alignItems: "flex-start" },
  mosaicBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  mosaicBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10 },
  aiRing: {
    position: "absolute", top: 10, right: 10, width: 46, height: 46, borderRadius: 23, borderWidth: 3,
    backgroundColor: "rgba(245,244,239,0.94)", alignItems: "center", justifyContent: "center",
  },
  aiRingValue: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: INK, lineHeight: 15 },
  aiRingLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 7, letterSpacing: 1, color: "rgba(22,23,15,0.45)" },
  itemsPill: {
    position: "absolute", bottom: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(245,244,239,0.92)",
  },
  itemsPillText: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.6, color: "rgba(22,23,15,0.75)" },
  storeBody: { paddingHorizontal: 18, paddingBottom: 16 },
  storeLogoWrap: { marginTop: -38, alignSelf: "flex-start", borderRadius: 20, borderWidth: 4, borderColor: "#fbfaf6" },
  logo: { backgroundColor: INK, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoText: { fontFamily: fontFamilies.sans.bold, color: LIME },
  storeTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  storeName: { fontFamily: fontFamilies.display.regular, fontSize: 25, letterSpacing: -0.6, color: INK },
  storeMeta: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: "rgba(22,23,15,0.45)" },
  arrowCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  stats: {
    flexDirection: "row", marginTop: 14, paddingVertical: 11, borderRadius: 18,
    backgroundColor: "rgba(239,236,226,0.6)", borderWidth: 1, borderColor: "rgba(22,23,15,0.04)",
  },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  statDivider: { width: 1, backgroundColor: "rgba(22,23,15,0.07)" },
  statLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, letterSpacing: 1.6, color: "rgba(22,23,15,0.4)" },
  statValue: { marginTop: 4, fontFamily: fontFamilies.sans.bold, fontSize: 15.5, color: INK },
  barBlock: { marginTop: 14 },
  barHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 },
  barLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, letterSpacing: 1.6, color: "rgba(22,23,15,0.4)" },
  bar: { flexDirection: "row", height: 6, gap: 2, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(22,23,15,0.04)" },
  legend: { flexDirection: "row", gap: 9 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: fontFamilies.sans.regular, fontSize: 10.5, color: "rgba(22,23,15,0.5)" },
  storeFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 13,
    borderTopWidth: 1, borderTopColor: HAIRLINE,
  },
  storeFooterText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: "rgba(22,23,15,0.7)" },

  /* Product card */
  productCard: { ...card, borderRadius: 24, padding: 10, marginBottom: 12 },
  productMain: { flexDirection: "row", gap: 13 },
  thumb: { width: 88, height: 110, borderRadius: 18, overflow: "hidden", backgroundColor: colors.paper.warm },
  thumbImg: { width: "100%", height: "100%" },
  thumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  thumbStar: {
    position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: LIME,
    alignItems: "center", justifyContent: "center",
  },
  thumbHidden: {
    position: "absolute", bottom: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(22,23,15,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  productInfo: { flex: 1, paddingTop: 4, paddingRight: 4 },
  productTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  productLabel: { flex: 1, fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.6, color: colors.olive[700] },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10.5 },
  productName: { marginTop: 5, fontFamily: fontFamilies.display.regular, fontSize: 17, lineHeight: 21, letterSpacing: -0.3, color: INK },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 5 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: INK },
  mrp: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: "rgba(22,23,15,0.4)", textDecorationLine: "line-through" },
  discount: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.accent2.rust },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 7 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaDot: { width: 6, height: 6, borderRadius: 3 },
  metaText: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: "rgba(22,23,15,0.5)" },
  actions: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 9, paddingHorizontal: 2,
    borderTopWidth: 1, borderTopColor: HAIRLINE,
  },
  action: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: "rgba(239,236,226,0.7)",
  },
  actionFeatured: { backgroundColor: LIME },
  actionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: colors.ink.mute },
  actionTextFeatured: { color: INK },
  switchTrack: { width: 24, height: 14, borderRadius: 7, backgroundColor: "rgba(22,23,15,0.15)", padding: 2 },
  switchTrackOn: { backgroundColor: "#22a35a" },
  switchKnob: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  switchKnobOn: { transform: [{ translateX: 10 }] },
  archiveBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#fdeeee",
  },

  /* Loading / empty */
  skeletonCard: { ...card, flexDirection: "row", gap: 13, padding: 10, borderRadius: 24 },
});
