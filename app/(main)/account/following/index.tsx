import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import {
  getFollowedStores as getFollowedStoresFromDb,
  getFeaturedStores,
} from "@/lib/api";
import {
  getLocallyFollowedStoreIds,
  toggleFollowStore,
} from "@/lib/api/stores";
import { mapStore } from "@/lib/api/product-mapper";
import { getStoresBackend } from "@/lib/api/backend";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

type FilterTab = "all" | "verified" | "top_rated" | "pieces";

export default function FollowingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [recommendedStores, setRecommendedStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Fetch followed stores
  const fetchStores = useCallback(async () => {
    let currentStores: Store[] = [];

    if (user?.id) {
      const res = await getFollowedStoresFromDb(user.id);
      if (res.ok) {
        currentStores = res.data.map((row) => row.store).filter(Boolean);
      } else {
        toast(res.error || "Couldn't load your following list", "error");
        currentStores = [];
      }
    } else {
      const localIds = await getLocallyFollowedStoreIds();
      if (localIds.length > 0) {
        const res = await getStoresBackend({ limit: 100 });
        if (res.ok && res.data?.stores) {
          const byId = new Map(
            (res.data.stores as Store[]).map((s) => [s.id, mapStore(s) as Store])
          );
          currentStores = localIds
            .map((id) => byId.get(id))
            .filter((s): s is Store => !!s);
        }
      }
    }

    setStores(currentStores);

    // Fetch recommended stores for the "Discover Ateliers" section
    try {
      const featRes = await getFeaturedStores(10);
      if (featRes.ok && Array.isArray(featRes.data)) {
        const followedIds = new Set(currentStores.map((s) => s.id));
        const filtered = featRes.data.filter((s) => !followedIds.has(s.id));
        setRecommendedStores(filtered);
      } else {
        // Fallback to general backend stores
        const allRes = await getStoresBackend({ limit: 12 });
        if (allRes.ok && allRes.data?.stores) {
          const followedIds = new Set(currentStores.map((s) => s.id));
          const filtered = (allRes.data.stores as Store[])
            .map((s) => mapStore(s) as Store)
            .filter((s) => !followedIds.has(s.id));
          setRecommendedStores(filtered);
        }
      }
    } catch {
      // Non-fatal
    }
  }, [user?.id, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchStores();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchStores]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStores();
    setRefreshing(false);
  }, [fetchStores]);

  // Unfollow action with confirmation
  const handleUnfollow = (store: Store) => {
    Alert.alert(
      "Unfollow Boutique",
      `Are you sure you want to unfollow ${store.name}? You will no longer receive private drops and updates from this atelier.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfollow",
          style: "destructive",
          onPress: async () => {
            setActionInProgressId(store.id);
            try {
              const res = await toggleFollowStore(store.id);
              if (res.ok) {
                toast(`Unfollowed ${store.name}`);
                setStores((prev) => prev.filter((s) => s.id !== store.id));
                setRecommendedStores((prev) => [store, ...prev]);
              } else {
                toast(res.error || "Failed to unfollow", "error");
              }
            } catch {
              toast("Network error. Please try again.", "error");
            } finally {
              setActionInProgressId(null);
            }
          },
        },
      ]
    );
  };

  // Follow a recommended boutique
  const handleFollowRecommended = async (store: Store) => {
    setActionInProgressId(store.id);
    try {
      const res = await toggleFollowStore(store.id);
      if (res.ok) {
        toast(`Now following ${store.name}`);
        setRecommendedStores((prev) => prev.filter((s) => s.id !== store.id));
        setStores((prev) => [store, ...prev]);
      } else {
        toast(res.error || "Failed to follow boutique", "error");
      }
    } catch {
      toast("Failed to follow boutique", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Filter and search
  const filteredStores = useMemo(() => {
    let list = [...stores];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.slug?.toLowerCase().includes(q)
      );
    }

    switch (activeFilter) {
      case "verified":
        list = list.filter((s) => s.status === "approved" || s.is_featured);
        break;
      case "top_rated":
        list = list.filter((s) => (s.rating ?? 0) >= 4.5);
        break;
      case "pieces":
        list.sort((a, b) => (b.total_products ?? 0) - (a.total_products ?? 0));
        break;
      default:
        break;
    }

    return list;
  }, [stores, searchQuery, activeFilter]);

  // Navigate to store
  const navigateToStore = (store: Store) => {
    if (!store.slug) return;
    router.push({
      pathname: "/(main)/stores/[slug]",
      params: { slug: store.slug, id: store.id },
    });
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Atelier Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>FOLLOWING</Text>
            <Text style={styles.navSubtitle}>
              {stores.length} {stores.length === 1 ? "Boutique" : "Boutiques"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.push("/(main)/stores" as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="storefront-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#C8A44A" size="small" />
            <Text style={styles.loadingText}>Loading curated ateliers…</Text>
          </View>
        ) : (
          <FlatList
            data={filteredStores}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FollowedBoutiqueCard
                store={item}
                onPress={() => navigateToStore(item)}
                onUnfollow={() => handleUnfollow(item)}
                isActionLoading={actionInProgressId === item.id}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#C8A44A"
              />
            }
            ListHeaderComponent={
              <View style={styles.headerSection}>
                {/* Noir Atelier Directory Hero Card */}
                <LinearGradient
                  colors={["#1c2016", "#14170e", "#0e110a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <View style={styles.heroEyebrowRow}>
                    <View style={styles.heroTagBadge}>
                      <Ionicons name="sparkles" size={11} color="#C8A44A" />
                      <Text style={styles.heroTagText}>PRIVATE ROSTER</Text>
                    </View>
                    <View style={styles.heroLiveBadge}>
                      <View style={styles.heroLiveDot} />
                      <Text style={styles.heroLiveText}>VIP ACCESS</Text>
                    </View>
                  </View>

                  <Text style={styles.heroTitle}>Your Followed Boutiques</Text>
                  <Text style={styles.heroSubtitle}>
                    Direct access to seasonal lookbooks, bespoke drops, and runway pieces from your private selection.
                  </Text>

                  <View style={styles.heroStatsRow}>
                    <View style={styles.heroStatItem}>
                      <Text style={styles.heroStatValue}>{stores.length}</Text>
                      <Text style={styles.heroStatLabel}>Curated Ateliers</Text>
                    </View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStatItem}>
                      <Text style={styles.heroStatValue}>
                        {stores.reduce((acc, s) => acc + (s.total_products || 0), 0)}
                      </Text>
                      <Text style={styles.heroStatLabel}>Live Pieces</Text>
                    </View>
                    <View style={styles.heroStatDivider} />
                    <TouchableOpacity
                      style={styles.heroDiscoverBtn}
                      activeOpacity={0.8}
                      onPress={() => router.push("/(main)/stores" as any)}
                    >
                      <Text style={styles.heroDiscoverText}>Explore All</Text>
                      <Ionicons name="arrow-forward" size={12} color="#C8A44A" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>

                {/* Luxury Search Bar */}
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color={colors.light.mutedForeground} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search followed boutiques by name…"
                    placeholderTextColor={colors.light.mutedForeground}
                    style={styles.searchInput}
                    returnKeyType="search"
                    clearButtonMode="never"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery("")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Pills */}
                {stores.length > 0 && (
                  <View style={styles.filtersRow}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        activeFilter === "all" && styles.filterChipActive,
                      ]}
                      onPress={() => setActiveFilter("all")}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          activeFilter === "all" && styles.filterChipTextActive,
                        ]}
                      >
                        All ({stores.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        activeFilter === "verified" && styles.filterChipActive,
                      ]}
                      onPress={() => setActiveFilter("verified")}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color={activeFilter === "verified" ? "#ffffff" : "#C8A44A"}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          activeFilter === "verified" && styles.filterChipTextActive,
                        ]}
                      >
                        Verified
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        activeFilter === "top_rated" && styles.filterChipActive,
                      ]}
                      onPress={() => setActiveFilter("top_rated")}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="star"
                        size={11}
                        color={activeFilter === "top_rated" ? "#ffffff" : "#C8A44A"}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          activeFilter === "top_rated" && styles.filterChipTextActive,
                        ]}
                      >
                        Top Rated
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        activeFilter === "pieces" && styles.filterChipActive,
                      ]}
                      onPress={() => setActiveFilter("pieces")}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="grid-outline"
                        size={11}
                        color={activeFilter === "pieces" ? "#ffffff" : colors.light.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.filterChipText,
                          activeFilter === "pieces" && styles.filterChipTextActive,
                        ]}
                      >
                        Most Pieces
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Section Title for Results */}
                {filteredStores.length > 0 && (
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsEyebrow}>YOUR BOUTIQUES</Text>
                    <Text style={styles.resultsCount}>
                      {filteredStores.length} {filteredStores.length === 1 ? "atelier" : "ateliers"}
                    </Text>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              searchQuery.trim().length > 0 ? (
                <View style={styles.emptySearchWrap}>
                  <Ionicons name="search-outline" size={36} color={colors.light.mutedForeground} />
                  <Text style={styles.emptySearchTitle}>No Boutiques Found</Text>
                  <Text style={styles.emptySearchDesc}>
                    No followed boutiques match &quot;{searchQuery}&quot;. Try searching another name or reset filters.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyResetBtn}
                    onPress={() => {
                      setSearchQuery("");
                      setActiveFilter("all");
                    }}
                  >
                    <Text style={styles.emptyResetText}>Reset Filter</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyFollowWrap}>
                  <View style={styles.emptyMedallion}>
                    <Ionicons name="storefront-outline" size={32} color="#C8A44A" />
                  </View>
                  <Text style={styles.emptyFollowTitle}>No Followed Boutiques Yet</Text>
                  <Text style={styles.emptyFollowDesc}>
                    Follow luxury ateliers and independent fashion houses to curate your private directory and get early drop notifications.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyDiscoverCta}
                    activeOpacity={0.85}
                    onPress={() => router.push("/(main)/stores" as any)}
                  >
                    <Text style={styles.emptyDiscoverCtaText}>Explore All Boutiques</Text>
                    <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )
            }
            ListFooterComponent={
              /* Curated Recommendations Section */
              recommendedStores.length > 0 ? (
                <View style={styles.recommendedSection}>
                  <View style={styles.recommendedHeader}>
                    <View>
                      <Text style={styles.recommendedEyebrow}>CURATED SELECTION</Text>
                      <Text style={styles.recommendedTitle}>Discover New Ateliers</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push("/(main)/stores" as any)}
                      style={styles.recommendedViewAll}
                    >
                      <Text style={styles.recommendedViewAllText}>View All</Text>
                      <Ionicons name="arrow-forward" size={12} color="#85651b" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.recommendedList}>
                    {recommendedStores.slice(0, 4).map((recStore) => (
                      <RecommendedStoreCard
                        key={recStore.id}
                        store={recStore}
                        onPress={() => navigateToStore(recStore)}
                        onFollow={() => handleFollowRecommended(recStore)}
                        isLoading={actionInProgressId === recStore.id}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <View style={{ height: 40 }} />
              )
            }
          />
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

/* =========================================================================
   Followed Boutique Card Component (Ultra-Luxury Haute Couture Card)
   ========================================================================= */
interface FollowedBoutiqueCardProps {
  store: Store;
  onPress: () => void;
  onUnfollow: () => void;
  isActionLoading: boolean;
}

function FollowedBoutiqueCard({
  store,
  onPress,
  onUnfollow,
  isActionLoading,
}: FollowedBoutiqueCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  const resolvedLogo = resolveImageUrl(store.logo_url);
  const resolvedBanner = resolveImageUrl(store.banner_url);
  const initial = (store.name || "A").charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={styles.boutiqueCard}
      activeOpacity={0.92}
      onPress={onPress}
    >
      {/* Banner / Header Backdrop */}
      <View style={styles.boutiqueBannerWrap}>
        {resolvedBanner && !bannerFailed ? (
          <Image
            source={{ uri: resolvedBanner }}
            style={styles.boutiqueBannerImage}
            contentFit="cover"
            transition={300}
            onError={() => setBannerFailed(true)}
          />
        ) : (
          <LinearGradient
            colors={["#242b1f", "#181d14", "#12160e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.boutiqueBannerFallback}
          >
            <View style={styles.bannerPatternOverlay}>
              <Ionicons name="sparkles" size={16} color="rgba(200, 164, 74, 0.2)" />
            </View>
          </LinearGradient>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.45)"]}
          style={styles.bannerScrim}
        />

        {/* Top Badges on Banner */}
        <View style={styles.bannerBadgeRow}>
          <View style={styles.atelierStatusBadge}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.atelierStatusText}>ACTIVE ATELIER</Text>
          </View>

          {/* Following Pill Button */}
          <TouchableOpacity
            style={styles.followingPill}
            onPress={(e) => {
              e.stopPropagation();
              onUnfollow();
            }}
            disabled={isActionLoading}
            activeOpacity={0.8}
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#181b12" />
            ) : (
              <>
                <Ionicons name="checkmark" size={12} color="#181b12" />
                <Text style={styles.followingPillText}>Following</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.boutiqueCardBody}>
        {/* Floating Avatar */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarRingOuter}>
            {resolvedLogo && !logoFailed ? (
              <Image
                source={{ uri: resolvedLogo }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <View style={styles.avatarMonogram}>
                <Text style={styles.avatarMonogramText}>{initial}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Info Header */}
        <View style={styles.boutiqueTitleRow}>
          <View style={styles.boutiqueNameCol}>
            <View style={styles.nameVerifiedRow}>
              <Text style={styles.boutiqueName} numberOfLines={1}>
                {store.name}
              </Text>
              <View style={styles.verifiedSeal}>
                <Ionicons name="checkmark-circle" size={12} color="#85651b" />
                <Text style={styles.verifiedSealText}>VERIFIED</Text>
              </View>
            </View>

            {store.description ? (
              <Text style={styles.boutiqueDesc} numberOfLines={2}>
                {store.description}
              </Text>
            ) : (
              <Text style={styles.boutiqueDescFallback}>
                Haute couture garments, bespoke tailoring & curated accessories.
              </Text>
            )}
          </View>
        </View>

        {/* Metrics Strip */}
        <View style={styles.boutiqueMetricsStrip}>
          <View style={styles.metricCell}>
            <Ionicons name="shirt-outline" size={13} color="#C8A44A" />
            <Text style={styles.metricValue}>
              {store.total_products || 0}{" "}
              <Text style={styles.metricUnit}>pieces</Text>
            </Text>
          </View>

          <View style={styles.metricSeparator} />

          <View style={styles.metricCell}>
            <Ionicons name="star" size={12} color="#C8A44A" />
            <Text style={styles.metricValue}>
              {(store.rating || 5.0).toFixed(1)}{" "}
              <Text style={styles.metricUnit}>
                ({store.total_reviews || 12})
              </Text>
            </Text>
          </View>

          <View style={styles.metricSeparator} />

          <View style={styles.metricCell}>
            <Ionicons name="people-outline" size={13} color="#C8A44A" />
            <Text style={styles.metricValue}>
              {store.total_followers || 1}{" "}
              <Text style={styles.metricUnit}>patrons</Text>
            </Text>
          </View>
        </View>

        {/* Visit Atelier Primary Action Button */}
        <TouchableOpacity
          style={styles.visitAtelierBtn}
          activeOpacity={0.88}
          onPress={onPress}
        >
          <Text style={styles.visitAtelierBtnText}>ENTER ATELIER</Text>
          <Ionicons name="arrow-forward" size={14} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* =========================================================================
   Recommended Store Card Component (Discovery Rail)
   ========================================================================= */
interface RecommendedStoreCardProps {
  store: Store;
  onPress: () => void;
  onFollow: () => void;
  isLoading: boolean;
}

function RecommendedStoreCard({
  store,
  onPress,
  onFollow,
  isLoading,
}: RecommendedStoreCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const resolvedLogo = resolveImageUrl(store.logo_url);
  const initial = (store.name || "A").charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={styles.recCard}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={styles.recAvatarWrap}>
        {resolvedLogo && !logoFailed ? (
          <Image
            source={{ uri: resolvedLogo }}
            style={styles.recAvatarImage}
            contentFit="cover"
            transition={200}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <View style={styles.recAvatarMonogram}>
            <Text style={styles.recAvatarMonogramText}>{initial}</Text>
          </View>
        )}
      </View>

      <View style={styles.recInfoCol}>
        <View style={styles.recTitleRow}>
          <Text style={styles.recStoreName} numberOfLines={1}>
            {store.name}
          </Text>
          <View style={styles.recVerifiedTag}>
            <Ionicons name="checkmark-circle" size={10} color="#85651b" />
          </View>
        </View>

        <View style={styles.recMetaRow}>
          <Text style={styles.recPiecesText}>
            {store.total_products || 0} pieces
          </Text>
          <View style={styles.recDot} />
          <Ionicons name="star" size={10} color="#C8A44A" />
          <Text style={styles.recRatingText}>
            {(store.rating || 5.0).toFixed(1)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.recFollowBtn}
        onPress={(e) => {
          e.stopPropagation();
          onFollow();
        }}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#181b12" />
        ) : (
          <>
            <Ionicons name="add" size={13} color="#181b12" />
            <Text style={styles.recFollowBtnText}>Follow</Text>
          </>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/* =========================================================================
   Styles
   ========================================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },

  /* Navigation Bar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navTitleWrap: {
    alignItems: "center",
  },
  navTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.light.foreground,
    textTransform: "uppercase",
  },
  navSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 1,
    letterSpacing: 0.5,
  },

  listContent: {
    paddingBottom: 40,
  },
  headerSection: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },

  /* Hero Obsidian Card */
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    ...shadows.editorial,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  heroLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  heroLiveText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.72)",
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  heroStatItem: {
    flex: 1,
  },
  heroStatValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: "#E8CF8F",
  },
  heroStatLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: "rgba(255, 255, 255, 0.55)",
    marginTop: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 8,
  },
  heroDiscoverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
  },
  heroDiscoverText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#E8CF8F",
    letterSpacing: 0.5,
  },

  /* Search Bar */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.09)",
    gap: 10,
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.foreground,
  },

  /* Filter Tabs */
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing[4],
    flexWrap: "wrap",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
  },
  filterChipActive: {
    backgroundColor: "#181b12",
    borderColor: "#181b12",
  },
  filterChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontFamily: fontFamilies.sans.semibold,
  },

  /* Results Section */
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[3],
    marginTop: 2,
  },
  resultsEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  resultsCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },

  /* Boutique Card */
  boutiqueCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    overflow: "hidden",
    ...shadows.editorial,
  },
  boutiqueBannerWrap: {
    height: 90,
    width: "100%",
    position: "relative",
  },
  boutiqueBannerImage: {
    width: "100%",
    height: "100%",
  },
  boutiqueBannerFallback: {
    width: "100%",
    height: "100%",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: 12,
  },
  bannerPatternOverlay: {
    opacity: 0.8,
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerBadgeRow: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  atelierStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  greenPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#4ade80",
  },
  atelierStatusText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: "#ffffff",
    letterSpacing: 0.8,
  },
  followingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.4)",
    ...shadows.soft,
  },
  followingPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#181b12",
    letterSpacing: 0.5,
  },

  /* Card Body */
  boutiqueCardBody: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    paddingTop: 0,
  },
  avatarWrapper: {
    marginTop: -28,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  avatarRingOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    ...shadows.soft,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarMonogram: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1c2016",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMonogramText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#E8CF8F",
  },

  /* Title & Verification */
  boutiqueTitleRow: {
    marginBottom: 10,
  },
  boutiqueNameCol: {
    gap: 4,
  },
  nameVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  boutiqueName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  verifiedSeal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  verifiedSealText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: "#85651b",
    letterSpacing: 0.6,
  },
  boutiqueDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },
  boutiqueDescFallback: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
    lineHeight: 16,
  },

  /* Metrics Strip */
  boutiqueMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.05)",
    marginBottom: 12,
  },
  metricCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  metricValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11.5,
    color: colors.light.foreground,
  },
  metricUnit: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  metricSeparator: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(22, 23, 15, 0.08)",
  },

  /* Visit Button */
  visitAtelierBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#181b12",
    borderRadius: radii.full,
    paddingVertical: 10,
    ...shadows.soft,
  },
  visitAtelierBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#ffffff",
    letterSpacing: 1.2,
  },

  /* Empty Search */
  emptySearchWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[8],
    gap: 8,
  },
  emptySearchTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    marginTop: 8,
  },
  emptySearchDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "#181b12",
  },
  emptyResetText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
  },

  /* Empty Followed State */
  emptyFollowWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[8],
    gap: 8,
  },
  emptyMedallion: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    marginBottom: 4,
  },
  emptyFollowTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    textAlign: "center",
  },
  emptyFollowDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyDiscoverCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: "#181b12",
    ...shadows.soft,
  },
  emptyDiscoverCtaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#ffffff",
  },

  /* Recommended Section */
  recommendedSection: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
  recommendedHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  recommendedEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  recommendedTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    marginTop: 2,
  },
  recommendedViewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingBottom: 2,
  },
  recommendedViewAllText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#85651b",
    letterSpacing: 0.5,
  },
  recommendedList: {
    gap: 10,
  },

  /* Recommended Card */
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 12,
    ...shadows.soft,
  },
  recAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    backgroundColor: "#f8f7f2",
  },
  recAvatarImage: {
    width: "100%",
    height: "100%",
  },
  recAvatarMonogram: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1c2016",
    alignItems: "center",
    justifyContent: "center",
  },
  recAvatarMonogramText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: "#E8CF8F",
  },
  recInfoCol: {
    flex: 1,
    gap: 3,
  },
  recTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recStoreName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14.5,
    color: colors.light.foreground,
  },
  recVerifiedTag: {
    marginLeft: 2,
  },
  recMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recPiecesText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },
  recDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.light.mutedForeground,
  },
  recRatingText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#85651b",
  },
  recFollowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
  },
  recFollowBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#181b12",
    letterSpacing: 0.5,
  },
});
