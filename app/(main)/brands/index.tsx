import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { AppHeader, PaperBackground } from "@/components/layout";
import { BrandCard } from "@/components/brand/BrandCard";
import { Body, Display, Label } from "@/components/ui/Typography";
import { Skeleton } from "@/components/ui/Skeleton";
import { getBrands, getFeaturedBrands } from "@/lib/api";
import { useTrackEvent } from "@/lib/recommender";
import type { Brand } from "@/lib/types";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandsIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tracker = useTrackEvent();
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [featured, setFeatured] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    tracker.screen("brands_directory");
  }, [tracker]);

  const load = useCallback(async () => {
    const [all, feat] = await Promise.all([
      getBrands({ search: search.trim() || undefined, limit: 100 }),
      search.trim().length === 0 ? getFeaturedBrands(8) : Promise.resolve({ ok: true, data: [] } as never),
    ]);
    if (all.ok) setBrands(all.data);
    if (feat.ok) setFeatured(feat.data);
    setLoading(false);
    setRefreshing(false);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const go = useCallback(
    (slug: string) => {
      tracker.action("brand_clicked", { brandSlug: slug });
      router.push(`/(main)/brands/${slug}` as never);
    },
    [router, tracker],
  );

  const renderItem = useCallback(
    ({ item }: { item: Brand }) => (
      <BrandCard brand={item} onPress={() => go(item.slug)} />
    ),
    [go],
  );

  const headerFeatured = useMemo(
    () =>
      !search && featured.length > 0 ? (
        <View style={styles.featuredBlock}>
          <Display size="lg" style={styles.featuredTitle}>
            Featured labels
          </Display>
          <Body muted size="sm" style={styles.featuredSub}>
            Editorial picks shipping right now.
          </Body>
          <FlatList
            horizontal
            data={featured}
            keyExtractor={(b) => `f-${b.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredScroll}
            renderItem={({ item }) => (
              <BrandCard brand={item} variant="compact" onPress={() => go(item.slug)} />
            )}
          />
          <Display size="md" style={styles.allTitle}>
            All brands
          </Display>
        </View>
      ) : null,
    [search, featured, go],
  );

  const empty = !loading ? (
    <View style={styles.empty}>
      <Ionicons name="ribbon-outline" size={28} color={colors.light.mutedForeground} />
      <Display size="md" style={styles.emptyTitle}>
        {search ? "No matches" : "No brands yet"}
      </Display>
      <Body muted size="sm" style={styles.emptyCopy}>
        {search
          ? `Nothing matches “${search}”. Try a different name.`
          : "Approved brands will appear here as they onboard."}
      </Body>
    </View>
  ) : null;

  return (
    <PaperBackground>
      <AppHeader showSearch />
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={16} color={colors.light.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search brands"
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

      {loading && brands.length === 0 ? (
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={120} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <FlatList
          data={brands}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={headerFeatured}
          ListEmptyComponent={empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
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
  list: { paddingHorizontal: 20, paddingTop: spacing[2] },
  sep: { height: spacing[2] },
  featuredBlock: { gap: spacing[2], marginBottom: spacing[3] },
  featuredTitle: { marginTop: spacing[2] },
  featuredSub: {},
  featuredScroll: { gap: spacing[3], paddingVertical: spacing[2] },
  allTitle: { marginTop: spacing[3], fontSize: typography.fontSizes.lg },
  empty: { alignItems: "center", gap: spacing[2], padding: spacing[8] },
  emptyTitle: { fontSize: typography.fontSizes.lg },
  emptyCopy: { textAlign: "center" },
  skeletonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
    paddingHorizontal: 20,
  },
  skeletonCard: { width: "47%", borderRadius: radii.xl },
});