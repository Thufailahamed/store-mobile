import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SearchResultTile } from "@/components/search/SearchResultTile";
import { fontFamilies } from "@/lib/theme/fonts";
import { getSimilarProducts, getYouMayAlsoLike } from "@/lib/recommender";
import { getProducts } from "@/lib/api";
import type { Product } from "@/lib/types";

export type TabKey = "all" | "similar" | "favourites";

interface TabOption {
  key: TabKey;
  label: string;
}

const TABS: TabOption[] = [
  { key: "all", label: "All" },
  { key: "similar", label: "Similar" },
  { key: "favourites", label: "Your Next Favourites" },
];

const PAGE_SIZE = 10;

interface InfiniteRecommendedFeedProps {
  currentProduct: Product;
  userId?: string | null;
  onRegisterLoadMore?: (loadMoreFn: () => void) => void;
}

export function InfiniteRecommendedFeed({
  currentProduct,
  userId,
  onRegisterLoadMore,
}: InfiniteRecommendedFeedProps) {
  const { width: screenWidth } = useWindowDimensions();
  // 2-column calculation matching 16px horizontal screen padding and 12px inter-card gap
  const cardWidth = Math.floor((screenWidth - 32 - 12) / 2);

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [itemsByTab, setItemsByTab] = useState<Record<TabKey, Product[]>>({
    all: [],
    similar: [],
    favourites: [],
  });
  const [offsetByTab, setOffsetByTab] = useState<Record<TabKey, number>>({
    all: 0,
    similar: 0,
    favourites: 0,
  });
  const [hasMoreByTab, setHasMoreByTab] = useState<Record<TabKey, boolean>>({
    all: true,
    similar: true,
    favourites: true,
  });
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentItems = itemsByTab[activeTab];
  const currentHasMore = hasMoreByTab[activeTab];
  // Latest items for loadMore's dedupe. loadMore can be a stale closure held
  // by the parent, so reading `itemsByTab` directly can miss items already
  // appended and re-add them, which produces duplicate React keys.
  const itemsRef = useRef(itemsByTab);
  itemsRef.current = itemsByTab;
  const loadingMoreRef = useRef(false);

  // Load initial batch for a tab
  const loadTabInitial = useCallback(
    async (tab: TabKey) => {
      setLoadingInitial(true);
      const seenIds = new Set<string>([currentProduct.id]);
      const collected: Product[] = [];

      try {
        if (tab === "similar") {
          const simRes = await getSimilarProducts(currentProduct, 12);
          if (simRes.ok && simRes.data) {
            for (const p of simRes.data) {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                collected.push(p);
              }
            }
          }
          // Fetch more from same category if needed
          if (collected.length < PAGE_SIZE && currentProduct.category?.slug) {
            const catRes = await getProducts({
              categorySlug: currentProduct.category.slug,
              gender: currentProduct.gender || undefined,
              limit: PAGE_SIZE,
              offset: 0,
            });
            if (catRes.ok && catRes.data?.products) {
              for (const p of catRes.data.products) {
                if (!seenIds.has(p.id)) {
                  seenIds.add(p.id);
                  collected.push(p);
                }
              }
            }
          }
        } else if (tab === "favourites") {
          const ymalRes = await getYouMayAlsoLike(userId ?? null, currentProduct, 12);
          if (ymalRes.ok && ymalRes.data) {
            for (const p of ymalRes.data) {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                collected.push(p);
              }
            }
          }
          if (collected.length < PAGE_SIZE) {
            const topRes = await getProducts({
              sort: "rating",
              limit: PAGE_SIZE,
              offset: 0,
            });
            if (topRes.ok && topRes.data?.products) {
              for (const p of topRes.data.products) {
                if (!seenIds.has(p.id)) {
                  seenIds.add(p.id);
                  collected.push(p);
                }
              }
            }
          }
        } else {
          // "all" - blend similar, favorites and fresh catalog items
          const [simRes, ymalRes, catRes] = await Promise.all([
            getSimilarProducts(currentProduct, 8),
            getYouMayAlsoLike(userId ?? null, currentProduct, 8),
            getProducts({
              categorySlug: currentProduct.category?.slug,
              limit: 8,
              offset: 0,
            }),
          ]);

          const pools = [
            simRes.ok ? simRes.data : [],
            ymalRes.ok ? ymalRes.data : [],
            catRes.ok ? catRes.data.products : [],
          ];

          // Interleave products from the pools
          const maxLen = Math.max(...pools.map((p) => p.length));
          for (let i = 0; i < maxLen; i++) {
            for (const pool of pools) {
              const p = pool[i];
              if (p && !seenIds.has(p.id)) {
                seenIds.add(p.id);
                collected.push(p);
              }
            }
          }
        }

        setItemsByTab((prev) => ({ ...prev, [tab]: collected }));
        setOffsetByTab((prev) => ({ ...prev, [tab]: collected.length }));
        setHasMoreByTab((prev) => ({ ...prev, [tab]: collected.length >= 6 }));
      } catch (e) {
        console.error("Failed to load recommendations for tab:", tab, e);
      } finally {
        setLoadingInitial(false);
      }
    },
    [currentProduct, userId],
  );

  // Trigger initial fetch when activeTab changes if not already loaded
  useEffect(() => {
    if (itemsByTab[activeTab].length === 0) {
      void loadTabInitial(activeTab);
    }
  }, [activeTab, itemsByTab, loadTabInitial]);

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    // Ref guard: the parent may call a stale closure where `loadingMore` is
    // still false, so two pages could be fetched and appended at once.
    if (loadingInitial || loadingMore || loadingMoreRef.current || !hasMoreByTab[activeTab]) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const currentOffset = offsetByTab[activeTab];
    const existing = itemsRef.current[activeTab];
    const seenIds = new Set<string>([currentProduct.id, ...existing.map((p) => p.id)]);

    try {
      let nextProducts: Product[] = [];
      if (activeTab === "similar") {
        const res = await getProducts({
          categorySlug: currentProduct.category?.slug,
          gender: currentProduct.gender || undefined,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        if (res.ok && res.data) nextProducts = res.data.products;
      } else if (activeTab === "favourites") {
        const res = await getProducts({
          sort: "rating",
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        if (res.ok && res.data) nextProducts = res.data.products;
      } else {
        const res = await getProducts({
          sort: "newest",
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        if (res.ok && res.data) nextProducts = res.data.products;
      }

      // Dedupe within the page too: the API can return the same product twice.
      const fresh: Product[] = [];
      for (const p of nextProducts) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          fresh.push(p);
        }
      }

      if (fresh.length === 0) {
        setHasMoreByTab((prev) => ({ ...prev, [activeTab]: false }));
      } else {
        // Dedupe against the latest state, not the snapshot taken before the fetch.
        setItemsByTab((prev) => {
          const have = new Set(prev[activeTab].map((p) => p.id));
          const add = fresh.filter((p) => !have.has(p.id));
          return add.length ? { ...prev, [activeTab]: [...prev[activeTab], ...add] } : prev;
        });
        setOffsetByTab((prev) => ({
          ...prev,
          [activeTab]: currentOffset + nextProducts.length,
        }));
      }
    } catch (e) {
      console.error("Failed to load more recommendations:", e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [
    activeTab,
    currentProduct,
    hasMoreByTab,
    itemsByTab,
    loadingInitial,
    loadingMore,
    offsetByTab,
  ]);

  // Register loadMore with the parent ScrollView
  useEffect(() => {
    onRegisterLoadMore?.(loadMore);
  }, [loadMore, onRegisterLoadMore]);

  if (!loadingInitial && currentItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* ── Section Title ────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Products you may like</Text>

      {/* ── Filter Pills / Tabs ─────────────────────────────────── */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
              style={[styles.tabPill, isActive ? styles.tabPillActive : styles.tabPillInactive]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabPillText,
                  isActive ? styles.tabPillTextActive : styles.tabPillTextInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── 2-Column Product Grid ────────────────────────────────── */}
      {loadingInitial ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((n) => (
            <View key={n} style={[styles.skeletonCard, { width: cardWidth }]}>
              <View style={[styles.skeletonImage, { height: cardWidth * 1.33 }]} />
              <View style={styles.skeletonLineShort} />
              <View style={styles.skeletonLineLong} />
              <View style={styles.skeletonLinePrice} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {currentItems.map((prod) => (
            <RecommendedProductCard key={prod.id} product={prod} cardWidth={cardWidth} />
          ))}
        </View>
      )}

      {/* ── Bottom Infinite Spinner or End Marker ────────────────── */}
      {loadingMore && (
        <View style={styles.loadingMoreWrap}>
          <ActivityIndicator size="small" color="#e11d48" />
          <Text style={styles.loadingMoreText}>Discovering more pieces…</Text>
        </View>
      )}

      {!currentHasMore && currentItems.length > 0 && !loadingMore && (
        <View style={styles.endCapWrap}>
          <View style={styles.endCapLine} />
          <Text style={styles.endCapText}>YOU’VE VIEWED ALL RECOMMENDATIONS</Text>
          <View style={styles.endCapLine} />
        </View>
      )}
    </View>
  );
}

// ── Recommendation card: same tile as search results (centred,
// tracked uppercase metadata + "you save" offer line) ──────────────────
function RecommendedProductCard({
  product,
  cardWidth,
}: {
  product: Product;
  cardWidth: number;
}) {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <SearchResultTile
        product={product}
        width={cardWidth}
        onPress={(p) => router.push(`/(main)/products/${p.slug}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    paddingTop: 8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    color: "#181818",
    paddingHorizontal: 16,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 16,
  },
  tabPill: {
    // Pills share the full row edge to edge, each sized by its label.
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: {
    backgroundColor: "#fff0f3",
    borderWidth: 1.5,
    borderColor: "#ff3f6c",
  },
  tabPillInactive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  tabPillText: {
    fontSize: 13,
  },
  tabPillTextActive: {
    fontFamily: fontFamilies.sans.bold,
    color: "#ff3f6c",
  },
  tabPillTextInactive: {
    fontFamily: fontFamilies.sans.medium,
    color: "#3f3f46",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 20,
  },
  loadingMoreWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
  },
  loadingMoreText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: "#71717a",
  },
  endCapWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  endCapLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e4e4e7",
  },
  endCapText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: "#a1a1aa",
    letterSpacing: 1.2,
  },
  skeletonCard: {
    marginBottom: 20,
  },
  skeletonImage: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#e8e7e1",
  },
  skeletonLineShort: {
    width: "50%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#e8e7e1",
    marginTop: 8,
  },
  skeletonLineLong: {
    width: "85%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#e8e7e1",
    marginTop: 6,
  },
  skeletonLinePrice: {
    width: "60%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "#e8e7e1",
    marginTop: 6,
  },
});
