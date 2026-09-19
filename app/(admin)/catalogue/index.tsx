import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, TextInput, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminProducts,
  getAdminBrands,
  getAdminCategoriesEnriched,
  getAdminBanners,
  approveBrand,
  approveProduct,
} from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, resolveImageUrl } from "@/lib/utils";

const RUST = "#7a2f1a";
const GOLD = "#8a6a2a";

const STATUS_TONES: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  approved: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  live: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  pending: { bg: "rgba(200,164,74,0.20)", text: GOLD },
  draft: { bg: colors.light.muted, text: colors.light.mutedForeground },
  archived: { bg: colors.light.muted, text: colors.light.mutedForeground },
  inactive: { bg: colors.light.muted, text: colors.light.mutedForeground },
  off: { bg: colors.light.muted, text: colors.light.mutedForeground },
  rejected: { bg: "rgba(184,92,58,0.14)", text: RUST },
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.draft;
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

function primaryImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const primary = images.find((i: any) => i?.is_primary) ?? images[0];
  const url = primary?.url;
  return typeof url === "string" && url ? resolveImageUrl(url) || url : null;
}

function Chevron() {
  return (
    <View style={styles.chevronCircle}>
      <Ionicons name="chevron-forward" size={13} color={colors.olive[800]} />
    </View>
  );
}

const TABS = [
  { key: "products", label: "Products", icon: "cube-outline" as const },
  { key: "brands", label: "Brands", icon: "pricetag-outline" as const },
  { key: "categories", label: "Categories", icon: "albums-outline" as const },
  { key: "banners", label: "Banners", icon: "images-outline" as const },
];

const PRODUCT_TABS = ["all", "active", "pending", "draft", "archived"];
const BRAND_TABS = ["all", "approved", "pending", "rejected"];

export default function CatalogueHub() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [sub, setSub] = useState("all");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>INVENTORY & MERCHANDISING</Text>
        <Text style={styles.title}>Catalogue</Text>
      </View>

      {/* Main Categories Selector */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  setTab(t.key);
                  setSub("all");
                  setSearch("");
                }}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Ionicons name={t.icon} size={15} color={isActive ? "#fff" : colors.light.mutedForeground} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search with Icon */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.light.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder={`Search ${tab}…`}
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

      {tab === "products" && (
        <ProductsList
          search={search}
          status={sub}
          onApprove={(id: string) => {
            approveProduct(id, "active").then(() => qc.invalidateQueries({ queryKey: ["cat-products"] }));
          }}
          onReject={(id: string) => {
            approveProduct(id, "rejected").then(() => qc.invalidateQueries({ queryKey: ["cat-products"] }));
          }}
          statusTabs={PRODUCT_TABS}
          sub={sub}
          setSub={setSub}
        />
      )}
      {tab === "brands" && (
        <BrandsList
          search={search}
          status={sub}
          onApprove={(id: string) => {
            approveBrand(id, "approved").then(() => qc.invalidateQueries({ queryKey: ["cat-brands"] }));
          }}
          onReject={(id: string) => {
            approveBrand(id, "rejected").then(() => qc.invalidateQueries({ queryKey: ["cat-brands"] }));
          }}
          statusTabs={BRAND_TABS}
          sub={sub}
          setSub={setSub}
        />
      )}
      {tab === "categories" && <CategoriesList />}
      {tab === "banners" && <BannersList />}
    </View>
  );
}

function SubFilters({ tabs, sub, setSub }: { tabs: string[]; sub: string; setSub: (s: string) => void }) {
  return (
    <View style={styles.subFiltersWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {tabs.map((t) => {
          const isActive = sub === t;
          return (
            <Pressable key={t} onPress={() => setSub(t)} style={[styles.chip, isActive && styles.chipActive]}>
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ProductsList({ search, status, sub, setSub, statusTabs, onApprove, onReject }: any) {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["cat-products", status, search],
    queryFn: async () => {
      const r = await getAdminProducts({ status, search, limit: 100 });
      if (r.ok) return { products: r.data.products, total: r.data.total, error: null as string | null };
      return { products: [], total: 0, error: r.error ?? "Failed to load products" };
    },
  });
  const products = q.data?.products ?? [];
  const loadError = q.data?.error ?? null;

  return (
    <FlatList
      data={products}
      keyExtractor={(p: any) => p.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
      ListHeaderComponent={
        <View>
          <SubFilters tabs={statusTabs} sub={sub} setSub={setSub} />
          <Text style={styles.listCount}>
            {q.data?.total ?? products.length} {(q.data?.total ?? products.length) === 1 ? "product" : "products"}
          </Text>
        </View>
      }
      ListEmptyComponent={
        q.isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={70} style={{ borderRadius: radii.xl }} />
            <Skeleton height={70} style={{ borderRadius: radii.xl }} />
          </View>
        ) : loadError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load products"
            description={loadError}
          />
        ) : (
          <EmptyState icon="cube-outline" title="No products found" description="No products match your current search or status filter." />
        )
      }
      renderItem={({ item }: any) => {
        const img = primaryImage(item.images);
        const pending = item.status === "pending";
        const hasDiscount = Number(item.mrp ?? 0) > Number(item.price ?? 0);
        const subMeta = [
          item.category?.name,
          item.total_sales ? `${item.total_sales} sold` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <View style={[styles.itemCard, pending && styles.itemCardPending]}>
            {pending ? <View style={styles.pendingAccent} /> : null}
            <Pressable
              onPress={() => router.push({ pathname: "/(admin)/products/[id]", params: { id: item.id } } as any)}
              style={styles.itemRow}
            >
              {img ? (
                <Image source={{ uri: img }} style={styles.productThumb} contentFit="cover" />
              ) : (
                <View style={[styles.productThumb, styles.productAvatar]}>
                  <Ionicons name="cube-outline" size={18} color={colors.olive[700]} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {item.store?.name ?? "Independent Atelier"}
                  {item.brand?.name ? ` · ${item.brand.name}` : ""}
                </Text>
                {subMeta ? (
                  <Text style={styles.itemStock} numberOfLines={1}>
                    {subMeta}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                {hasDiscount ? (
                  <Text style={styles.itemMrp}>{formatPrice(item.mrp, item.currency)}</Text>
                ) : null}
                <Text style={styles.itemPrice}>{formatPrice(item.price, item.currency)}</Text>
                <StatusPill status={item.status} />
              </View>
              <Chevron />
            </Pressable>

            {pending ? (
              <View style={styles.itemActions}>
                <Pressable onPress={() => onApprove(item.id)} style={[styles.btn, styles.btnApprove]}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={styles.btnApproveText}>Approve listing</Text>
                </Pressable>
                <Pressable onPress={() => onReject(item.id)} style={[styles.btn, styles.btnReject]}>
                  <Ionicons name="close" size={13} color={colors.light.destructive} />
                  <Text style={styles.btnRejectText}>Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BrandsList({ search, status, sub, setSub, statusTabs, onApprove, onReject }: any) {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["cat-brands", status, search],
    queryFn: async () => {
      const r = await getAdminBrands({ status, search, limit: 100 });
      if (r.ok) return { brands: r.data.brands, total: r.data.total, error: null as string | null };
      return { brands: [], total: 0, error: r.error ?? "Failed to load brands" };
    },
  });
  const brands = q.data?.brands ?? [];
  const loadError = q.data?.error ?? null;

  return (
    <FlatList
      data={brands}
      keyExtractor={(b: any) => b.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
      ListHeaderComponent={<SubFilters tabs={statusTabs} sub={sub} setSub={setSub} />}
      ListEmptyComponent={
        q.isLoading ? (
          <Skeleton height={70} style={{ borderRadius: radii.xl }} />
        ) : loadError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load brands"
            description={loadError}
          />
        ) : (
          <EmptyState icon="pricetag-outline" title="No brands found" description="No brands match your search or filter." />
        )
      }
      renderItem={({ item }: any) => {
        const logo = item.logo_url ? resolveImageUrl(item.logo_url) || item.logo_url : null;
        const pending = item.status === "pending";
        return (
          <View style={[styles.itemCard, pending && styles.itemCardPending]}>
            {pending ? <View style={styles.pendingAccent} /> : null}
            <Pressable
              onPress={() => router.push({ pathname: "/(admin)/brands/[id]", params: { id: item.id } } as any)}
              style={styles.itemRow}
            >
              {logo ? (
                <Image source={{ uri: logo }} style={styles.productThumb} contentFit="cover" />
              ) : (
                <View style={[styles.productThumb, { backgroundColor: "#fdf3d7" }]}>
                  <Ionicons name="pricetag-outline" size={18} color={GOLD} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  @{item.slug} · {item.total_followers ?? 0} followers · {item.total_products ?? 0} products
                </Text>
              </View>
              <StatusPill status={item.status} />
              <Chevron />
            </Pressable>
            {pending ? (
              <View style={styles.itemActions}>
                <Pressable onPress={() => onApprove(item.id)} style={[styles.btn, styles.btnApprove]}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={styles.btnApproveText}>Approve brand</Text>
                </Pressable>
                <Pressable onPress={() => onReject(item.id)} style={[styles.btn, styles.btnReject]}>
                  <Ionicons name="close" size={13} color={colors.light.destructive} />
                  <Text style={styles.btnRejectText}>Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function CategoriesList() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["cat-categories"],
    queryFn: async () => {
      const r = await getAdminCategoriesEnriched();
      return r.ok ? r.data : [];
    },
  });
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(c: any) => c.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
      ListHeaderComponent={
        <Pressable onPress={() => router.push("/(admin)/categories" as never)} style={styles.manageLink}>
          <Ionicons name="git-network-outline" size={14} color={colors.light.primary} />
          <Text style={styles.manageLinkText}>Manage Category Hierarchy & Tree →</Text>
        </Pressable>
      }
      ListEmptyComponent={q.isLoading ? <Skeleton height={70} style={{ borderRadius: radii.xl }} /> : <EmptyState icon="albums-outline" title="No categories" />}
      renderItem={({ item }: any) => (
        <View style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={[styles.productThumb, { backgroundColor: "#dde4d6" }]}>
              <Ionicons name="albums-outline" size={18} color={colors.olive[800]} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                @{item.slug} · {item.gender ?? "all"} · {item.product_count ?? 0} products
              </Text>
            </View>
            <StatusPill status={item.is_active ? "active" : "inactive"} />
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BannersList() {
  const q = useQuery({
    queryKey: ["cat-banners"],
    queryFn: async () => {
      const r = await getAdminBanners();
      return r.ok ? r.data : [];
    },
  });
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(b: any) => b.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
      ListEmptyComponent={q.isLoading ? <Skeleton height={70} style={{ borderRadius: radii.xl }} /> : <EmptyState icon="images-outline" title="No banners" />}
      renderItem={({ item }: any) => {
        const bannerImg = item.image_url ? resolveImageUrl(item.image_url) || item.image_url : null;
        return (
          <View style={styles.itemCard}>
            <View style={styles.itemRow}>
              {bannerImg ? (
                <Image source={{ uri: bannerImg }} style={styles.bannerThumb} contentFit="cover" />
              ) : (
                <View style={[styles.productThumb, { backgroundColor: "#fbe5dc" }]}>
                  <Ionicons name="images-outline" size={18} color={RUST} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {item.position ?? "hero"} · order {item.display_order}
                </Text>
              </View>
              <StatusPill status={item.is_active ? "live" : "off"} />
            </View>
          </View>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },

  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
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

  tabsContainer: { marginTop: 8 },
  tabs: { paddingHorizontal: 16, gap: 6, paddingBottom: 6 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  tabActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  tabText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  tabTextActive: { color: "#fff" },

  searchWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 14,
    height: 44,
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

  subFiltersWrap: { marginVertical: 6 },
  filters: { paddingHorizontal: 16, gap: 6, paddingBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chipActive: {
    backgroundColor: colors.olive[600],
    borderColor: colors.olive[600],
  },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  chipTextActive: { color: "#fff" },

  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, gap: 10 },
  manageLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  manageLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.primary,
  },

  itemCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  itemCardPending: {
    borderColor: "rgba(200,164,74,0.55)",
  },
  pendingAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#c8a44a",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingLeft: 18,
  },
  productThumb: {
    width: 46,
    height: 46,
    borderRadius: 11,
    backgroundColor: colors.olive[100],
  },
  productAvatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  bannerThumb: {
    width: 66,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#fbe5dc",
  },
  itemName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  itemMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  itemStock: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10.5,
    color: colors.olive[700],
  },
  itemMrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  listCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginTop: -2,
    marginBottom: 8,
  },
  itemPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  chevronCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f8f6f0",
    borderWidth: 1,
    borderColor: "#e4dfd3",
    alignItems: "center",
    justifyContent: "center",
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  btnApprove: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  btnApproveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#fff",
  },
  btnReject: {
    backgroundColor: "rgba(184,92,58,0.08)",
    borderColor: "rgba(184,92,58,0.35)",
  },
  btnRejectText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.destructive,
  },
});
