import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppHeader, PaperBackground } from "@/components/layout";
import { Card } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { getStores, getFeaturedStores } from "@/lib/api";
import { useTrackEvent } from "@/lib/recommender";
import type { Store } from "@/lib/types";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Sort = "popular" | "newest" | "rating";
const SORTS: { key: Sort; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "newest", label: "New" },
  { key: "rating", label: "Top rated" },
];

export default function StoresDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tracker = useTrackEvent();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [stores, setStores] = useState<Store[]>([]);
  const [featured, setFeatured] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Screen-view: fire once on mount.
  useEffect(() => {
    tracker.screen("stores_directory");
  }, []);

  const load = useCallback(async () => {
    const [all, feat] = await Promise.all([
      getStores({ search: search.trim() || undefined, sort, limit: 50 }),
      search.trim().length === 0 ? getFeaturedStores(8) : Promise.resolve({ ok: true, data: [] } as any),
    ]);
    if (all.ok) setStores(all.data.stores);
    if (feat.ok) setFeatured(feat.data);
    setLoading(false);
    setRefreshing(false);
  }, [search, sort]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderItem = ({ item }: { item: Store }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        tracker.action("store_clicked", { storeSlug: item.slug });
        router.push(`/(main)/stores/${item.slug}` as never);
      }}
      style={styles.row}
    >
      {item.logo_url ? (
        <Image
          source={{ uri: resolveImageUrl(item.logo_url) ?? item.logo_url }}
          style={styles.logo}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Ionicons name="storefront-outline" size={22} color={colors.light.mutedForeground} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Body size="sm" style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Body>
        {item.description ? (
          <Body muted size="xs" numberOfLines={2}>
            {item.description}
          </Body>
        ) : null}
        <View style={styles.rowMeta}>
          <Ionicons name="star" size={11} color={colors.accent2.ochre} />
          <Label style={styles.rowMetaText}>
            {item.rating?.toFixed(1) ?? "—"}
          </Label>
          <View style={styles.dot} />
          <Ionicons name="cube-outline" size={11} color={colors.light.mutedForeground} />
          <Label style={styles.rowMetaText}>
            {item.total_products ?? 0} items
          </Label>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <PaperBackground>
      <AppHeader showSearch />
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={16} color={colors.light.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search ateliers and stores"
            placeholderTextColor={colors.light.mutedForeground}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.sortBar}>
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sortPill, sort === s.key && styles.sortPillActive]}
            onPress={() => setSort(s.key)}
          >
            <Label style={[styles.sortPillText, sort === s.key && styles.sortPillTextActive]}>
              {s.label}
            </Label>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 24 },
        ]}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          !search && featured.length > 0 ? (
            <View style={styles.featuredBlock}>
              <Display size="lg" style={styles.featuredTitle}>
                Featured ateliers
              </Display>
              <Body muted size="sm" style={styles.featuredSub}>
                Hand-picked stores shipping right now.
              </Body>
              <FlatList
                horizontal
                data={featured}
                keyExtractor={(s) => `f-${s.id}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredScroll}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.featuredCard}
                    onPress={() => router.push(`/(main)/stores/${item.slug}` as never)}
                  >
                    {item.banner_url ? (
                      <Image
                        source={{ uri: resolveImageUrl(item.banner_url) ?? item.banner_url }}
                        style={styles.featuredBanner}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.featuredBanner, styles.featuredBannerFallback]}>
                        <Ionicons name="storefront-outline" size={28} color={colors.light.mutedForeground} />
                      </View>
                    )}
                    <View style={styles.featuredBody}>
                      <Body size="sm" style={styles.featuredName} numberOfLines={1}>
                        {item.name}
                      </Body>
                      <Label style={styles.featuredMeta}>
                        ★ {item.rating?.toFixed(1) ?? "—"}
                      </Label>
                    </View>
                  </TouchableOpacity>
                )}
              />
              <Display size="md" style={styles.allTitle}>
                All stores
              </Display>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={28} color={colors.light.mutedForeground} />
              <Display size="md" style={styles.emptyTitle}>
                {search ? "No matches" : "No stores yet"}
              </Display>
              <Body muted size="sm" style={styles.emptyCopy}>
                {search
                  ? `Nothing matches “${search}”. Try a different name.`
                  : "Approved stores will appear here as they come online."}
              </Body>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  searchBar: { paddingHorizontal: 20, paddingBottom: spacing[2] },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
    padding: 0,
  },
  sortBar: {
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: 20,
    paddingBottom: spacing[3],
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  sortPillActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  sortPillText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  sortPillTextActive: { color: colors.light.primaryForeground },
  list: { paddingHorizontal: 20, paddingTop: spacing[2] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
  },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  rowName: { fontFamily: fontFamilies.sans.semibold },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  rowMetaText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginLeft: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.light.mutedForeground,
    marginHorizontal: 4,
  },
  sep: { height: spacing[2] },
  featuredBlock: { gap: spacing[2], marginBottom: spacing[3] },
  featuredTitle: { marginTop: spacing[2] },
  featuredSub: {},
  featuredScroll: { gap: spacing[3], paddingVertical: spacing[2] },
  featuredCard: {
    width: 220,
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  featuredBanner: { width: "100%", height: 110 },
  featuredBannerFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[100],
  },
  featuredBody: { padding: spacing[3] },
  featuredName: { fontFamily: fontFamilies.sans.semibold },
  featuredMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  allTitle: { marginTop: spacing[3], fontSize: typography.fontSizes.lg },
  empty: {
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[8],
  },
  emptyTitle: { fontSize: typography.fontSizes.lg },
  emptyCopy: { textAlign: "center" },
});
