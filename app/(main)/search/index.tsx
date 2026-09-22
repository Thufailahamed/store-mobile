import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/product/ProductCard";
import { SearchFilterSheet } from "@/components/search/SearchFilterSheet";
import { SearchOrbitChrome } from "@/components/search/SearchOrbitChrome";
import { SearchDiscover } from "@/components/search/SearchDiscover";
import { SearchSuggestions } from "@/components/search/SearchSuggestions";
import { QuickRefine } from "@/components/search/QuickRefine";
import { Display, Label, Body } from "@/components/ui/Typography";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedScrollView, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { Button } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { colors, radii, spacing, typography, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import { SORTS, PRICE_BOUNDS, activeFilterCount as computeActiveFilterCount } from "@/lib/api/facets";
import type { ProductFilters } from "@/lib/api/facets";
import * as api from "@/lib/api";
import type { V2Suggestion, WishlistPriceDrop } from "@/lib/api";
import type { Product, Brand, Store, Category } from "@/lib/types";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useTrackEvent, getForYouRail } from "@/lib/recommender";
import { tokenizeQuery, expandQueryTerms, buildDidYouMean } from "@/lib/utils/search-utils";
import { useAuth } from "@/lib/supabase/auth";
import { HomeProductCard } from "@/components/home/premium/HomeProductCard";
import { pickImage, takePhoto } from "@/lib/upload";
import {
  getFashionKeywordCompletions,
  matchCategories,
  matchBrands,
} from "@/lib/search/suggestion-engine";

const GRID_GAP = 10;
const GRID_PADDING = 20;

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
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - GRID_PADDING * 2 - GRID_GAP) / 2;
  const tabBarScrollHandler = useHideTabBarOnScroll();

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
  const [suggestions, setSuggestions] = useState<V2Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [priceDrops, setPriceDrops] = useState<WishlistPriceDrop[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
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

  const [preloadedCategories, setPreloadedCategories] = useState<Category[]>([]);
  const [preloadedBrands, setPreloadedBrands] = useState<Brand[]>([]);

  // Load recent searches from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem("luxe_search_history").then((v) => {
      if (!v) return;
      try {
        const parsed = JSON.parse(v);
        if (!Array.isArray(parsed)) return;
        // Cap loaded history to 20 entries.
        setRecentSearches(parsed.slice(0, 20));
      } catch {}
    });

    // Warm up categories and brands cache for instant 0ms suggestions
    let cancelled = false;
    Promise.all([api.getCategories(50), api.getBrands({ limit: 50 })]).then(([catRes, brandRes]) => {
      if (cancelled) return;
      if (catRes.ok) setPreloadedCategories(catRes.data);
      if (brandRes.ok) setPreloadedBrands(brandRes.data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveRecent = useCallback(async (term: string) => {
    // Cap to 20 most recent unique searches so AsyncStorage stays bounded.
    const next = [term, ...recentSearches.filter((r) => r !== term)].slice(0, 20);
    setRecentSearches(next);
    try {
      await AsyncStorage.setItem("luxe_search_history", JSON.stringify(next));
    } catch {}
  }, [recentSearches]);

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
  }, [saveRecent, tracker]);

  const handleResultPress = useCallback(
    (p: Product) => {
      tracker.searchResultClick(query, p);
      router.push(`/(main)/products/${p.slug}`);
    },
    [query, router, tracker],
  );

  const handleSearchSortChange = useCallback(
    (next: string) => {
      if (next !== sort) tracker.sortUsed(next, "search");
      setSort(next);
    },
    [sort, tracker],
  );

  const handleSearchFilterChange = useCallback(
    (next: ProductFilters) => {
      const before = computeActiveFilterCount(filters);
      const after = computeActiveFilterCount(next);
      if (after > before) {
        // Pick the first added facet key in the same order the products screen
        // would have picked — colours/sizes/brands/etc. The exact value isn't
        // load-bearing for the ranker; the surface+key combo is.
        const keys: (keyof ProductFilters)[] = [
          "price",
          "colors",
          "sizes",
          "brands",
          "categories",
        ];
        for (const k of keys) {
          const a = (filters[k] as unknown as unknown[]) ?? [];
          const b = (next[k] as unknown as unknown[]) ?? [];
          const set = new Set<string>(a.map((x) => String(x)));
          const added = b.find((v) => !set.has(String(v)));
          if (added !== undefined) {
            tracker.filterUsed(`${k}:${String(added)}`, "search");
            break;
          }
        }
      }
      setFilters(next);
    },
    [filters, tracker],
  );

  const localSuggestions = useMemo<V2Suggestion[]>(() => {
    const term = draft.trim().toLowerCase();
    if (!term) return [];

    const items: V2Suggestion[] = [];

    // 1. Recent searches matching term
    for (const label of recentSearches) {
      if (label.toLowerCase().includes(term)) {
        items.push({ kind: "keyword", label });
      }
    }

    // 2. Matching categories (Shirts, Dresses, Shoes, etc.)
    const activeCategories = preloadedCategories.length > 0 ? preloadedCategories : categories;
    const catMatches = matchCategories(term, activeCategories, 3);
    for (const c of catMatches) {
      if (!items.some((i) => i.label.toLowerCase() === c.label.toLowerCase())) {
        items.push(c);
      }
    }

    // 3. Matching brands / ateliers
    const activeBrands = preloadedBrands.length > 0 ? preloadedBrands : brands;
    const brandMatches = matchBrands(term, activeBrands, 3);
    for (const b of brandMatches) {
      if (!items.some((i) => i.label.toLowerCase() === b.label.toLowerCase())) {
        items.push(b);
      }
    }

    // 4. Comprehensive Fashion Taxonomy completions (Shirts, Linen Shirt, Oversized Shirt, etc.)
    const keywordCompletions = getFashionKeywordCompletions(term, 8);
    for (const k of keywordCompletions) {
      if (!items.some((i) => i.label.toLowerCase() === k.label.toLowerCase())) {
        items.push(k);
      }
    }

    return items;
  }, [draft, recentSearches, preloadedCategories, categories, preloadedBrands, brands]);

  useEffect(() => {
    const term = debouncedDraft.trim();
    if (term.length < 1) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    api.getSearchSuggestionsV2(term).then((res) => {
      if (cancelled) return;
      setSuggestions(res.ok ? res.data : []);
      setSuggestionsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedDraft]);

  // Fetch wishlist price drops once (when authenticated) so the suggestion
  // overlay can show "Price dropped on items you wishlisted".
  useEffect(() => {
    if (!user) {
      setPriceDrops([]);
      return;
    }
    let cancelled = false;
    api.getWishlistPriceDrops().then((res) => {
      if (cancelled) return;
      setPriceDrops(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Run an image / camera scan, upload, then route to the match (or /scan). */
  const runScan = useCallback(
    async (source: "library" | "camera") => {
      if (scanBusy) return;
      setScanBusy(true);
      tracker.scan(source);
      try {
        const picker = source === "camera" ? takePhoto : pickImage;
        const result = await picker({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result || result.canceled) {
          setScanBusy(false);
          return;
        }
        const uri = result.assets?.[0]?.uri;
        if (!uri) {
          setScanBusy(false);
          return;
        }
        const upload = await api.uploadScanImage(uri, source);
        if (!upload.ok) {
          router.push("/scan");
          return;
        }
        router.push({
          pathname: "/(main)/search/image-results",
          params: { url: upload.data.url, preview: uri },
        });
      } catch {
        router.push("/scan");
      } finally {
        setScanBusy(false);
      }
    },
    [router, scanBusy, tracker],
  );

  const showSuggestions =
    draft.trim().length >= 1 &&
    (!searched || draft.trim().toLowerCase() !== query.trim().toLowerCase());

  const handleSuggestionSelect = useCallback(
    (suggestion: V2Suggestion) => {
      tracker.searchSuggestion(draft, suggestion.label);
      if (suggestion.kind === "store" && suggestion.slug) {
        router.push(`/(main)/stores/${suggestion.slug}`);
        return;
      }
      if (suggestion.kind === "brand" && suggestion.slug) {
        router.push(`/(main)/products?brand=${suggestion.slug}`);
        return;
      }
      doSearch(suggestion.label);
    },
    [doSearch, draft, router, tracker],
  );

  // Client-side filter + sort pipeline
  // Smart-search "Did you mean?" reformulations. Computed only when
  // the user has a multi-token query that returned zero results.
  const didYouMean = useMemo(() => {
    if (!query) return [];
    const trimmed = query.trim();
    const tokens = trimmed.split(/\s+/).filter((t) => t.length >= 2);
    if (tokens.length < 2) return [];
    return buildDidYouMean(trimmed, expandQueryTerms(trimmed));
  }, [query]);

  const filtered = useMemo(() => {
    let list = [...results];


    // Price filter
    if (filters.price && (filters.price[0] > PRICE_BOUNDS.min || filters.price[1] < PRICE_BOUNDS.max)) {
      list = list.filter((p) => p.price >= filters.price![0] && p.price <= filters.price![1]);
    }

    // Color filter
    if (filters.colors && filters.colors.length > 0) {
      list = list.filter((p) => {
        const pColors = (p.variants ?? []).map((v) => (v.color ?? "").toLowerCase());
        return filters.colors!.some((c) => {
          const cl = c.toLowerCase();
          return pColors.some((pc) => pc.includes(cl) || cl.includes(pc));
        });
      });
    }

    // Size filter
    if (filters.sizes && filters.sizes.length > 0) {
      list = list.filter((p) => {
        const pSizes = (p.variants ?? []).map((v) => (v.size ?? "").toUpperCase());
        return filters.sizes!.some((s) => pSizes.includes(s.toUpperCase()));
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

  const productCount = filtered.length;
  const brandCount = matchedBrands.length;
  const storeCount = matchedStores.length;
  const totalCount = productCount + brandCount + storeCount;
  const displayedCount =
    tab === "products" ? productCount : tab === "brands" ? brandCount : tab === "stores" ? storeCount : totalCount;
  const showingProducts = tab === "all" || tab === "products";

  const activeFilterCount = computeActiveFilterCount(filters);

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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <SearchOrbitChrome
        topInset={insets.top}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={() => doSearch(draft)}
        onClear={resetSearch}
        searched={searched}
        query={query}
        totalCount={totalCount}
        onImageSearch={() => runScan("library")}
        onCameraSearch={() => runScan("camera")}
      />

      {showSuggestions ? (
        <SearchSuggestions
          draft={draft}
          suggestions={suggestions}
          localSuggestions={localSuggestions}
          loading={suggestionsLoading}
          priceDrops={priceDrops}
          onSelect={handleSuggestionSelect}
          onSearchDraft={() => doSearch(draft)}
          onSearchDraftWith={(t) => {
            setDraft(t);
            doSearch(t);
          }}
          onImageSearch={() => runScan("library")}
          onCameraSearch={() => runScan("camera")}
          onPriceDropPress={(d) => router.push(`/(main)/products/${d.slug}`)}
        />
      ) : (
        <View style={styles.body}>
          {!searched ? (
            <SearchDiscover
              recentSearches={recentSearches}
              onSearch={doSearch}
              onClearRecent={clearRecent}
            />
          ) : loading ? (
          /* ─── Loading ─── */
          <View style={styles.center}>
            <ActivityIndicator size="large" color={INK} />
            <Body muted style={{ marginTop: spacing[3], color: MUTED }}>Searching the atelier…</Body>
          </View>
        ) : totalCount === 0 ? (
          /* ─── No results ─── */
          <ScrollViewWrapper>
            <View style={styles.emptyCard}>
              {/* Concentric Gold Medallion */}
              <View style={styles.emptyMedallionOuter}>
                <View style={styles.emptyMedallionMiddle}>
                  <LinearGradient
                    colors={["#242621", "#151613"]}
                    style={styles.emptyMedallionInner}
                  >
                    <Ionicons name="search" size={24} color="#D4AF37" />
                  </LinearGradient>
                </View>
                <View style={styles.emptySparkleBadge}>
                  <Ionicons name="sparkles" size={10} color="#85651B" />
                </View>
              </View>

              {/* Atelier Kicker & Title */}
              <View style={styles.emptyTextBlock}>
                <View style={styles.emptyKickerRow}>
                  <View style={styles.kickerDot} />
                  <Label style={styles.emptyKickerText}>THE ARCHIVE EDIT</Label>
                  <View style={styles.kickerDot} />
                </View>
                <Display size="xl" style={styles.emptyTitle}>
                  No Direct Matches
                </Display>
                <Body muted style={styles.emptyDesc}>
                  We couldn't locate any pieces matching{" "}
                  <Text style={styles.emptyQueryHighlight}>“{query}”</Text>. Try a different keyword or explore tailored atelier selections below.
                </Body>
              </View>

              {/* Did you mean suggestion banner */}
              {didYouMean.length > 0 && (
                <View style={styles.didYouMeanContainer}>
                  <View style={styles.didYouMeanHeader}>
                    <Ionicons name="compass-outline" size={13} color={colors.olive[700]} />
                    <Label style={styles.didYouMeanTitle}>SUGGESTED ALTERNATIVE</Label>
                  </View>
                  <View style={styles.chipRow}>
                    {didYouMean.map((s) => (
                      <TouchableOpacity
                        key={`dym-${s}`}
                        style={styles.didYouMeanChip}
                        onPress={() => doSearch(s)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="sparkles" size={13} color="#E8CF8F" />
                        <Body size="sm" style={styles.didYouMeanText}>{s}</Body>
                        <Ionicons name="arrow-forward" size={12} color="#E8CF8F" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Alternative Search Ideas */}
              {(() => {
                const filteredSuggestions = SUGGESTIONS.filter(
                  (s) => s.toLowerCase().trim() !== query.toLowerCase().trim()
                ).slice(0, 4);
                if (filteredSuggestions.length === 0) return null;
                return (
                  <View style={styles.suggestionsContainer}>
                    <Label style={styles.suggestionsHeader}>POPULAR DISCOVERIES</Label>
                    <View style={styles.chipRow}>
                      {filteredSuggestions.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={styles.suggestionChip}
                          onPress={() => doSearch(s)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="search-outline" size={12} color={colors.olive[700]} style={{ marginRight: 6 }} />
                          <Body size="sm" style={styles.suggestionChipText}>{s}</Body>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })()}

              {/* Primary Luxury CTA */}
              <TouchableOpacity
                style={styles.browseAllBtn}
                onPress={() => router.push("/(main)/products")}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#242621", "#151613"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.browseAllGradient}
                >
                  <Ionicons name="compass-outline" size={16} color="#E8CF8F" />
                  <Body size="sm" style={styles.browseAllText}>
                    Explore All Collections
                  </Body>
                  <Ionicons name="arrow-forward" size={14} color="#E8CF8F" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Recommendations Rail */}
            {recsLoading ? (
              <View style={styles.recsLoading}>
                <ActivityIndicator size="small" color={INK} />
              </View>
            ) : recs.length > 0 ? (
              <View style={styles.recsSection}>
                <View style={styles.recsHeader}>
                  <View style={styles.recsBadge}>
                    <Ionicons name="star" size={13} color="#C8A44A" />
                  </View>
                  <View style={styles.recsTitles}>
                    <Display size="md" style={styles.recsTitle}>Curated For You</Display>
                    <Body size="xs" muted style={styles.recsSubtitle}>Pieces from the atelier you might adore instead</Body>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recsScroll}
                >
                  {recs.map((p, idx) => (
                    <HomeProductCard key={p.id} product={p} showSaleBadge index={idx} size="large" />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </ScrollViewWrapper>
        ) : (
          /* ─── Results ─── */
          <View style={styles.resultsContainer}>
            {/* Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabBarBleed}
              contentContainerStyle={styles.tabBar}
            >
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
            </ScrollView>

            {showingProducts ? (
              <View style={styles.quickRefineBleed}>
                <QuickRefine
                  filters={filters}
                  onChange={setFilters}
                  onOpenSheet={() => setFilterVisible(true)}
                  activeCount={activeFilterCount}
                />
              </View>
            ) : null}

            {/* Controls bar */}
            <View style={styles.controlsBar}>
              <View>
                <Body size="xs" muted style={styles.resultLabel}>
                  {displayedCount} result{displayedCount === 1 ? "" : "s"}
                </Body>
                <Body size="xs" muted style={styles.resultContext} numberOfLines={1}>
                  {tab === "all" ? `Across products, brands and stores` : `Showing ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}`}
                </Body>
              </View>
              {showingProducts ? (
                <View style={styles.controlsRight}>
                  {/* Sort */}
                  <TouchableOpacity
                    style={styles.sortBtn}
                    onPress={() => {
                      const keys = SORTS.map((s) => s.value);
                      const idx = keys.indexOf(sort);
                      handleSearchSortChange(keys[(idx + 1) % keys.length]);
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
              ) : null}
            </View>

            {/* Scrollable results list */}
            <AnimatedScrollView
              showsVerticalScrollIndicator={false}
              onScroll={tabBarScrollHandler}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingBottom: expandableTabBarInset(insets.bottom) + spacing[4] }}
            >
              {/* Active filter chips */}
              {showingProducts && activeFilterCount > 0 && (
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
                        onPress={() => handleResultPress(p)}
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
                        <View key={p.id} style={[styles.gridItem, { width: cardWidth }]}>
                          <ProductCard product={p} surface />
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
                      <TouchableOpacity
                        key={b.id}
                        style={styles.brandCard}
                        activeOpacity={0.8}
                        onPress={() => router.push(`/(main)/brands/${b.slug}` as never)}
                      >
                        <Avatar name={b.name} uri={b.logo_url} size={44} />
                        <View style={styles.brandInfo}>
                          <Body size="sm" style={{ fontWeight: "600" }}>{b.name}</Body>
                          <Body size="xs" muted>{b.total_followers} followers</Body>
                        </View>
                        <View style={styles.resultChevron}>
                          <Ionicons name="chevron-forward" size={13} color={colors.olive[700]} />
                        </View>
                      </TouchableOpacity>
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
                    <TouchableOpacity
                      key={s.id}
                      style={styles.storeCard}
                      activeOpacity={0.8}
                      onPress={() => router.push(`/(main)/stores/${s.slug}` as never)}
                    >
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
                      <View style={styles.resultChevron}>
                        <Ionicons name="chevron-forward" size={13} color={colors.olive[700]} />
                      </View>
                    </TouchableOpacity>
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
            </AnimatedScrollView>
          </View>
        )}
        </View>
      )}

      {/* Filter sheet */}
      <SearchFilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApply={handleSearchFilterChange}
        sort={sort}
        onSortChange={handleSearchSortChange}
        resultCount={productCount}
      />
    </KeyboardAvoidingView>
  );
}

/* ─── ScrollView wrapper for empty state ─── */
function ScrollViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: expandableTabBarInset(insets.bottom) + spacing[4] }}
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
    backgroundColor: colors.paper.DEFAULT,
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
    marginRight: -spacing[2],
    marginBottom: -spacing[2],
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    marginRight: spacing[2],
    marginBottom: spacing[2],
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
  },
  didYouMeanRow: {
    width: "100%",
    marginBottom: spacing[3],
    alignItems: "center",
  },
  didYouMeanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing[2],
  },
  didYouMeanChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: INK,
    borderWidth: 1,
    borderColor: `${colors.olive[400]}40`,
    gap: 6,
  },
  recentChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    marginRight: spacing[2],
    marginBottom: spacing[2],
    maxWidth: "100%",
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
  emptyCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[2],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[7],
    alignItems: "center",
    ...shadows.soft,
  },
  emptyMedallionOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.olive[500]}10`,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}25`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
    position: "relative",
  },
  emptyMedallionMiddle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: `${colors.olive[500]}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMedallionInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySparkleBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FAF8F5",
    borderWidth: 1.5,
    borderColor: "#E5E0D5",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTextBlock: {
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  emptyKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.olive[600],
  },
  emptyKickerText: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.medium,
    color: colors.olive[700],
    letterSpacing: 1.5,
  },
  emptyTitle: {
    textAlign: "center",
    color: INK,
  },
  emptyDesc: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    paddingHorizontal: spacing[2],
  },
  emptyQueryHighlight: {
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
  },
  didYouMeanContainer: {
    width: "100%",
    backgroundColor: `${colors.olive[500]}08`,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}20`,
    borderRadius: radii.xl,
    padding: spacing[3],
    marginBottom: spacing[4],
    alignItems: "center",
  },
  didYouMeanTitle: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.medium,
    color: colors.olive[800],
    letterSpacing: 1,
  },
  didYouMeanText: {
    color: "#FAF8F5",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  suggestionsContainer: {
    width: "100%",
    marginBottom: spacing[5],
    alignItems: "center",
  },
  suggestionsHeader: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.medium,
    color: MUTED,
    letterSpacing: 1,
    marginBottom: spacing[2],
  },
  suggestionChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: INK,
  },
  browseAllBtn: {
    width: "100%",
    borderRadius: radii.full,
    overflow: "hidden",
  },
  browseAllGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: 14,
    paddingHorizontal: spacing[4],
  },
  browseAllText: {
    color: "#FAF8F5",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  /* Results */
  resultsContainer: {
    gap: spacing[4],
    paddingHorizontal: spacing[5],
  },
  quickRefineBleed: {
    marginHorizontal: -spacing[5],
  },

  /* Tabs */
  tabBarBleed: {
    marginHorizontal: -spacing[5],
  },
  tabBar: {
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingRight: spacing[7],
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
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
    color: colors.olive[700],
  },
  resultContext: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    marginTop: 2,
    maxWidth: 165,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.olive[100],
    borderWidth: 1,
    borderColor: colors.olive[200],
    textAlign: "center",
    lineHeight: 30,
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: colors.olive[700],
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
  gridItem: {},

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
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  brandInfo: {
    flex: 1,
    gap: 2,
  },
  resultChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Stores */
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
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
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[3],
  },

  /* Recs (no-results fallback) */
  recsSection: {
    marginTop: spacing[6],
    marginBottom: spacing[8],
  },
  recsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  recsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.olive[500]}15`,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}30`,
    alignItems: "center",
    justifyContent: "center",
  },
  recsTitles: {
    flex: 1,
    gap: 2,
  },
  recsTitle: {
    color: INK,
  },
  recsSubtitle: {
    color: MUTED,
  },
  recsScroll: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  recsLoading: {
    paddingVertical: spacing[6],
    alignItems: "center",
  },
});
