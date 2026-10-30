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
import { SearchResultCard, SearchResultRow } from "@/components/search/SearchResultCard";
import { SearchFilterSheet } from "@/components/search/SearchFilterSheet";
import { SearchOrbitChrome } from "@/components/search/SearchOrbitChrome";
import { SearchDiscover } from "@/components/search/SearchDiscover";
import { SearchSuggestions } from "@/components/search/SearchSuggestions";
import { ProductGridControls } from "@/components/products/ProductGridControls";
import { Display, Label, Body } from "@/components/ui/Typography";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedScrollView, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { Button } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { colors, radii, spacing, typography, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import { SORTS, PRICE_BOUNDS, EMPTY_FILTERS, activeFilterCount as computeActiveFilterCount } from "@/lib/api/facets";
import { applySearchFilters } from "@/lib/search-filters";
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
import { C } from "@/components/orders/parcel-track";
import {
  getFashionKeywordCompletions,
  matchCategories,
  matchBrands,
} from "@/lib/search/suggestion-engine";

const GRID_GAP = 12;
const GRID_PADDING = 16;

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
  const [parsedAttrs, setParsedAttrs] = useState<import("@/lib/api/backend").SearchParsedAttrs | null>(null);
  const [rescued, setRescued] = useState(false);
  const [droppedAttrs, setDroppedAttrs] = useState<string[]>([]);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
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

  // `spell: "off"` = "Search instead for <original>" (no typo correction).
  const doSearch = useCallback(async (term: string, opts?: { spell?: "auto" | "off" }) => {
    const q = term.trim();
    if (!q) return;
    setQuery(q);
    setDraft(q);
    setLoading(true);
    setSearched(true);
    saveRecent(q);

    const [productRes, brandRes, storeRes, catRes] = await Promise.all([
      // Facets refine this set client-side — fetch the backend max so they see it all.
      api.searchProductsWithMeta(q, 60, { spell: opts?.spell }),
      api.getBrands({ search: q }),
      api.getFeaturedStores(20),
      api.getCategories(20),
    ]);

    const productCount = productRes.ok ? productRes.data.products.length : 0;
    if (productRes.ok) {
      setResults(productRes.data.products);
      setParsedAttrs(productRes.data.parsed_attrs);
      setRescued(productRes.data.rescued);
      setDroppedAttrs(productRes.data.dropped_attrs);
      setCorrectedQuery(productRes.data.corrected_query);
    } else {
      setCorrectedQuery(null);
    }
    if (brandRes.ok) setBrands(brandRes.data.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())));
    if (storeRes.ok) setStores(storeRes.data.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())));
    if (catRes.ok) setCategories(catRes.data.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())));
    setLoading(false);

    // Track the search for personalization.
    tracker.search(q, tokenizeQuery(q), productCount);
  }, [saveRecent, tracker]);

  const removeAttrToken = useCallback((token: string) => {
    const next = query
      .split(/\s+/)
      .filter((w) => w.toLowerCase() !== token.toLowerCase())
      .join(" ")
      .trim();
    if (next) void doSearch(next);
  }, [query, doSearch]);

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
    const list = [...applySearchFilters(results, filters)];

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
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.45, 1]}
        style={styles.glow}
      />
      <SearchOrbitChrome
        topInset={insets.top}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={() => doSearch(draft)}
        onClear={resetSearch}
        searched={searched}
        query={query}
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
              onVisualSearch={() => runScan("library")}
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
            <AnimatedScrollView
              showsVerticalScrollIndicator={false}
              onScroll={tabBarScrollHandler}
              scrollEventThrottle={16}
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: expandableTabBarInset(insets.bottom) + spacing[4] }}
            >
              {/* Editorial results header */}
              <View style={styles.resultsHero}>
                <View style={styles.resultsKickerRow}>
                  <View style={styles.resultsKickerDot} />
                  <Text style={styles.resultsKicker}>
                    {totalCount} {totalCount === 1 ? "result" : "results"}
                    {brandCount + storeCount > 0 ? ` · ${productCount} pieces` : ""}
                  </Text>
                </View>
                <Text style={styles.resultsQuery} numberOfLines={2}>
                  “{query}”
                </Text>

                {/* Smart-search: what we understood from the query */}
                {parsedAttrs && (parsedAttrs.colors.length > 0 || parsedAttrs.garment || parsedAttrs.material) ? (
                  <View style={styles.understoodRow}>
                    <View style={styles.understoodLabel}>
                      <Ionicons name="sparkles" size={11} color={colors.accent2.ochre} />
                      <Text style={styles.understoodText}>Understood as</Text>
                    </View>
                    {parsedAttrs.colors.map((c) =>
                      droppedAttrs.includes(c) ? (
                        <View key={`dropped-${c}`} style={[styles.attrPill, styles.attrPillDropped]}>
                          <Text style={[styles.attrPillText, styles.attrPillTextDropped]}>{c}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          key={`color-${c}`}
                          style={styles.attrPill}
                          onPress={() => removeAttrToken(c)}
                          activeOpacity={0.8}
                          accessibilityLabel={`Remove ${c} from search`}
                        >
                          <View style={[styles.attrSwatch, { backgroundColor: c }]} />
                          <Text style={styles.attrPillText}>{c}</Text>
                          <Ionicons name="close" size={11} color={colors.olive[200]} />
                        </TouchableOpacity>
                      ),
                    )}
                    {[parsedAttrs.garment, parsedAttrs.material].filter(Boolean).map((t) => (
                      <TouchableOpacity
                        key={`attr-${t}`}
                        style={styles.attrPill}
                        onPress={() => removeAttrToken(t!)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Remove ${t} from search`}
                      >
                        <Text style={styles.attrPillText}>{t}</Text>
                        <Ionicons name="close" size={11} color={colors.olive[200]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {/* Spell-correction banner — backend fixed a typo ("sneekers" → "sneakers") */}
                {correctedQuery ? (
                  <View style={styles.rescueBanner} accessibilityLiveRegion="polite">
                    <Ionicons name="sparkles-outline" size={14} color={colors.olive[700]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rescueText} numberOfLines={1}>
                        Showing results for <Text style={styles.correctedTerm}>{correctedQuery}</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => void doSearch(query, { spell: "off" })}
                        accessibilityRole="button"
                        accessibilityLabel={`Search instead for ${query}`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.searchInsteadText} numberOfLines={1}>
                          Search instead for <Text style={styles.searchInsteadTerm}>{query}</Text>
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* Rescue banner — results were found after relaxing attrs */}
                {rescued && parsedAttrs ? (
                  <View style={styles.rescueBanner}>
                    <Ionicons name="compass-outline" size={14} color={colors.olive[700]} />
                    <Text style={styles.rescueText} numberOfLines={2}>
                      No exact matches — showing the closest pieces
                      {parsedAttrs.garment ? ` for ${[...parsedAttrs.colors.filter((c) => !droppedAttrs.includes(c)), parsedAttrs.garment].filter(Boolean).join(" ")}` : ""}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Tabs — only worth showing when brands/stores also matched */}
              {brandCount + storeCount > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabBar}
                >
                  <View style={styles.tabTrack}>
                    {TABS.map((t) => {
                      const count =
                        t.key === "all" ? totalCount :
                        t.key === "products" ? productCount :
                        t.key === "brands" ? brandCount :
                        storeCount;
                      const isActive = tab === t.key;
                      if (count === 0 && t.key !== "all" && !isActive) return null;
                      return (
                        <TouchableOpacity
                          key={t.key}
                          style={[styles.tab, isActive && styles.tabActive]}
                          onPress={() => setTab(t.key)}
                          activeOpacity={0.85}
                          accessibilityState={{ selected: isActive }}
                        >
                          <Ionicons
                            name={t.icon}
                            size={13}
                            color={isActive ? colors.olive[200] : colors.light.mutedForeground}
                          />
                          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
                          <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>{count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : null}

              {showingProducts ? (
                <ProductGridControls
                  sort={sort}
                  setSort={handleSearchSortChange}
                  sorts={SORTS}
                  view={view}
                  setView={(v) => setView(v === "list" ? "list" : "grid")}
                  viewModes={["grid", "list"]}
                  filterCount={activeFilterCount}
                  openFilter={() => setFilterVisible(true)}
                  filters={filters}
                  setFilters={setFilters}
                  summary={`${productCount} ${productCount === 1 ? "piece" : "pieces"} · ${SORTS.find((s) => s.value === sort)?.label ?? "Newest"}`}
                />
              ) : null}

              <View style={styles.resultsBody}>
                {/* Products */}
                {showingProducts && productCount === 0 ? (
                  <View style={styles.filteredEmpty}>
                    <Ionicons name="funnel-outline" size={18} color={colors.olive[700]} />
                    <Text style={styles.filteredEmptyTitle}>Nothing matches these filters</Text>
                    <TouchableOpacity onPress={() => setFilters({ ...EMPTY_FILTERS })} activeOpacity={0.8}>
                      <Text style={styles.filteredEmptyCta}>Clear filters</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {showingProducts && productCount > 0 && (
                  <View style={styles.productSection}>
                    {tab === "all" && brandCount + storeCount > 0 && (
                      <SectionHeader title="Pieces" count={productCount} />
                    )}
                    {view === "list" ? (
                      filtered.map((p, i) => (
                        <SearchResultRow key={p.id} product={p} index={i} onPress={handleResultPress} />
                      ))
                    ) : (
                      <View style={styles.grid}>
                        {filtered.map((p, i) => (
                          <SearchResultCard
                            key={p.id}
                            product={p}
                            width={cardWidth}
                            index={i}
                            onPress={handleResultPress}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Brands */}
                {(tab === "all" || tab === "brands") && brandCount > 0 && (
                  <View style={styles.productSection}>
                    {tab === "all" && <SectionHeader title="Brands" count={brandCount} />}
                    <View style={styles.brandGrid}>
                      {matchedBrands.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={styles.entityCard}
                          activeOpacity={0.85}
                          onPress={() => router.push(`/(main)/brands/${b.slug}` as never)}
                        >
                          <View style={styles.entityAvatarRing}>
                            <Avatar name={b.name} uri={b.logo_url} size={46} />
                          </View>
                          <View style={styles.entityInfo}>
                            <Text style={styles.entityName} numberOfLines={1}>{b.name}</Text>
                            <Text style={styles.entityMeta}>{b.total_followers} followers</Text>
                          </View>
                          <View style={styles.resultChevron}>
                            <Ionicons name="arrow-forward" size={14} color={colors.paper.cream} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Stores */}
                {(tab === "all" || tab === "stores") && storeCount > 0 && (
                  <View style={styles.productSection}>
                    {tab === "all" && <SectionHeader title="Ateliers" count={storeCount} />}
                    <View style={styles.brandGrid}>
                      {matchedStores.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={styles.entityCard}
                          activeOpacity={0.85}
                          onPress={() => router.push(`/(main)/stores/${s.slug}` as never)}
                        >
                          <View style={styles.entityAvatarRing}>
                            <Avatar name={s.name} uri={s.logo_url} size={46} />
                          </View>
                          <View style={styles.entityInfo}>
                            <Text style={styles.entityName} numberOfLines={1}>{s.name}</Text>
                            {s.description ? (
                              <Text style={styles.entityMeta} numberOfLines={1}>{s.description}</Text>
                            ) : null}
                            <View style={styles.storeMeta}>
                              <Ionicons name="star" size={10} color={colors.accent2.ochre} />
                              <Text style={styles.entityMetaStrong}>{s.rating.toFixed(1)}</Text>
                              <Text style={styles.entityMeta}>· {s.total_products} pieces</Text>
                            </View>
                          </View>
                          <View style={styles.resultChevron}>
                            <Ionicons name="arrow-forward" size={14} color={colors.paper.cream} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Related searches */}
                <LinearGradient
                  colors={[colors.olive[950], "#22261a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.relatedSection}
                >
                  <View style={styles.resultsKickerRow}>
                    <View style={[styles.resultsKickerDot, { backgroundColor: colors.accent2.ochre }]} />
                    <Text style={[styles.resultsKicker, { color: colors.olive[300] }]}>Keep exploring</Text>
                  </View>
                  <Text style={styles.relatedTitle}>Related searches</Text>
                  <View style={styles.relatedChips}>
                    {SUGGESTIONS.filter((s) => s.toLowerCase() !== query.toLowerCase()).slice(0, 5).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={styles.relatedChip}
                        onPress={() => doSearch(s)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.relatedChipText}>{s}</Text>
                        <Ionicons name="arrow-forward" size={12} color={colors.olive[300]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </LinearGradient>
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
        products={results}
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

/* ─── Section header (All tab) ─── */
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.resultSectionHeader}>
      <Display size="lg">{title}</Display>
      <Text style={styles.sectionCount}>{String(count).padStart(2, "0")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.paper,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 520,
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
    flex: 1,
  },
  resultsHero: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  resultsKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  resultsKickerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.olive[500],
  },
  resultsKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  resultsQuery: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
    color: INK,
  },
  understoodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[1],
  },
  understoodLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 2,
  },
  understoodText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  attrPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingLeft: 11,
    paddingRight: 9,
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  attrPillDropped: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.light.border,
  },
  attrPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.paper.cream,
    textTransform: "capitalize",
  },
  attrPillTextDropped: {
    color: colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  attrSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.6)",
  },
  rescueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[1],
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive[200],
  },
  rescueText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.olive[800],
  },
  correctedTerm: {
    fontFamily: fontFamilies.sans.semibold,
    fontStyle: "italic",
    color: colors.olive[900],
  },
  searchInsteadText: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.olive[700],
  },
  searchInsteadTerm: {
    textDecorationLine: "underline",
    color: colors.olive[800],
  },
  resultsBody: {
    paddingHorizontal: GRID_PADDING,
  },
  filteredEmpty: {
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing[8],
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.light.border,
  },
  filteredEmptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: INK,
  },
  filteredEmptyCta: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.accent2.rust,
    textDecorationLine: "underline",
  },

  /* Tabs */
  tabBar: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: spacing[4],
  },
  tabTrack: {
    flexDirection: "row",
    padding: 4,
    gap: 2,
    borderRadius: radii.full,
    backgroundColor: `${colors.olive[900]}0D`,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
  },
  tabActive: {
    backgroundColor: colors.olive[950],
  },
  tabText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.paper.cream,
  },
  tabCount: {
    color: `${colors.light.mutedForeground}99`,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
  },
  tabCountActive: {
    color: colors.olive[300],
  },

  /* Product section */
  productSection: {
    gap: spacing[3],
    marginTop: spacing[1],
    marginBottom: spacing[4],
  },
  resultSectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  sectionCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.light.mutedForeground,
  },

  /* Grid */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: GRID_GAP,
    rowGap: GRID_GAP + 4,
  },

  /* Brands + stores */
  brandGrid: {
    gap: spacing[2],
  },
  entityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: 10,
    paddingRight: 12,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[900]}14`,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  entityAvatarRing: {
    padding: 2,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  entityInfo: {
    flex: 1,
    gap: 2,
  },
  entityName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: INK,
  },
  entityMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  entityMetaStrong: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: INK,
  },
  resultChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.olive[950],
    alignItems: "center",
    justifyContent: "center",
  },
  storeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },

  /* Related */
  relatedSection: {
    marginTop: spacing[3],
    padding: spacing[5],
    borderRadius: 26,
    gap: spacing[2],
    overflow: "hidden",
  },
  relatedTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 24,
    color: colors.paper.cream,
    marginBottom: spacing[2],
  },
  relatedChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  relatedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.07)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.22)",
  },
  relatedChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.paper.cream,
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
