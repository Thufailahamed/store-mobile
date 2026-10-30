import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { AppHeader, PaperBackground } from "@/components/layout";
import { Body, Display, Label } from "@/components/ui/Typography";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStores, getFeaturedStores } from "@/lib/api";
import { useTrackEvent } from "@/lib/recommender";
import type { Store } from "@/lib/types";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Sort = "popular" | "newest" | "rating";
const SORTS: { key: Sort; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "newest", label: "New" },
  { key: "rating", label: "Top rated" },
];

const GUTTER = 20;
const pad2 = (n: number) => String(n).padStart(2, "0");
const img = (u?: string) => (u ? resolveImageUrl(u) ?? u : undefined);

/** A 0.0 rating with no reviews reads as "bad" — call it new instead. */
function ratingLabel(s: Store): string | null {
  if (!s.total_reviews || !s.rating) return null;
  return s.rating.toFixed(1);
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export default function StoresDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tracker = useTrackEvent();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [stores, setStores] = useState<Store[]>([]);
  const [featured, setFeatured] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focused, setFocused] = useState(false);

  const cardW = Math.min(width * 0.78, 320);
  const searching = search.trim().length > 0;

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

  const open = useCallback(
    (item: Store) => {
      tracker.action("store_clicked", { storeSlug: item.slug });
      router.push(`/(main)/stores/${item.slug}` as never);
    },
    [router, tracker],
  );

  const renderItem = ({ item, index }: { item: Store; index: number }) => {
    const rating = ratingLabel(item);
    return (
      <Pressable
        onPress={() => open(item)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Label style={styles.rowIndex}>{pad2(index + 1)}</Label>
        <View style={styles.logoFrame}>
          {item.logo_url ? (
            <Image source={{ uri: img(item.logo_url) }} style={styles.logo} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Display size="xl" style={styles.monogram}>
                {item.name.charAt(0).toUpperCase()}
              </Display>
            </View>
          )}
        </View>
        <View style={styles.rowBody}>
          <Display size="lg" style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Display>
          {item.description ? (
            <Body muted size="sm" italic style={styles.rowDesc} numberOfLines={1}>
              {item.description}
            </Body>
          ) : null}
          <View style={styles.rowMeta}>
            {rating ? (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={10} color={colors.accent2.ochre} />
                <Label style={styles.metaText}>{rating}</Label>
              </View>
            ) : (
              <View style={styles.newTag}>
                <Label style={styles.newTagText}>New</Label>
              </View>
            )}
            <View style={styles.dot} />
            <Label style={styles.metaText}>
              {item.total_products ?? 0} {item.total_products === 1 ? "piece" : "pieces"}
            </Label>
            {item.total_followers ? (
              <>
                <View style={styles.dot} />
                <Label style={styles.metaText}>{compact(item.total_followers)} followers</Label>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={14} color={colors.ink.DEFAULT} />
        </View>
      </Pressable>
    );
  };

  const renderFeatured = ({ item, index }: { item: Store; index: number }) => {
    const rating = ratingLabel(item);
    return (
      <Pressable
        onPress={() => open(item)}
        style={({ pressed }) => [styles.featuredCard, { width: cardW }, pressed && styles.pressed]}
      >
        <View style={[styles.featuredMedia, { height: Math.round(cardW * 0.62) }]}>
          {item.banner_url ? (
            <Image source={{ uri: img(item.banner_url) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          ) : (
            <LinearGradient
              colors={[colors.olive[500], colors.olive[800]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.featuredFallback]}
            >
              <Display size="5xl" italic style={styles.featuredMonogram}>
                {item.name.charAt(0).toUpperCase()}
              </Display>
            </LinearGradient>
          )}
          <View style={styles.featuredTop}>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Label style={styles.badgeText}>Featured</Label>
            </View>
            <View style={styles.indexPill}>
              <Label style={styles.featuredIndex}>
                {pad2(index + 1)}/{pad2(featured.length)}
              </Label>
            </View>
          </View>
        </View>

        <View style={styles.featuredBottom}>
          <View style={styles.medallion}>
            {item.logo_url ? (
              <Image source={{ uri: img(item.logo_url) }} style={styles.medallionImg} contentFit="cover" />
            ) : (
              <Display size="lg" italic style={styles.monogram}>
                {item.name.charAt(0).toUpperCase()}
              </Display>
            )}
          </View>
          <Display size="2xl" style={styles.featuredName} numberOfLines={1}>
            {item.name}
          </Display>
          <Body size="sm" style={styles.featuredDesc} numberOfLines={1}>
            {item.description || "An independent LUXE atelier"}
          </Body>
          <View style={styles.featuredFoot}>
            <Label style={styles.featuredMeta}>
              {rating ? `★ ${rating}` : "New atelier"} · {item.total_products ?? 0} pieces
            </Label>
            <View style={styles.featuredCta}>
              <Label style={styles.featuredCtaText}>Visit</Label>
              <Ionicons name="arrow-forward" size={12} color={colors.ink.DEFAULT} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const header = useMemo(
    () => (
      <View>
        {/* Masthead */}
        <View style={styles.masthead}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowRule} />
            <Label style={styles.eyebrow}>The Directory</Label>
          </View>
          <Display size="4xl" style={styles.title}>
            Ateliers{" "}
            <Display size="4xl" italic style={styles.titleItalic}>
              & stores
            </Display>
          </Display>
          <Body muted size="sm" style={styles.subtitle}>
            Independent labels and boutiques from across the island, curated by LUXE.
          </Body>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, focused && styles.searchWrapFocused]}>
          <Ionicons name="search-outline" size={17} color={colors.ink.mute} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Find an atelier"
            placeholderTextColor={colors.light.mutedForeground}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} hitSlop={10} style={styles.clearBtn}>
              <Ionicons name="close" size={12} color={colors.paper.cream} />
            </Pressable>
          ) : null}
        </View>

        {/* Featured carousel */}
        {!searching && featured.length > 0 ? (
          <View style={styles.section}>
            <SectionHeading kicker="01" title="Featured" italic="ateliers" />
            <FlatList
              horizontal
              data={featured}
              keyExtractor={(s) => `f-${s.id}`}
              renderItem={renderFeatured}
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + spacing[3]}
              decelerationRate="fast"
              style={styles.featuredList}
              contentContainerStyle={styles.featuredScroll}
            />
          </View>
        ) : null}

        {/* All stores heading + sort */}
        <View style={styles.section}>
          <SectionHeading
            kicker={searching ? "—" : "02"}
            title={searching ? "Results" : "All"}
            italic={searching ? "" : "stores"}
            count={loading ? undefined : stores.length}
          />
          <View style={styles.sortBar}>
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <Pressable key={s.key} onPress={() => setSort(s.key)} style={styles.sortTab} hitSlop={6}>
                  <Label style={[styles.sortText, active && styles.sortTextActive]}>{s.label}</Label>
                  <View style={[styles.sortUnderline, active && styles.sortUnderlineActive]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    ),
    // renderFeatured closes over cardW/featured/open, all listed below.
    [search, focused, searching, featured, cardW, loading, stores.length, sort, open],
  );

  return (
    <PaperBackground>
      <AppHeader showSearch={false} />
      <FlatList
        data={loading && stores.length === 0 ? [] : stores}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: GUTTER, gap: spacing[5] }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                  <Skeleton width={64} height={64} borderRadius={radii["2xl"]} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton width="85%" height={12} />
                    <Skeleton width="40%" height={10} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="storefront-outline" size={24} color={colors.olive[600]} />
              </View>
              <Display size="2xl" style={styles.emptyTitle}>
                {searching ? "No matches" : "Opening soon"}
              </Display>
              <Body muted size="sm" style={styles.emptyCopy}>
                {searching
                  ? `Nothing matches “${search}”. Try another name.`
                  : "Approved ateliers will appear here as they come online."}
              </Body>
            </View>
          )
        }
        ListFooterComponent={
          !loading && stores.length > 0 ? (
            <View style={styles.footer}>
              <View style={styles.footerRule} />
              <Label style={styles.footerText}>End of directory</Label>
              <View style={styles.footerRule} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[600]} />
        }
      />
    </PaperBackground>
  );
}

function SectionHeading({
  kicker,
  title,
  italic,
  count,
}: {
  kicker: string;
  title: string;
  italic: string;
  count?: number;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Label style={styles.kicker}>{kicker}</Label>
        <Display size="2xl" style={styles.sectionTitle}>
          {title}
          {italic ? (
            <Display size="2xl" italic style={styles.titleItalic}>
              {" "}
              {italic}
            </Display>
          ) : null}
        </Display>
      </View>
      {count !== undefined ? <Label style={styles.count}>{pad2(count)} total</Label> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },

  // Masthead
  masthead: { paddingHorizontal: GUTTER, paddingTop: spacing[5], paddingBottom: spacing[5] },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[3] },
  eyebrowRule: { width: 24, height: 1, backgroundColor: colors.olive[600] },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.olive[600],
  },
  title: { color: colors.ink.DEFAULT, letterSpacing: -0.8, lineHeight: 42 },
  titleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  subtitle: { marginTop: spacing[2], maxWidth: 300, lineHeight: 20 },

  // Search
  searchWrap: {
    marginHorizontal: GUTTER,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    height: 52,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  searchWrapFocused: { borderColor: colors.olive[600], borderWidth: 1 },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: colors.ink.DEFAULT,
    padding: 0,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink.mute,
    alignItems: "center",
    justifyContent: "center",
  },

  // Sections
  section: { marginTop: spacing[8] },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: spacing[3],
    marginBottom: spacing[4],
    marginHorizontal: GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent2.rust,
    marginBottom: 2,
  },
  sectionTitle: { color: colors.ink.DEFAULT, letterSpacing: -0.4 },
  count: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.mute,
    marginBottom: 6,
  },

  // Featured
  featuredList: { overflow: "visible" },
  featuredScroll: { gap: spacing[3], paddingHorizontal: GUTTER, paddingBottom: spacing[3] },
  featuredCard: {
    borderRadius: radii["3xl"],
    overflow: "hidden",
    backgroundColor: colors.ink.DEFAULT,
    ...shadows.editorial,
  },
  featuredMedia: { width: "100%", backgroundColor: colors.olive[100] },
  featuredFallback: { alignItems: "center", justifyContent: "center" },
  featuredMonogram: { color: "rgba(250,248,241,0.22)", fontSize: 120, lineHeight: 140 },
  featuredTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing[3],
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.94)",
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent2.ochre },
  badgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink.DEFAULT,
  },
  indexPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(22,23,15,0.55)",
  },
  featuredIndex: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.paper.cream,
  },
  featuredBottom: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], paddingTop: 34, gap: 2 },
  medallion: {
    position: "absolute",
    top: -26,
    left: spacing[5],
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.ink.DEFAULT,
  },
  medallionImg: { width: "100%", height: "100%", borderRadius: 24 },
  featuredName: { color: colors.paper.cream, letterSpacing: -0.4 },
  featuredDesc: { color: "rgba(250,248,241,0.62)", fontFamily: fontFamilies.display.italic },
  featuredFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(250,248,241,0.16)",
  },
  featuredMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.7)",
  },
  featuredCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
  },
  featuredCtaText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.DEFAULT,
  },

  // Sort tabs
  sortBar: { flexDirection: "row", gap: spacing[5], paddingHorizontal: GUTTER, marginBottom: spacing[2] },
  sortTab: { paddingVertical: 4, gap: 6 },
  sortText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  sortTextActive: { color: colors.ink.DEFAULT, fontFamily: fontFamilies.mono.semibold },
  sortUnderline: { height: 2, borderRadius: 1, backgroundColor: "transparent" },
  sortUnderlineActive: { backgroundColor: colors.olive[600] },

  // Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: GUTTER,
    paddingVertical: spacing[4],
  },
  rowIndex: {
    width: 18,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 0.5,
  },
  logoFrame: {
    borderRadius: radii["2xl"],
    backgroundColor: colors.paper.cream,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  logo: { width: 60, height: 60, borderRadius: radii.xl, backgroundColor: colors.olive[50] },
  logoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[100] },
  monogram: { fontFamily: fontFamilies.display.italic, color: colors.olive[700] },
  rowBody: { flex: 1, gap: 2 },
  rowName: { color: colors.ink.DEFAULT, letterSpacing: -0.2 },
  rowDesc: { fontFamily: fontFamilies.display.italic, color: colors.ink.mute },
  rowMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  newTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.olive[100],
  },
  newTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.light.border, marginHorizontal: 7 },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.cream,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginLeft: GUTTER + 18 + spacing[3],
    marginRight: GUTTER,
  },

  // Footer / empty
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: GUTTER * 2,
    marginTop: spacing[8],
  },
  footerRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.light.border },
  footerText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  empty: { alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[8], paddingVertical: spacing[10] },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive[200],
    marginBottom: spacing[2],
  },
  emptyTitle: { color: colors.ink.DEFAULT },
  emptyCopy: { textAlign: "center", maxWidth: 260 },
});
