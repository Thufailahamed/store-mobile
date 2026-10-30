import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminProducts,
  getAdminBrands,
  getAdminCategoriesEnriched,
  getAdminBanners,
  approveBrand,
  approveProduct,
} from "@/lib/api";
import { Skeleton, useToast } from "@/components/ui";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, resolveImageUrl } from "@/lib/utils";
import {
  INK,
  LIME,
  HAIRLINE,
  STATUS_TONE,
  cardSurface,
  Chip,
  SearchBar,
  Empty,
  StatusPill,
  SectionCount,
  kit,
} from "@/components/admin/catalog-kit";

function primaryImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const primary = images.find((i: any) => i?.is_primary) ?? images[0];
  const url = primary?.url;
  return typeof url === "string" && url ? resolveImageUrl(url) || url : null;
}

const initialsOf = (name?: string | null) =>
  (name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const TABS = [
  { key: "products", label: "Products", icon: "cube-outline" as const },
  { key: "brands", label: "Brands", icon: "pricetag-outline" as const },
  { key: "categories", label: "Categories", icon: "albums-outline" as const },
  { key: "banners", label: "Banners", icon: "images-outline" as const },
];

const PRODUCT_TABS = ["all", "active", "pending", "draft", "archived"];
const BRAND_TABS = ["all", "approved", "pending", "rejected"];

const SUB_LABEL: Record<string, string> = { all: "All", active: "Live" };

export default function CatalogueHub() {
  const router = useRouter();
  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [sub, setSub] = useState("all");

  // Shared header — rendered inside each list so the whole page scrolls.
  const header = (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>INVENTORY & MERCHANDISING</Text>
          </View>
          <Text style={styles.title}>Catalogue</Text>
          <Text style={styles.subtitle}>Moderate listings and labels, shape categories, curate what shoppers see first.</Text>
        </View>
        <Pressable
          onPress={() => router.push("/(admin)/products" as any)}
          style={({ pressed }) => [styles.roundBtn, pressed && kit.pressed]}
          accessibilityLabel="Open boutique view"
        >
          <Ionicons name="grid-outline" size={17} color={INK} />
        </Pressable>
      </View>

      {/* Section switch */}
      <View style={styles.segment}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                setTab(t.key);
                setSub("all");
                setSearch("");
              }}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={t.icon} size={16} color={on ? LIME : colors.ink.mute} />
              <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {(tab === "products" || tab === "brands") && (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder={`Search ${tab}…`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(tab === "products" ? PRODUCT_TABS : BRAND_TABS).map((t) => (
              <Chip
                key={t}
                label={SUB_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1)}
                dot={t !== "all" ? STATUS_TONE[t]?.dot : undefined}
                active={sub === t}
                onPress={() => setSub(t)}
              />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {tab === "products" && <ProductsList header={header} search={search} status={sub} onReset={() => { setSearch(""); setSub("all"); }} />}
      {tab === "brands" && <BrandsList header={header} search={search} status={sub} onReset={() => { setSearch(""); setSub("all"); }} />}
      {tab === "categories" && <CategoriesList header={header} />}
      {tab === "banners" && <BannersList header={header} />}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Moderation actions                                                        */
/* -------------------------------------------------------------------------- */

function useModerate(kind: "product" | "brand") {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const res =
        kind === "product"
          ? await approveProduct(id, approve ? "active" : "rejected")
          : await approveBrand(id, approve ? "approved" : "rejected");
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: (_r, { approve }) => {
      qc.invalidateQueries({ queryKey: kind === "product" ? ["cat-products"] : ["cat-brands"] });
      if (kind === "product") {
        qc.invalidateQueries({ queryKey: ["admin-products"] });
        qc.invalidateQueries({ queryKey: ["admin-catalog-stores"] });
      }
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(approve ? `${kind === "product" ? "Listing" : "Brand"} approved` : `${kind === "product" ? "Listing" : "Brand"} rejected`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });
}

function ModerationBar({
  approveLabel,
  busy,
  onApprove,
  onReject,
}: {
  approveLabel: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.modBar}>
      <View style={styles.modHint}>
        <View style={styles.modHintDot} />
        <Text style={styles.modHintText}>AWAITING REVIEW</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        disabled={busy}
        onPress={onReject}
        style={({ pressed }) => [styles.rejectBtn, (pressed || busy) && kit.pressed]}
        accessibilityLabel="Reject"
      >
        <Ionicons name="close" size={16} color="#b03a3a" />
      </Pressable>
      <Pressable
        disabled={busy}
        onPress={onApprove}
        style={({ pressed }) => [styles.approveBtn, (pressed || busy) && kit.pressed]}
      >
        <Ionicons name="checkmark" size={14} color={LIME} />
        <Text style={styles.approveText}>{approveLabel}</Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lists                                                                     */
/* -------------------------------------------------------------------------- */

function ProductsList({ header, search, status, onReset }: { header: React.ReactElement; search: string; status: string; onReset: () => void }) {
  const router = useRouter();
  const moderate = useModerate("product");
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
  const total = q.data?.total ?? products.length;

  return (
    <FlatList
      data={products}
      keyExtractor={(p: any) => p.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.olive[800]} />}
      ListHeaderComponent={
        <View>
          {header}
          {!q.isLoading && (
            <SectionCount>
              {total} {total === 1 ? "PRODUCT" : "PRODUCTS"}
            </SectionCount>
          )}
        </View>
      }
      ListEmptyComponent={
        q.isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={122} style={{ borderRadius: 24 }} />
            ))}
          </View>
        ) : loadError ? (
          <Empty icon="cloud-offline-outline" title="Couldn't load products" body={loadError} actionLabel="Retry" onReset={() => q.refetch()} />
        ) : (
          <Empty
            icon="cube-outline"
            title="No products found"
            body="Nothing matches your current search or status."
            onReset={search || status !== "all" ? onReset : undefined}
          />
        )
      }
      renderItem={({ item, index }: any) => {
        const img = primaryImage(item.images);
        const pending = item.status === "pending";
        const mrp = Number(item.mrp ?? 0);
        const price = Number(item.price ?? 0);
        const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
        const label = [item.store?.name, item.brand?.name].filter(Boolean).join(" · ") || "Independent atelier";
        const busy = moderate.isPending && moderate.variables?.id === item.id;
        return (
          <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 40)}>
            <View style={[styles.card, pending && styles.cardPending]}>
              <Pressable
                onPress={() => router.push({ pathname: "/(admin)/products/[id]", params: { id: item.id } } as any)}
                style={({ pressed }) => [styles.productRow, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.thumb}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.thumbImg} contentFit="cover" transition={200} />
                  ) : (
                    <View style={styles.thumbEmpty}>
                      <Ionicons name="image-outline" size={20} color="rgba(22,23,15,0.25)" />
                    </View>
                  )}
                  {item.is_featured && (
                    <View style={styles.thumbStar}>
                      <Ionicons name="star" size={9} color={INK} />
                    </View>
                  )}
                </View>
                <View style={styles.productInfo}>
                  <View style={styles.productTop}>
                    <Text style={styles.productLabel} numberOfLines={1}>{label.toUpperCase()}</Text>
                    <StatusPill status={item.status} />
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{formatPrice(price, item.currency)}</Text>
                    {discount > 0 && (
                      <>
                        <Text style={styles.mrp}>{formatPrice(mrp, item.currency)}</Text>
                        <Text style={styles.discount}>−{discount}%</Text>
                      </>
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    {item.category?.name ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="albums-outline" size={11} color="rgba(22,23,15,0.4)" />
                        <Text style={styles.metaText}>{item.category.name}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.metaText}>{item.total_sales ?? 0} sold</Text>
                    <View style={{ flex: 1 }} />
                    <Ionicons name="arrow-forward" size={14} color="rgba(22,23,15,0.35)" />
                  </View>
                </View>
              </Pressable>
              {pending && (
                <ModerationBar
                  approveLabel="Approve listing"
                  busy={busy}
                  onApprove={() => moderate.mutate({ id: item.id, approve: true })}
                  onReject={() => moderate.mutate({ id: item.id, approve: false })}
                />
              )}
            </View>
          </Animated.View>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BrandsList({ header, search, status, onReset }: { header: React.ReactElement; search: string; status: string; onReset: () => void }) {
  const router = useRouter();
  const moderate = useModerate("brand");
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
  const total = q.data?.total ?? brands.length;

  return (
    <FlatList
      data={brands}
      keyExtractor={(b: any) => b.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.olive[800]} />}
      ListHeaderComponent={
        <View>
          {header}
          {!q.isLoading && <SectionCount>{total} {total === 1 ? "LABEL" : "LABELS"}</SectionCount>}
        </View>
      }
      ListEmptyComponent={
        q.isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={96} style={{ borderRadius: 24 }} />
            ))}
          </View>
        ) : loadError ? (
          <Empty icon="cloud-offline-outline" title="Couldn't load brands" body={loadError} actionLabel="Retry" onReset={() => q.refetch()} />
        ) : (
          <Empty
            icon="pricetag-outline"
            title="No brands found"
            body="No labels match your search or filter."
            onReset={search || status !== "all" ? onReset : undefined}
          />
        )
      }
      renderItem={({ item, index }: any) => {
        const logo = item.logo_url ? resolveImageUrl(item.logo_url) || item.logo_url : null;
        const pending = item.status === "pending";
        const busy = moderate.isPending && moderate.variables?.id === item.id;
        return (
          <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 40)}>
            <View style={[styles.card, pending && styles.cardPending]}>
              <Pressable
                onPress={() => router.push({ pathname: "/(admin)/brands/[id]", params: { id: item.id } } as any)}
                style={({ pressed }) => [styles.brandRow, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.brandLogo}>
                  {logo ? (
                    <Image source={{ uri: logo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Text style={styles.brandInitials}>{initialsOf(item.name)}</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.productTop}>
                    <Text style={styles.productLabel} numberOfLines={1}>@{(item.slug ?? "").toUpperCase()}</Text>
                    <StatusPill status={item.status} />
                  </View>
                  <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.brandStats}>
                    <BrandStat icon="people-outline" value={item.total_followers ?? 0} label="followers" />
                    <BrandStat icon="cube-outline" value={item.total_products ?? 0} label="products" />
                    <View style={{ flex: 1 }} />
                    <Ionicons name="arrow-forward" size={14} color="rgba(22,23,15,0.35)" />
                  </View>
                </View>
              </Pressable>
              {pending && (
                <ModerationBar
                  approveLabel="Approve brand"
                  busy={busy}
                  onApprove={() => moderate.mutate({ id: item.id, approve: true })}
                  onReject={() => moderate.mutate({ id: item.id, approve: false })}
                />
              )}
            </View>
          </Animated.View>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BrandStat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={11} color="rgba(22,23,15,0.4)" />
      <Text style={styles.metaStrong}>{Number(value).toLocaleString()}</Text>
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function CategoriesList({ header }: { header: React.ReactElement }) {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["cat-categories"],
    queryFn: async () => {
      const r = await getAdminCategoriesEnriched();
      return r.ok ? r.data : [];
    },
  });
  const data = (q.data ?? []) as any[];
  const max = Math.max(1, ...data.map((c) => Number(c.product_count ?? 0)));
  return (
    <FlatList
      data={data}
      keyExtractor={(c: any) => c.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.olive[800]} />}
      ListHeaderComponent={
        <View>
          {header}
          <Pressable
            onPress={() => router.push("/(admin)/categories" as never)}
            style={({ pressed }) => [styles.manageCard, pressed && kit.pressedCard]}
          >
            <View style={styles.manageIcon}>
              <Ionicons name="git-network-outline" size={18} color={LIME} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.manageKicker}>STRUCTURE</Text>
              <Text style={styles.manageTitle}>Manage hierarchy & order</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.paper.cream} />
          </Pressable>
          {!q.isLoading && <SectionCount>{data.length} CATEGORIES</SectionCount>}
        </View>
      }
      ListEmptyComponent={
        q.isLoading ? (
          <Skeleton width="100%" height={76} style={{ borderRadius: 22 }} />
        ) : (
          <Empty icon="albums-outline" title="No categories" body="Create categories from the hierarchy manager." />
        )
      }
      renderItem={({ item, index }: any) => {
        const count = Number(item.product_count ?? 0);
        return (
          <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 30)}>
            <View style={[styles.card, styles.categoryRow]}>
              <View style={[styles.categoryIcon, !item.is_active && { opacity: 0.5 }]}>
                <Text style={styles.categoryInitial}>{(item.name ?? "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.productTop}>
                  <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.activeDot, { backgroundColor: item.is_active ? "#22a35a" : "rgba(22,23,15,0.2)" }]} />
                </View>
                <Text style={styles.metaText} numberOfLines={1}>
                  @{item.slug} · {item.gender ?? "all genders"}
                </Text>
                <View style={styles.categoryBarTrack}>
                  <View style={[styles.categoryBarFill, { width: `${(count / max) * 100}%` }]} />
                </View>
              </View>
              <View style={styles.categoryCount}>
                <Text style={styles.categoryCountValue}>{count}</Text>
                <Text style={styles.categoryCountLabel}>ITEMS</Text>
              </View>
            </View>
          </Animated.View>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BannersList({ header }: { header: React.ReactElement }) {
  const q = useQuery({
    queryKey: ["cat-banners"],
    queryFn: async () => {
      const r = await getAdminBanners();
      return r.ok ? r.data : [];
    },
  });
  const data = (q.data ?? []) as any[];
  return (
    <FlatList
      data={data}
      keyExtractor={(b: any) => b.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.olive[800]} />}
      ListHeaderComponent={
        <View>
          {header}
          {!q.isLoading && (
            <SectionCount>
              {data.length} BANNERS · {data.filter((b) => b.is_active).length} LIVE
            </SectionCount>
          )}
        </View>
      }
      ListEmptyComponent={
        q.isLoading ? (
          <Skeleton width="100%" height={170} style={{ borderRadius: 24 }} />
        ) : (
          <Empty icon="images-outline" title="No banners" body="Hero, grid and marquee banners will appear here." />
        )
      }
      renderItem={({ item, index }: any) => {
        const img = item.image_url ? resolveImageUrl(item.image_url) || item.image_url : null;
        return (
          <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 40)}>
            <View style={[styles.card, styles.bannerCard]}>
              <View style={styles.bannerImage}>
                {img ? (
                  <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : (
                  <LinearGradient colors={["#e6e6d0", "#cccca0"]} style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]} style={StyleSheet.absoluteFill} />
                <View style={styles.bannerTop}>
                  <View style={styles.bannerChip}>
                    <Text style={styles.bannerChipText}>{String(item.position ?? "hero").replace(/_/g, " ").toUpperCase()}</Text>
                  </View>
                  <View style={styles.bannerChip}>
                    <Text style={styles.bannerChipText}>#{item.display_order ?? 0}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <StatusPill status={item.is_active ? "live" : "off"} />
                </View>
                <Text style={styles.bannerTitle} numberOfLines={2}>{item.title || "Untitled banner"}</Text>
              </View>
            </View>
          </Animated.View>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingHorizontal: 18, paddingBottom: 120 },

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

  /* Section switch */
  segment: {
    flexDirection: "row", padding: 4, borderRadius: 24, marginBottom: 14, gap: 2,
    backgroundColor: "rgba(239,236,226,0.8)", borderWidth: 1, borderColor: HAIRLINE,
  },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 56, borderRadius: 20 },
  segmentItemOn: { backgroundColor: INK, ...shadows.soft },
  segmentText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.ink.mute },
  segmentTextOn: { color: colors.paper.cream },
  chips: { gap: 7, paddingBottom: 14 },

  /* Shared card */
  card: { ...cardSurface, borderRadius: 24, marginBottom: 12, overflow: "hidden" },
  cardPending: { borderColor: "rgba(224,165,38,0.45)" },

  /* Products */
  productRow: { flexDirection: "row", gap: 13, padding: 10 },
  thumb: { width: 80, height: 100, borderRadius: 18, overflow: "hidden", backgroundColor: colors.paper.warm },
  thumbImg: { width: "100%", height: "100%" },
  thumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  thumbStar: {
    position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: LIME,
    alignItems: "center", justifyContent: "center",
  },
  productInfo: { flex: 1, paddingTop: 4, paddingRight: 4 },
  productTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  productLabel: { flex: 1, fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.5, color: colors.olive[700] },
  productName: { marginTop: 5, fontFamily: fontFamilies.display.regular, fontSize: 17, lineHeight: 21, letterSpacing: -0.3, color: INK },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 5 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: INK },
  mrp: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: "rgba(22,23,15,0.4)", textDecorationLine: "line-through" },
  discount: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.accent2.rust },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 7 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: "rgba(22,23,15,0.5)" },
  metaStrong: { fontFamily: fontFamilies.sans.bold, fontSize: 11.5, color: INK },

  /* Moderation bar */
  modBar: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "rgba(253,246,227,0.7)", borderTopWidth: 1, borderTopColor: "rgba(224,165,38,0.25)",
  },
  modHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  modHintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e0a526" },
  modHintText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.4, color: "#8a6116" },
  rejectBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(176,58,58,0.25)",
  },
  approveBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: INK,
  },
  approveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: colors.paper.cream },

  /* Brands */
  brandRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 12 },
  brandLogo: {
    width: 64, height: 64, borderRadius: 20, overflow: "hidden", backgroundColor: INK,
    alignItems: "center", justifyContent: "center",
  },
  brandInitials: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: LIME },
  brandName: { marginTop: 4, fontFamily: fontFamilies.display.regular, fontSize: 20, letterSpacing: -0.4, color: INK },
  brandStats: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },

  /* Categories */
  manageCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12, paddingRight: 16, borderRadius: 22,
    backgroundColor: INK, marginBottom: 16, ...shadows.editorial,
  },
  manageIcon: {
    width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(200,224,138,0.12)", borderWidth: 1, borderColor: "rgba(200,224,138,0.25)",
  },
  manageKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, letterSpacing: 1.8, color: LIME },
  manageTitle: { marginTop: 2, fontFamily: fontFamilies.display.regular, fontSize: 18, color: colors.paper.cream },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 12, borderRadius: 22, marginBottom: 10 },
  categoryIcon: {
    width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.olive[50], borderWidth: 1, borderColor: "rgba(83,94,44,0.12)",
  },
  categoryInitial: { fontFamily: fontFamilies.display.regular, fontSize: 20, color: colors.olive[800] },
  categoryName: { flex: 1, fontFamily: fontFamilies.display.regular, fontSize: 17, letterSpacing: -0.3, color: INK },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  categoryBarTrack: { height: 3, borderRadius: 2, marginTop: 8, backgroundColor: "rgba(22,23,15,0.06)", overflow: "hidden" },
  categoryBarFill: { height: "100%", borderRadius: 2, backgroundColor: colors.olive[500] },
  categoryCount: { alignItems: "flex-end", minWidth: 44 },
  categoryCountValue: { fontFamily: fontFamilies.display.regular, fontSize: 24, lineHeight: 26, color: INK },
  categoryCountLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 8, letterSpacing: 1.4, color: "rgba(22,23,15,0.4)" },

  /* Banners */
  bannerCard: { padding: 7, borderRadius: 26 },
  bannerImage: { aspectRatio: 16 / 8, borderRadius: 20, overflow: "hidden", justifyContent: "space-between", padding: 12 },
  bannerTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  bannerChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(245,244,239,0.92)" },
  bannerChipText: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.4, color: "rgba(22,23,15,0.75)" },
  bannerTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, color: "#fff" },
});
