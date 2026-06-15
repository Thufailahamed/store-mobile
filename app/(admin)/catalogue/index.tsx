import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, TextInput, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  getAdminProducts,
  getAdminBrands,
  getAdminCategories,
  getAdminBanners,
  approveBrand,
  approveProduct,
} from "@/lib/api";
import { Card, ListRow, EmptyState, Chip, Skeleton, Badge } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TABS = [
  { key: "products", label: "Products", icon: "cube-outline" as const },
  { key: "brands", label: "Brands", icon: "pricetag-outline" as const },
  { key: "categories", label: "Categories", icon: "albums-outline" as const },
  { key: "banners", label: "Banners", icon: "images-outline" as const },
];

const PRODUCT_TABS = ["all", "active", "pending", "draft", "archived"];
const BRAND_TABS = ["all", "approved", "pending", "rejected"];

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function CatalogueHub() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [sub, setSub] = useState("all");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CATALOGUE</Text>
        <Text style={styles.title}>Inventory</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => { setTab(t.key); setSub("all"); setSearch(""); }} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Ionicons name={t.icon} size={14} color={tab === t.key ? "#fff" : colors.light.mutedForeground} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        style={styles.search}
        placeholder={`Search ${tab}…`}
        placeholderTextColor={colors.light.muted}
        value={search}
        onChangeText={setSearch}
      />

      {tab === "products" && (
        <ProductsList search={search} status={sub} onApprove={(id: string) => approveProduct(id, "active")} onReject={(id: string) => approveProduct(id, "rejected")} statusTabs={PRODUCT_TABS} sub={sub} setSub={setSub} />
      )}
      {tab === "brands" && (
        <BrandsList search={search} status={sub} onApprove={(id: string) => approveBrand(id, "approved")} onReject={(id: string) => approveBrand(id, "rejected")} statusTabs={BRAND_TABS} sub={sub} setSub={setSub} />
      )}
      {tab === "categories" && <CategoriesList />}
      {tab === "banners" && <BannersList />}
    </View>
  );
}

function SubFilters({ tabs, sub, setSub }: { tabs: string[]; sub: string; setSub: (s: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {tabs.map((t) => (
        <Pressable key={t} onPress={() => setSub(t)} style={[styles.chip, sub === t && styles.chipActive]}>
          <Text style={[styles.chipText, sub === t && styles.chipTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
        </Pressable>
      ))}
    </ScrollView>
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
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
      ListHeaderComponent={<SubFilters tabs={statusTabs} sub={sub} setSub={setSub} />}
      ListEmptyComponent={q.isLoading ? <View style={styles.list}><Skeleton height={64} /><Skeleton height={64} style={{ marginTop: 8 }} /></View> : <EmptyState icon="cube-outline" title="No products" description="No products match your filters." />}
      renderItem={({ item, index }: any) => (
        <Pressable onPress={() => router.push({ pathname: "/(admin)/products/[id]", params: { id: item.id } } as any)}>
          <Card style={styles.item}>
            <View style={styles.itemRow}>
              <Text style={styles.itemIndex}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.store?.name ?? "—"} {item.brand?.name ? `· ${item.brand.name}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.itemPrice}>LKR {item.price.toLocaleString()}</Text>
                <Badge variant={item.status === "active" ? "default" : item.status === "pending" ? "secondary" : "outline"}>
                  {item.status}
                </Badge>
              </View>
            </View>
            {item.status === "pending" && (
              <View style={styles.itemActions}>
                <Pressable onPress={() => onApprove(item.id)} style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnPrimaryText}>Approve</Text>
                </Pressable>
                <Pressable onPress={() => onReject(item.id)} style={styles.btn}>
                  <Text style={styles.btnText}>Reject</Text>
                </Pressable>
              </View>
            )}
          </Card>
        </Pressable>
      )}
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
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
      ListHeaderComponent={<SubFilters tabs={statusTabs} sub={sub} setSub={setSub} />}
      ListEmptyComponent={q.isLoading ? <View style={styles.list}><Skeleton height={64} /></View> : <EmptyState icon="pricetag-outline" title="No brands" />}
      renderItem={({ item, index }: any) => (
        <Card style={styles.item}>
          <View style={styles.itemRow}>
            <Text style={styles.itemIndex}>{String(index + 1).padStart(2, "0")}</Text>
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
              <Pressable onPress={() => onApprove(item.id)} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => onReject(item.id)} style={styles.btn}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            </View>
          )}
        </Card>
      )}
    />
  );
}

function CategoriesList() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cat-categories"],
    queryFn: async () => {
      const r = await getAdminCategories();
      return r.ok ? r.data : [];
    },
  });
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(c: any) => c.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
      ListEmptyComponent={q.isLoading ? <Skeleton height={64} /> : <EmptyState icon="albums-outline" title="No categories" />}
      renderItem={({ item, index }: any) => (
        <Card style={styles.item}>
          <View style={styles.itemRow}>
            <Text style={styles.itemIndex}>{String(item.position ?? index + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>@{item.slug} · {item.gender ?? "all"}</Text>
            </View>
            <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "active" : "inactive"}</Badge>
          </View>
        </Card>
      )}
    />
  );
}

function BannersList() {
  const qc = useQueryClient();
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
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
      ListEmptyComponent={q.isLoading ? <Skeleton height={64} /> : <EmptyState icon="images-outline" title="No banners" />}
      renderItem={({ item, index }: any) => (
        <Card style={styles.item}>
          <View style={styles.itemRow}>
            <Text style={styles.itemIndex}>{String(index + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.position ?? "hero"} · order {item.display_order}</Text>
            </View>
            <Badge variant={item.is_active ? "default" : "outline"}>{item.is_active ? "live" : "off"}</Badge>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  tabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  tabActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  tabText: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.light.mutedForeground, letterSpacing: 0.5 },
  tabTextActive: { color: "#fff" },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    fontSize: 14,
    color: colors.light.foreground,
  },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  item: { padding: 14, ...shadows.soft },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemIndex: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  itemName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  itemMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  itemPrice: { fontFamily: fontFamilies.display.semibold, fontSize: 14, color: colors.light.foreground },
  itemActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  btnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.light.foreground, letterSpacing: 0.5, textTransform: "uppercase" },
  btnPrimaryText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" },
});
