import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/product/ProductCard";
import { SearchFilterSheet } from "@/components/search/SearchFilterSheet";
import {
  SearchOrbitBackground,
  SearchOrbitChrome,
} from "@/components/search/SearchOrbitChrome";
import { SearchOrbitDiscovery } from "@/components/search/SearchOrbitDiscovery";
import { SearchSuggestions } from "@/components/search/SearchSuggestions";
import { Display, Label, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { colors, radii, spacing, typography, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import { SORTS, PRICE_BOUNDS } from "@/lib/api/facets";
import type { ProductFilters } from "@/lib/api/facets";
import * as api from "@/lib/api";
import type { SearchSuggestion } from "@/lib/api";
import type { Product, Brand, Store, Category } from "@/lib/types";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTrackEvent, getForYouRail } from "@/lib/recommender";
import { tokenizeQuery } from "@/lib/utils/search-utils";
import { useAuth } from "@/lib/supabase/auth";
import { HomeProductCard } from "@/components/home/premium/HomeProductCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 10;
const GRID_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";
const GLASS = {
  backgroundColor: "rgba(255, 255, 255, 0.55)",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.65)",
};

const SUGGESTIONS = ["Linen blazer", "Leather loafers", "Silk scarf", "Resort '26", "Vintage denim", "Hoodie"];

const TABS = [
  { key: "all" as const, label: "All", icon: "sparkles" as const },
  { key: "products" as const, label: "Products", icon: "cube-outline" as const },
  { key: "brands" as const, label: "Brands", icon: "pricetag-outline" as const },
  { key: "stores" as const, label: "Stores", icon: "storefront-outline" as const },
];

type TabKey = typeof TABS[number]["key"];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({
    price: [PRICE_BOUNDS.min, PRICE_BOUNDS.max],
    colors: [],
    sizes: [],
    brands: [],
    categories: [],
    minRating: 0,
    minDiscount: 0,
  });

  const debouncedDraft = useDebounce(draft, 300);

  const { user } = useAuth();
  const tracker = useTrackEvent();
  const [recs, setRecs] = useState<Product[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  // Load recent searches from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem("luxe_search_history").then((v) => {
      if (v) setRecentSearches(JSON.parse(v));
    });
  }, []);

  const saveRecent = async (term: string) => {
    const next = [term, ...recentSearches.filter((r) => r !== term)].slice(0, 12);
    setRecentSearches(next);
    try {
      await AsyncStorage.setItem("luxe_search_history", JSON.stringify(next));
    } catch {}
  };

  const clearRecent = async () => {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem("luxe_search_history");
    } catch {}
  };

  const doSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) return;
    setQuery(q);
    setDraft(q);
    setLoading(true);
    setSearched(true);
    saveRecent(q);

    const [productRes, brandRes, storeRes, catRes] = await Promise.all([
      api.searchProducts(q),
      api.getBrands({ search: q }),
      api.getFeaturedStores(20),
      api.getCategories(20),
    ]);

    const productCount = productRes.ok ? productRes.data.length : 0;
    if (productRes.ok) setResults(productRes.data);
    if (brandRes.ok) setBrands(brandRes.data.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())));
    if (storeRes.ok) setStores(storeRes.data.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())));
    if (catRes.ok) setCategories(catRes.data.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())));
    setLoading(false);

    // Track the search for personalization.
    tracker.search(q, tokenizeQuery(q), productCount);
  }, [recentSearches, tracker]);

  const localSuggestions = useMemo<SearchSuggestion[]>(() => {
    const term = draft.trim().toLowerCase();
    if (!term) return [];

    const items: SearchSuggestion[] = [];

    for (const label of recentSearches) {
      if (label.toLowerCase().includes(term)) {
        items.push({ id: `recent-${label}`, label, type: "recent" });
      }
    }

    for (const label of SUGGESTIONS) {
      if (
        label.toLowerCase().includes(term) &&
        !items.some((item) => item.label.toLowerCase() === label.toLowerCase())
      ) {
        items.push({ id: `trending-${label}`, label, type: "trending" });
      }
    }

    return items.slice(0, 4);
  }, [draft, recentSearches]);

  useEffect(() => {
    const term = debouncedDraft.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    api.getSearchSuggestions(term).then((res) => {
      if (cancelled) return;
      setSuggestions(res.ok ? res.data : []);
      setSuggestionsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedDraft]);

  const showSuggestions =
    draft.trim().length >= 1 &&
    (!searched || draft.trim().toLowerCase() !== query.trim().toLowerCase());

  const handleSuggestionSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.type === "product" && suggestion.slug) {
        router.push(`/(main)/products/${suggestion.slug}`);
        return;
      }
      if (suggestion.type === "store" && suggestion.slug) {
        router.push(`/(main)/stores/${suggestion.slug}`);
        return;
      }
      if (suggestion.type === "brand" && suggestion.slug) {
        router.push(`/(main)/products?brand=${suggestion.slug}`);
        return;
      }
      if (suggestion.type === "category" && suggestion.slug) {
        router.push(`/(main)/products?category=${suggestion.slug}`);
        return;
      }
      doSearch(suggestion.label);
    },
    [doSearch, router],
  );

  // Client-side filter + sort pipeline
  const filtered = useMemo(() => {
    let list = [...results];

    // Price filter
    if (filters.price && (filters.price[0] > PRICE_BOUNDS.min || filters.price[1] < PRICE_BOUNDS.max)) {
      list = list.filter((p) => p.price >= filters.price![0] && p.price <= filters.price![1]);
    }

    // Color filter
    if (filters.colors && filters.colors.length > 0) {
      list = list.filter((p) => {
        const have = new Set((p.variants ?? []).map((v) => v.color));
        return filters.colors!.some((c) => have.has(c));
      });
    }

    // Size filter
    if (filters.sizes && filters.sizes.length > 0) {
      list = list.filter((p) => {
        const have = new Set((p.variants ?? []).map((v) => v.size));
        return filters.sizes!.some((s) => have.has(s));
      });
    }

    // Rating filter
    if (filters.minRating && filters.minRating > 0) {
      list = list.filter((p) => p.rating >= filters.minRating!);
    }

    // Discount filter
    if (filters.minDiscount && filters.minDiscount > 0) {
      list = list.filter((p) => discountPct(p.mrp, p.price) >= filters.minDiscount!);
    }

    // Sort
    switch (sort) {
      case "newest":
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "sale":
        list.sort((a, b) => discountPct(b.mrp, b.price) - discountPct(a.mrp, a.price));
        break;
    }

    return list;
  }, [results, filters, sort]);

  const matchedBrands = brands;
  const matchedStores = stores;
  const matchedCategories = categories;

  const productCount = filtered.length;
  const brandCount = matchedBrands.length;
  const storeCount = matchedStores.length;
  const totalCount = productCount + brandCount + storeCount;

  const activeFilterCount =
    (filters.colors?.length ?? 0) +
    (filters.sizes?.length ?? 0) +
    (filters.brands?.length ?? 0) +
    (filters.categories?.length ?? 0) +
    (filters.minRating ? 1 : 0) +
    (filters.minDiscount ? 1 : 0) +
    (filters.price && (filters.price[0] > PRICE_BOUNDS.min || filters.price[1] < PRICE_BOUNDS.max) ? 1 : 0);

  const resetSearch = () => {
    setDraft("");
    setQuery("");
    setResults([]);
    setSuggestions([]);
    setRecs([]);
    setSearched(false);
    setTab("all");
  };

  // Load personalized recs when there's a search with zero results, so the
  // empty state has something useful to suggest.
  useEffect(() => {
    if (!searched || loading || totalCount > 0) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    setRecsLoading(true);
    getForYouRail(user?.id ?? null, 8).then((res) => {
      if (cancelled) return;
      setRecs(res.ok ? res.data.products : []);
      setRecsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [searched, loading, totalCount, user?.id]);

  return (
    <View style={styles.screen}>
      <SearchOrbitBackground />

      <SearchOrbitChrome
        topInset={insets.top}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={() => doSearch(draft)}
        onClear={resetSearch}
        searched={searched}
        query={query}
        totalCount={totalCount}
      />

      {showSuggestions ? (
        <SearchSuggestions
          draft={draft}
          suggestions={suggestions}
          localSuggestions={localSuggestions}
          loading={suggestionsLoading}
          onSelect={handleSuggestionSelect}
          onSearchDraft={() => doSearch(draft)}
        />
      ) : null}

      <View style={styles.body}>
        {!searched && !showSuggestions ? (
          <ScrollViewWrapper>
            <SearchOrbitDiscovery onSearch={doSearch} />
            {recentSearches.length > 0 ? (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Label style={styles.recentKicker}>RECENT SEARCHES</Label>
                  <TouchableOpacity onPress={clearRecent}>
                    <Label style={styles.clearLabel}>Clear</Label>
                  </TouchableOpacity>
                </View>
                <View style={styles.chipRow}>
                  {recentSearches.slice(0, 6).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.recentChip}
                      onPress={() => doSearch(s)}
                    >
                      <Body size="sm">{s}</Body>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollViewWrapper>
        ) : showSuggestions ? null : loading ? (
          /* ─── Loading ─── */
          <View style={styles.center}>
            <ActivityIndicator size="large" color={INK} />
            <Body muted style={{ marginTop: spacing[3], color: MUTED }}>Searching the atelier…</Body>
          </View>
        ) : totalCount === 0 ? (
          /* ─── No results ─── */
          <ScrollViewWrapper>
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={40} color={`${MUTED}99`} />
              </View>
              <Display size="xl">No matches in the Edit</Display>
              <Body muted style={styles.emptyDesc}>
                We couldn't find anything for "{query}". Try a different spelling, or browse the suggestions.
              </Body>
              <View style={styles.chipRow}>
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionChip}
                    onPress={() => doSearch(s)}
                  >
                    <Body size="sm">{s}</Body>
                  </TouchableOpacity>
                ))}
              </View>
              <Button variant="outline" onPress={() => router.push("/(main)/products")}>
                Browse the full edit →
              </Button>
            </View>

            {recsLoading ? (
              <View style={styles.recsLoading}>
                <ActivityIndicator size="small" color={INK} />
              </View>
            ) : recs.length > 0 ? (
              <View style={styles.recsSection}>
                <View style={styles.sectionHeader}>
                  <Body style={styles.sectionNum}>★</Body>
                  <View style={styles.sectionTitles}>
                    <Display size="lg">Based on what you love</Display>
                    <Body size="xs" muted>Pieces you might enjoy instead</Body>
                  </View>
                  <View style={styles.sectionLine} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recsScroll}
                >
                  {recs.map((p) => (
                    <HomeProductCard key={p.id} product={p} showSaleBadge />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </ScrollViewWrapper>
        ) : (
          /* ─── Results ─── */
          <View style={styles.resultsContainer}>
            {/* Tabs */}
            <View style={styles.tabBar}>
              {TABS.map((t) => {
                const count =
                  t.key === "all" ? totalCount :
                  t.key === "products" ? productCount :
                  t.key === "brands" ? brandCount :
                  storeCount;
                const isActive = tab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tab, isActive && styles.tabActive]}
                    onPress={() => setTab(t.key)}
                  >
                    <Ionicons
                      name={t.icon}
                      size={14}
                      color={isActive ? colors.light.primaryForeground : colors.light.mutedForeground}
                    />
                    <Body
                      size="sm"
                      style={[styles.tabText, isActive && styles.tabTextActive]}
                    >
                      {t.label}
                    </Body>
                    <Body
                      size="xs"
                      style={[styles.tabCount, isActive && styles.tabCountActive]}
                    >
                      {count}
                    </Body>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Controls bar */}
            <View style={styles.controlsBar}>
              <Body size="xs" muted style={styles.resultLabel}>
                {productCount} result{productCount === 1 ? "" : "s"}
              </Body>
              <View style={styles.controlsRight}>
                {/* Sort */}
                <TouchableOpacity
                  style={styles.sortBtn}
                  onPress={() => {
                    const keys = SORTS.map((s) => s.value);
                    const idx = keys.indexOf(sort);
                    setSort(keys[(idx + 1) % keys.length]);
                  }}
                >
                  <Ionicons name="swap-vertical" size={14} color={colors.light.mutedForeground} />
                  <Body size="xs">{SORTS.find((s) => s.value === sort)?.label || "Sort"}</Body>
                </TouchableOpacity>

                {/* Filter */}
                <TouchableOpacity
                  style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
                  onPress={() => setFilterVisible(true)}
                >
                  <Ionicons name="options-outline" size={14} color={activeFilterCount > 0 ? colors.light.primaryForeground : colors.light.mutedForeground} />
                  {activeFilterCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Body style={styles.filterBadgeText}>{activeFilterCount}</Body>
                    </View>
                  )}
                </TouchableOpacity>

                {/* View toggle */}
                <View style={styles.viewToggle}>
                  <TouchableOpacity
                    style={[styles.viewBtn, view === "grid" && styles.viewBtnActive]}
                    onPress={() => setView("grid")}
                  >
                    <Ionicons name="grid" size={14} color={view === "grid" ? colors.light.primaryForeground : colors.light.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewBtn, view === "list" && styles.viewBtnActive]}
                    onPress={() => setView("list")}
                  >
                    <Ionicons name="list" size={14} color={view === "list" ? colors.light.primaryForeground : colors.light.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Scrollable results list */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing[24] }}
            >
              {/* Active filter chips */}
              {activeFilterCount > 0 && (
                <View style={styles.activeChipsRow}>
                  {filters.colors?.map((c) => (
                    <TouchableOpacity
                      key={`c-${c}`}
                      style={styles.activeChip}
                      onPress={() => setFilters({ ...filters, colors: filters.colors!.filter((x) => x !== c) })}
                    >
                      <Body size="xs">{c}</Body>
                      <Ionicons name="close" size={10} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                  {filters.sizes?.map((s) => (
                    <TouchableOpacity
                      key={`s-${s}`}
                      style={styles.activeChip}
                      onPress={() => setFilters({ ...filters, sizes: filters.sizes!.filter((x) => x !== s) })}
                    >
                      <Body size="xs">{s}</Body>
                      <Ionicons name="close" size={10} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                  {filters.minDiscount ? (
                    <TouchableOpacity
                      style={styles.activeChip}
                      onPress={() => setFilters({ ...filters, minDiscount: 0 })}
                    >
                      <Body size="xs">{filters.minDiscount}%+ off</Body>
                      <Ionicons name="close" size={10} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  ) : null}
                  {filters.minRating ? (
                    <TouchableOpacity
                      style={styles.activeChip}
                      onPress={() => setFilters({ ...filters, minRating: 0 })}
                    >
                      <Body size="xs">{filters.minRating}★+</Body>
                      <Ionicons name="close" size={10} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setFilters({
                    price: [PRICE_BOUNDS.min, PRICE_BOUNDS.max],
                    colors: [], sizes: [], brands: [], categories: [], minRating: 0, minDiscount: 0,
                  })}>
                    <Label style={styles.clearChipLabel}>Clear all</Label>
                  </TouchableOpacity>
                </View>
              )}

              {/* Products */}
              {(tab === "all" || tab === "products") && productCount > 0 && (
                <View style={styles.productSection}>
                  {tab === "all" && (
                    <View style={styles.sectionHeader}>
                      <Body style={styles.sectionNum}>01</Body>
                      <View style={styles.sectionTitles}>
                        <Display size="lg">Products</Display>
                        <Body size="xs" muted>{productCount} results</Body>
                      </View>
                      <View style={styles.sectionLine} />
                    </View>
                  )}
                  {view === "list" ? (
                    filtered.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.listItem}
                        onPress={() => router.push(`/(main)/products/${p.slug}`)}
                      >
                        <View style={styles.listImage}>
                          {p.images?.[0]?.url ? (
                            <Image source={{ uri: p.images[0].url }} style={styles.listImageInner} contentFit="cover" />
                          ) : (
                            <View style={[styles.listImageInner, { backgroundColor: colors.light.muted }]} />
                          )}
                          {discountPct(p.mrp, p.price) > 0 && (
                            <View style={styles.listDiscount}>
                              <Label style={styles.listDiscountText}>{discountPct(p.mrp, p.price)}% OFF</Label>
                            </View>
                          )}
                        </View>
                        <View style={styles.listInfo}>
                          {p.brand && <Label style={styles.listBrand}>{p.brand.name}</Label>}
                          <Body size="sm" numberOfLines={1}>{p.name}</Body>
                          <Body size="xs" muted numberOfLines={1}>{p.short_description}</Body>
                          <View style={styles.listMeta}>
                            {p.rating > 0 && (
                              <View style={styles.listRating}>
                                <Ionicons name="star" size={10} color={colors.olive[600]} />
                                <Body size="xs">{p.rating.toFixed(1)}</Body>
                              </View>
                            )}
                            <Body size="xs" muted>{p.total_reviews} reviews</Body>
                            <Body size="xs" muted>·</Body>
                            <Body size="xs" muted>{p.total_sales} sold</Body>
                          </View>
                        </View>
                        <View style={styles.listPriceCol}>
                          <Price size="sm">{formatPrice(p.price)}</Price>
                          {discountPct(p.mrp, p.price) > 0 && (
                            <Body muted size="xs" style={{ textDecorationLine: "line-through" }}>
                              {formatPrice(p.mrp)}
                            </Body>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.grid}>
                      {filtered.map((p) => (
                        <View key={p.id} style={styles.gridItem}>
                          <ProductCard product={p} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Brands */}
              {(tab === "all" || tab === "brands") && brandCount > 0 && (
                <View style={styles.productSection}>
                  {tab === "all" && (
                    <View style={styles.sectionHeader}>
                      <Body style={styles.sectionNum}>02</Body>
                      <View style={styles.sectionTitles}>
                        <Display size="lg">Brands</Display>
                        <Body size="xs" muted>{brandCount} results</Body>
                      </View>
                      <View style={styles.sectionLine} />
                    </View>
                  )}
                  <View style={styles.brandGrid}>
                    {matchedBrands.map((b) => (
                      <View key={b.id} style={styles.brandCard}>
                        <Avatar name={b.name} uri={b.logo_url} size={44} />
                        <View style={styles.brandInfo}>
                          <Body size="sm" style={{ fontWeight: "600" }}>{b.name}</Body>
                          <Body size="xs" muted>{b.total_followers} followers</Body>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Stores */}
              {(tab === "all" || tab === "stores") && storeCount > 0 && (
                <View style={styles.productSection}>
                  {tab === "all" && (
                    <View style={styles.sectionHeader}>
                      <Body style={styles.sectionNum}>03</Body>
                      <View style={styles.sectionTitles}>
                        <Display size="lg">Stores</Display>
                        <Body size="xs" muted>{storeCount} results</Body>
                      </View>
                      <View style={styles.sectionLine} />
                    </View>
                  )}
                  {matchedStores.map((s) => (
                    <View key={s.id} style={styles.storeCard}>
                      <Avatar name={s.name} uri={s.logo_url} size={48} />
                      <View style={styles.storeInfo}>
                        <Body size="sm" style={{ fontWeight: "600" }}>{s.name}</Body>
                        <Body size="xs" muted numberOfLines={1}>{s.description}</Body>
                        <View style={styles.storeMeta}>
                          <Ionicons name="star" size={10} color={colors.olive[600]} />
                          <Body size="xs">{s.rating.toFixed(1)}</Body>
                          <Body size="xs" muted>·</Body>
                          <Body size="xs" muted>{s.total_products} products</Body>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Related searches */}
              <View style={styles.relatedSection}>
                <Label style={styles.sectionKicker}>Related searches</Label>
                <View style={styles.chipRow}>
                  {SUGGESTIONS.filter((s) => s.toLowerCase() !== query.toLowerCase()).slice(0, 5).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestionChip}
                      onPress={() => doSearch(s)}
                    >
                      <Body size="sm">{s}</Body>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Filter sheet */}
      <SearchFilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApply={setFilters}
      />
    </View>
  );
}

/* ─── ScrollView wrapper for empty state ─── */
function ScrollViewWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing[24] }}
    >
      {children}
    </ScrollView>
  );
}

/* ─── Price component ─── */
function Price({ size = "base", style, children }: { size?: string; style?: any; children: React.ReactNode }) {
  const sizeMap: Record<string, number> = {
    xs: 11, sm: 13, base: 15, lg: 18, xl: 20, "2xl": 24,
  };
  return (
    <Body
      size={size as any}
      style={[
        {
          fontFamily: fontFamilies.display.semibold,
          fontSize: sizeMap[size] || 15,
          letterSpacing: -0.02,
        },
        style,
      ]}
    >
      {children}
    </Body>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbf9f8",
  },
  /* Body */
  body: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  recentSection: {
    paddingHorizontal: spacing[5],
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  recentKicker: {
    color: MUTED,
    letterSpacing: 1,
  },

  /* Sections */
  section: {
    marginBottom: spacing[6],
    gap: spacing[3],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[1],
  },
  sectionKicker: {
    color: MUTED,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearLabel: {
    color: INK,
  },

  /* Chips */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    ...GLASS,
  },
  recentChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    ...GLASS,
  },

  /* Trending */
  trendingCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.light.primary}18`,
    overflow: "hidden",
  },
  trendingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}08`,
  },
  trendingNum: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: `${colors.light.foreground}30`,
    width: 32,
  },
  trendingQuery: {
    flex: 1,
    fontWeight: "500",
  },
  trendingDelta: {
    color: colors.olive[600],
    fontSize: 10,
  },

  /* Empty state */
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[5],
  },
  emptyState: {
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    ...GLASS,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  emptyDesc: {
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing[4],
  },

  /* Results */
  resultsContainer: {
    gap: spacing[4],
    paddingHorizontal: spacing[5],
  },

  /* Tabs */
  tabBar: {
    flexDirection: "row",
    gap: spacing[2],
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    ...GLASS,
  },
  tabActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  tabText: {
    color: colors.light.mutedForeground,
  },
  tabTextActive: {
    color: colors.light.primaryForeground,
  },
  tabCount: {
    color: `${colors.light.mutedForeground}80`,
    fontSize: 10,
  },
  tabCountActive: {
    color: `${colors.light.primaryForeground}80`,
  },

  /* Controls */
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultLabel: {
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
    fontSize: 10,
  },
  controlsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    ...GLASS,
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...GLASS,
    position: "relative",
  },
  filterBtnActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.light.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: radii.full,
    ...GLASS,
    padding: 2,
  },
  viewBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnActive: {
    backgroundColor: INK,
  },

  /* Active chips */
  activeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    alignItems: "center",
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: INK,
  },
  clearChipLabel: {
    color: INK,
    textDecorationLine: "underline",
  },

  /* Product section */
  productSection: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  sectionNum: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    color: `${colors.light.foreground}25`,
  },
  sectionTitles: {
    flex: 1,
    gap: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(27, 28, 28, 0.12)",
  },

  /* Grid */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  gridItem: {
    width: CARD_WIDTH,
  },

  /* List */
  listItem: {
    flexDirection: "row",
    gap: spacing[3],
    borderRadius: radii.xl,
    padding: spacing[3],
    marginBottom: spacing[2],
    ...GLASS,
  },
  listImage: {
    width: 90,
    height: 120,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.light.muted,
  },
  listImageInner: {
    width: "100%",
    height: "100%",
  },
  listDiscount: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: colors.accent2.rust,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  listDiscountText: {
    color: "#fff",
    fontSize: 9,
  },
  listInfo: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
  },
  listBrand: {
    color: colors.light.mutedForeground,
  },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  listRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  listPriceCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },

  /* Brands */
  brandGrid: {
    gap: spacing[2],
  },
  brandCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    ...GLASS,
  },
  brandInfo: {
    flex: 1,
    gap: 2,
  },

  /* Stores */
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    ...GLASS,
  },
  storeInfo: {
    flex: 1,
    gap: 2,
  },
  storeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },

  /* Related */
  relatedSection: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: "rgba(27, 28, 28, 0.08)",
    gap: spacing[3],
  },

  /* Recs (no-results fallback) */
  recsSection: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  recsScroll: {
    gap: spacing[3],
    paddingRight: spacing[5],
  },
  recsLoading: {
    paddingVertical: spacing[6],
    alignItems: "center",
  },
});
