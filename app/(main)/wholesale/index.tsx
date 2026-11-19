import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { AppHeader } from "@/components/layout";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedFlatList, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { WholesaleProductTile } from "@/components/wholesale/ProductTile";
import { WholesaleHero } from "@/components/wholesale/WholesaleHero";
import {
  DispatchBand,
  MoqTiers,
  OccasionRail,
  TradeBand,
  WholesaleStandard,
  type MoqTier,
} from "@/components/wholesale/WholesaleSections";
import { DEPT_THEMES, type Dept } from "@/components/home/premium/FestiveHero";
import { CrossfadeGradient } from "@/components/ui/CrossfadeGradient";
import * as api from "@/lib/api";
import { HomeSectionHeader } from "@/components/home/premium";
import { C } from "@/components/orders/parcel-track";
import { useProductGrid } from "@/lib/hooks/useProductGrid";
import { useWhatsappNumber } from "@/lib/whatsapp-order";
import { safeOpenUrl } from "@/lib/utils/safe-open-url";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { isWholesaleEnabledMobile } from "@/lib/feature-flags";

const GUTTER = 16;
const GAP = 10;
const RAIL_CARD = 168;
const GOLD = "#c9b27a";
const GOLD_SOFT = "#d8c795";
const WA_GREEN = "#25D366";

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "popular", label: "Popular" },
] as const;

const STEPS = [
  {
    n: "01",
    icon: "albums-outline" as const,
    title: "Build your order",
    body: "Choose styles, colours and sizes. Quantities start at each style's MOQ and move in pack steps.",
  },
  {
    n: "02",
    icon: "logo-whatsapp" as const,
    title: "Send it on WhatsApp",
    body: "Tap Order on WhatsApp on any style. The message arrives prefilled with style, quantity and reference.",
  },
  {
    n: "03",
    icon: "paper-plane-outline" as const,
    title: "Confirm & dispatch",
    body: "Our wholesale desk confirms stock, pricing and lead time, then dispatches islandwide with tracking.",
  },
];

export default function WholesaleRoute() {
  // Wholesale is switched off for now: deep links land on Home.
  if (!isWholesaleEnabledMobile()) return <Redirect href={"/(main)" as never} />;
  return <WholesaleScreen />;
}

function WholesaleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = (width - GUTTER * 2 - GAP) / 2;
  const tabBarScrollHandler = useHideTabBarOnScroll();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null);
  const searchRef = useRef<TextInput>(null);
  const { number: whatsappNumber } = useWhatsappNumber();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [gender, setGender] = useState<Dept>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [gridY, setGridY] = useState(0);
  const [moqTier, setMoqTier] = useState<MoqTier | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["all-categories"],
    queryFn: async () => {
      const res = await api.getAllCategories();
      return res.ok ? res.data : [];
    },
    staleTime: 10 * 60_000,
  });
  const bannersQuery = useQuery({
    queryKey: ["banners", "wholesale_hero"],
    queryFn: async () => {
      const res = await api.getBanners("wholesale_hero");
      return res.ok ? res.data : [];
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText.trim()), 280);
    return () => clearTimeout(t);
  }, [searchText]);

  const { products, refined, total, loading, loadingMore, loadMore, filters, setFilters, setSort: setGridSort } = useProductGrid({
    channel: "wholesale",
    initialSort: sort,
    search,
    category: category ?? undefined,
  });

  // Keep the hook's server-side gender in sync with the chip row.
  useEffect(() => {
    const next = gender === "all" ? undefined : gender;
    if (filters.gender !== next) setFilters({ ...filters, gender: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender]);

  const startingPrice = products.length
    ? Math.min(...products.map((p) => Number(p.price) || 0))
    : null;
  const lowestMoq = products.length
    ? Math.min(...products.map((p) => Math.max(1, Number(p.wholesale_moq ?? 1) || 1)))
    : null;

  // "Start small" rail: the lowest-MOQ styles, only on the unfiltered view
  // so it never fights the grid below.
  const isBrowsing = !search && gender === "all" && !category;
  const starterPicks = useMemo(() => {
    if (!isBrowsing || products.length < 4) return [];
    return [...products]
      .sort((a, b) => (Number(a.wholesale_moq ?? 1) || 1) - (Number(b.wholesale_moq ?? 1) || 1))
      .slice(0, 8);
  }, [products, isBrowsing]);

  const chat = () => {
    if (!whatsappNumber) return;
    const digits = whatsappNumber.replace(/\D/g, "");
    const text = encodeURIComponent(
      "Hi VESTARA Wholesale, I'd like to see the wholesale line sheet and place an order.",
    );
    void safeOpenUrl(`https://wa.me/${digits}?text=${text}`);
  };

  const openProduct = (p: Product) => {
    router.push({
      pathname: "/(main)/products/[slug]",
      params: { slug: p.slug, from: "wholesale" },
    } as never);
  };

  const deptTheme = DEPT_THEMES[gender];
  // MOQ tiers filter the loaded page client-side (the API has no MOQ param).
  const gridData = useMemo(() => {
    if (!moqTier) return refined;
    return refined.filter((p) => {
      const moq = Math.max(1, Number(p.wholesale_moq ?? 1) || 1);
      return moq >= moqTier.min && (moqTier.max == null || moq <= moqTier.max);
    });
  }, [refined, moqTier]);
  const shown = moqTier ? gridData.length : total || refined.length;
  const countLabel = loading ? "Loading the line…" : `${shown} ${shown === 1 ? "style" : "styles"}`;
  const scrollToGrid = () =>
    setTimeout(() => listRef.current?.scrollToOffset?.({ offset: Math.max(0, gridY - 8), animated: true }), 60);
  const hasFilter = !!(search || category || moqTier || gender !== "all");

  const header = useMemo(
    () => (
      <View>
        <WholesaleHero
          dept={gender}
          onDeptChange={(d) => {
            setGender(d);
            setCategory(null);
          }}
          categories={categoriesQuery.data ?? []}
          category={category}
          onCategoryChange={setCategory}
          banners={bannersQuery.data ?? []}
          onSlidePress={(d) => {
            setGender(d);
            setCategory(null);
            scrollToGrid();
          }}
        />

        <TradeBand
          onChat={chat}
          stats={[
            { label: "Styles live", value: products.length ? String(products.length) : "Curating" },
            { label: "MOQ from", value: lowestMoq ? `${lowestMoq} pcs` : "Ask us" },
            {
              label: "Piece from",
              value: startingPrice != null ? formatPrice(startingPrice, products[0]?.currency ?? "LKR") : "On request",
            },
          ]}
        />

        <OccasionRail
          onPick={(q) => {
            setSearchText(q);
            scrollToGrid();
          }}
        />

        <MoqTiers
          active={moqTier?.key ?? null}
          onPick={(t) => {
            setMoqTier(t);
            if (t) scrollToGrid();
          }}
        />

        {/* Start-small rail */}
        {starterPicks.length ? (
          <View style={styles.railWrap}>
            <HomeSectionHeader kicker="Start small" title="Lowest minimums" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {starterPicks.map((p, i) => (
                <WholesaleProductTile
                  key={p.id}
                  product={p}
                  width={RAIL_CARD}
                  index={i}
                  onPress={() => openProduct(p)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <DispatchBand onPress={chat} />

        {/* Line sheet toolbar */}
        <View onLayout={(e) => setGridY(e.nativeEvent.layout.y)}>
          <HomeSectionHeader kicker="The line sheet" title="Browse the collection" />
        </View>
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={C.muted} />
            <TextInput
              ref={searchRef}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search styles, SKUs, categories…"
              placeholderTextColor="rgba(101,104,77,0.6)"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchText ? (
              <Pressable onPress={() => setSearchText("")} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={17} color={C.muted} />
              </Pressable>
            ) : null}
          </View>

          {category || moqTier ? (
            <View style={styles.activeRow}>
              {category ? (
                <Pressable onPress={() => setCategory(null)} style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    {(categoriesQuery.data ?? []).find((c) => c.slug === category)?.name ?? category}
                  </Text>
                  <Ionicons name="close" size={13} color={C.lime} />
                </Pressable>
              ) : null}
              {moqTier ? (
                <Pressable onPress={() => setMoqTier(null)} style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    MOQ {moqTier.min}
                    {moqTier.max == null ? "+" : `–${moqTier.max}`} pcs
                  </Text>
                  <Ionicons name="close" size={13} color={C.lime} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.sortRow}>
            <Text style={styles.count}>{countLabel.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => {
                      setSort(s.key);
                      setGridSort?.(s.key);
                    }}
                    style={[styles.sortChip, active && styles.sortChipActive]}
                  >
                    <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products.length, starterPicks, lowestMoq, startingPrice, searchText, gender, category, moqTier, sort, countLabel, whatsappNumber, categoriesQuery.data, bannersQuery.data, gridY],
  );

  const footer = (
    <View>
      <View style={styles.howCard}>
        <Text style={styles.howKicker}>HOW WHOLESALE WORKS</Text>
        <Text style={styles.howTitle}>
          Pick the pieces.{"\n"}
          <Text style={styles.heroItalic}>We handle the rest.</Text>
        </Text>
        {STEPS.map((step, i) => (
          <View key={step.n} style={[styles.step, i > 0 && styles.stepDivider]}>
            <View style={styles.stepIcon}>
              <Ionicons name={step.icon} size={17} color={GOLD_SOFT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepN}>STEP {step.n}</Text>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}
        <Pressable onPress={chat} style={({ pressed }) => [styles.howBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="logo-whatsapp" size={17} color="#fff" />
          <Text style={styles.chatBtnText}>Talk to the wholesale desk</Text>
        </Pressable>
      </View>

      <WholesaleStandard />

      <View style={styles.endCap}>
        <Text style={styles.endKicker}>Shopping for yourself?</Text>
        <Text style={styles.endTitle}>The retail edit is one tap away</Text>
        <Pressable
          style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/(main)/products" as never)}
        >
          <Text style={styles.endBtnText}>Browse Vestara</Text>
          <Ionicons name="arrow-forward" size={15} color={C.lime} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <CrossfadeGradient
        colors={[deptTheme.bg[1], deptTheme.bg[1], deptTheme.bg[2], deptTheme.bg[2] + "80", colors.paper.cream]}
        locations={[0, 0.22, 0.5, 0.78, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.glow}
      />
      <AppHeader
        showTicker={false}
        showSearch
        tone="festive"
        festiveColors={[deptTheme.bg[0], deptTheme.bg[1]]}
        onSearchPress={() => {
          scrollToGrid();
          setTimeout(() => searchRef.current?.focus(), 420);
        }}
      />
      <AnimatedFlatList
        ref={listRef}
        data={gridData}
        keyExtractor={(item: Product) => item.id}
        renderItem={({ item, index }: { item: Product; index: number }) => (
          <View style={{ width: tileWidth, marginBottom: GAP + 2 }}>
            <WholesaleProductTile product={item} width={tileWidth} index={index} onPress={() => openProduct(item)} />
          </View>
        )}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: GUTTER }}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: expandableTabBarInset(insets.bottom) + 32,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={header}
        ListFooterComponent={
          <>
            {loadingMore ? <ActivityIndicator color={colors.ink.DEFAULT} style={{ padding: spacing[5] }} /> : null}
            {footer}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.ink.DEFAULT} style={{ padding: spacing[8] }} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name={products.length || search ? "search-outline" : "sparkles-outline"} size={22} color={colors.olive[700]} />
              </View>
              <Text style={styles.emptyTitle}>
                {hasFilter ? "No styles match that search." : "The new line is being curated."}
              </Text>
              <Text style={styles.emptyBody}>
                {hasFilter
                  ? "Clear the search, or message the wholesale desk and we'll pull the closest matches."
                  : "Message the wholesale desk for the current line sheet, MOQs and pack prices."}
              </Text>
              <View style={styles.emptyActions}>
                {hasFilter ? (
                  <Pressable
                    onPress={() => {
                      setSearchText("");
                      setGender("all");
                      setCategory(null);
                      setMoqTier(null);
                    }}
                    style={styles.emptyGhost}
                  >
                    <Text style={styles.emptyGhostText}>Clear filters</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={chat} style={styles.emptyBtn}>
                  <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                  <Text style={styles.emptyBtnText}>Chat with the desk</Text>
                </Pressable>
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper.cream },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 680 },

  /* Hero */
  hero: {
    marginHorizontal: GUTTER,
    marginBottom: spacing[4],
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    borderRadius: 28,
    backgroundColor: C.ink,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(201,178,122,0.16)",
    top: -120,
    right: -110,
  },
  heroGlowOlive: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(109,124,72,0.22)",
    bottom: -120,
    left: -70,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(201,178,122,0.35)",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: WA_GREEN },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: GOLD,
  },
  heroTitle: {
    marginTop: 14,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -0.8,
    color: colors.paper.cream,
  },
  heroItalic: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_SOFT,
  },
  heroCopy: {
    marginTop: 10,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(250,248,241,0.65)",
  },
  stats: { marginTop: 18, flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(250,248,241,0.06)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statLabel: {
    marginTop: 7,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 7.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.45)",
  },
  statValue: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.paper.cream,
  },
  heroActions: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 46,
    borderRadius: radii.full,
    backgroundColor: WA_GREEN,
    paddingHorizontal: 18,
  },
  chatBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 13.5, color: "#fff" },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 46,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.25)",
    paddingHorizontal: 16,
  },
  ghostBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.paper.cream },

  /* Rail */
  railWrap: { marginBottom: spacing[7] },
  rail: { paddingHorizontal: GUTTER, gap: spacing[3] },

  /* Toolbar */
  toolbar: { paddingHorizontal: GUTTER, paddingBottom: spacing[3] },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: radii.full,
    backgroundColor: C.card,
    paddingHorizontal: 15,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: C.text,
    paddingVertical: 0,
  },
  activeRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  activeFilter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: C.ink,
    paddingHorizontal: 13,
  },
  activeFilterText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.lime },
  sortRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  count: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.accent,
  },
  sortChips: { gap: 6, paddingRight: 4 },
  sortChip: {
    height: 30,
    justifyContent: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
    paddingHorizontal: 12,
  },
  sortChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  sortChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: C.muted },
  sortChipTextActive: { color: C.ink },

  /* Empty */
  empty: {
    marginHorizontal: GUTTER,
    marginTop: 4,
    borderRadius: 24,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    lineHeight: 26,
    color: C.text,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
  },
  emptyActions: { marginTop: 18, flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  emptyGhost: {
    height: 42,
    justifyContent: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.14)",
    paddingHorizontal: 16,
  },
  emptyGhostText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.text },
  emptyBtn: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.full,
    backgroundColor: WA_GREEN,
    paddingHorizontal: 16,
  },
  emptyBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5, color: "#fff" },

  /* How it works */
  howCard: {
    marginTop: spacing[6],
    marginHorizontal: GUTTER,
    borderRadius: 28,
    backgroundColor: C.ink,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
  },
  howKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: GOLD,
  },
  howTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.5,
    color: colors.paper.cream,
  },
  step: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  stepDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(250,248,241,0.14)" },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(201,178,122,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepN: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: GOLD,
  },
  stepTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  stepBody: {
    marginTop: 3,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(250,248,241,0.6)",
  },
  howBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 46,
    borderRadius: radii.full,
    backgroundColor: WA_GREEN,
    paddingHorizontal: 18,
  },

  /* End cap */
  endCap: {
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
  },
  endKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.olive[600],
  },
  endTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: C.text,
    textAlign: "center",
  },
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[3],
    paddingHorizontal: spacing[6],
    height: 48,
    borderRadius: radii.full,
    backgroundColor: C.ink,
  },
  endBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },
});
