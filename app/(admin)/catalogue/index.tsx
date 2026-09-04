import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, TextInput, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminProducts,
  getAdminBrands,
  getAdminCategoriesEnriched,
  getAdminBanners,
  approveBrand,
  approveProduct,
} from "@/lib/api";
import { Card, EmptyState, Skeleton, Badge } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const TABS = [
  { key: "products", label: "Products", icon: "cube-outline" as const },
  { key: "brands", label: "Brands", icon: "pricetag-outline" as const },
  { key: "categories", label: "Categories", icon: "albums-outline" as const },
  { key: "banners", label: "Banners", icon: "images-outline" as const },
];

const PRODUCT_TABS = ["all", "active", "pending", "draft", "archived"];
const BRAND_TABS = ["all", "approved", "pending", "rejected"];

export default function CatalogueHub() {
  const router = useRouter();
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
      return r.ok ? r.data : { products: [], total: 0 };
    },
  });
  const products = q.data?.products ?? [];

  return (
    <FlatList
      data={products}
      keyExtractor={(p: any) => p.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
      ListHeaderComponent={<SubFilters tabs={statusTabs} sub={sub} setSub={setSub} />}
      ListEmptyComponent={
        q.isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={70} style={{ borderRadius: radii.xl }} />
            <Skeleton height={70} style={{ borderRadius: radii.xl }} />
          </View>
        ) : (
          <EmptyState icon="cube-outline" title="No products found" description="No products match your current search or status filter." />
        )
      }
      renderItem={({ item, index }: any) => (
        <Pressable
          onPress={() => router.push({ pathname: "/(admin)/products/[id]", params: { id: item.id } } as any)}
          style={{ marginBottom: 2 }}
        >
          <Card style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View style={styles.productAvatar}>
                <Ionicons name="cube-outline" size={16} color={colors.olive[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.store?.name ?? "Independent Atelier"} {item.brand?.name ? `· ${item.brand.name}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
                <Badge variant={item.status === "active" ? "default" : item.status === "pending" ? "secondary" : "outline"}>
                  {item.status}
                </Badge>
              </View>
            </View>

            {item.status === "pending" && (
              <View style={styles.itemActions}>
                <Pressable onPress={() => onApprove(item.id)} style={[styles.btn, styles.btnApprove]}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={styles.btnApproveText}>Approve</Text>
                </Pressable>
                <Pressable onPress={() => onReject(item.id)} style={[styles.btn, styles.btnReject]}>
                  <Ionicons name="close" size={13} color={colors.light.destructive} />
                  <Text style={styles.btnRejectText}>Reject</Text>
                </Pressable>
              </View>
            )}
          </Card>
        </Pressable>
      )}
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
      return r.ok ? r.data : { brands: [], total: 0 };
    },
  });
  const brands = q.data?.brands ?? [];

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
        ) : (
          <EmptyState icon="pricetag-outline" title="No brands found" description="No brands match your search or filter." />
        )
      }
      renderItem={({ item }: any) => (
        <Card style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={[styles.productAvatar, { backgroundColor: "#fdf3d7" }]}>
              <Ionicons name="pricetag-outline" size={16} color="#7a5b1a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>@{item.slug} · {item.total_followers ?? 0} followers</Text>
            </View>
            <Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}>
              {item.status}
            </Badge>
          </View>
          {item.status === "pending" && (
            <View style={styles.itemActions}>
              <Pressable onPress={() => onApprove(item.id)} style={[styles.btn, styles.btnApprove]}>
                <Ionicons name="checkmark" size={13} color="#fff" />
                <Text style={styles.btnApproveText}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => onReject(item.id)} style={[styles.btn, styles.btnReject]}>
                <Ionicons name="close" size={13} color={colors.light.destructive} />
                <Text style={styles.btnRejectText}>Reject</Text>
              </Pressable>
            </View>
          )}
        </Card>
      )}
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
      renderItem={({ item, index }: any) => (
        <Card style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={[styles.productAvatar, { backgroundColor: "#dde4d6" }]}>
              <Ionicons name="albums-outline" size={16} color={colors.olive[800]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                @{item.slug} · {item.gender ?? "all"} · {item.product_count ?? 0} products
              </Text>
            </View>
            <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "active" : "inactive"}</Badge>
          </View>
        </Card>
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
      renderItem={({ item }: any) => (
        <Card style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={[styles.productAvatar, { backgroundColor: "#fbe5dc" }]}>
              <Ionicons name="images-outline" size={16} color="#7a2f1a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.position ?? "hero"} · order {item.display_order}</Text>
            </View>
            <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "live" : "off"}</Badge>
          </View>
        </Card>
      )}
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
    padding: 14,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  productAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  btnApprove: {
    backgroundColor: colors.olive[600],
    borderColor: colors.olive[600],
  },
  btnApproveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#fff",
  },
  btnReject: {
    backgroundColor: colors.light.card,
    borderColor: colors.light.border,
  },
  btnRejectText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.light.destructive,
  },
});
