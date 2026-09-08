import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import { getMyReviews, deleteReview as deleteReviewApi } from "@/lib/api";
import {
  getStoredReviews,
  setStoredReviews,
  mapReview,
  type MobileReview,
} from "@/lib/account-local";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Tab = "all" | "published" | "pending";

export default function ReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [reviews, setReviews] = useState<MobileReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReviews = async (isManualRefresh = false) => {
    const userId = user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    const activeUserId = userId as string;
    if (isManualRefresh) setRefreshing(true);

    try {
      const res = await getMyReviews(activeUserId);
      if (res.ok) {
        const mapped = res.data.map(mapReview);
        setReviews(mapped);
        await setStoredReviews(activeUserId, mapped);
      } else {
        const local = await getStoredReviews(activeUserId);
        setReviews(local);
        if (isManualRefresh) toast(res.error || "Failed to load reviews", "error");
      }
    } catch {
      const local = await getStoredReviews(activeUserId);
      setReviews(local);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (tab === "all") return reviews;
    return reviews.filter((r) => r.status === tab);
  }, [reviews, tab]);

  const avg = useMemo(() => {
    if (reviews.length === 0) return "0.0";
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  const totalPhotos = useMemo(() => reviews.reduce((sum, r) => sum + r.photos, 0), [reviews]);
  const totalHelpful = useMemo(() => reviews.reduce((sum, r) => sum + r.helpful, 0), [reviews]);
  const publishedCount = useMemo(() => reviews.filter((r) => r.status === "published").length, [reviews]);
  const pendingCount = useMemo(() => reviews.filter((r) => r.status === "pending").length, [reviews]);

  const rank = useMemo(() => {
    if (reviews.length >= 10) return "Gold";
    if (reviews.length >= 5) return "Silver";
    return "Bronze";
  }, [reviews.length]);

  const rankTitle = useMemo(() => {
    if (reviews.length >= 10) return "Gold Connoisseur";
    if (reviews.length >= 5) return "Silver Critic";
    return "Bronze Patron";
  }, [reviews.length]);

  const removeReview = async (id: string, productName?: string) => {
    if (!user?.id) return;
    Alert.alert(
      "Remove Critique",
      `Are you sure you wish to delete your review for "${productName ?? "this piece"}"?`,
      [
        { text: "Keep Review", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const next = reviews.filter((r) => r.id !== id);
            setReviews(next);
            await setStoredReviews(user.id, next);
            const res = await deleteReviewApi(id, user.id);
            if (res.ok) {
              toast("Review deleted", "success");
            } else {
              toast(res.error || "Could not delete review", "error");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* 1. Custom Atelier Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="#141311" />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerEyebrow}>COMMUNITY ARCHIVES</Text>
          <Text style={styles.headerTitle}>My Reviews</Text>
        </View>

        <TouchableOpacity
          onPress={() => loadReviews(true)}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={refreshing ? "#C8A44A" : "#141311"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadReviews(true)}
            tintColor="#C8A44A"
            colors={["#C8A44A"]}
          />
        }
      >
        {/* 2. Velvet Obsidian Hero Card ("Words Left Behind") */}
        <LinearGradient
          colors={["#141311", "#1E1C18", "#0F0E0D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTagBadge}>
              <Ionicons name="sparkles" size={10} color="#C8A44A" />
              <Text style={styles.heroTagText}>PATRON CRITIQUE ARCHIVE</Text>
            </View>

            {/* Feather/Quill Medallion */}
            <View style={styles.featherMedallion}>
              <View style={styles.featherMedallionInner}>
                <Ionicons name="document-text-outline" size={18} color="#E8CF8F" />
              </View>
            </View>
          </View>

          <View style={styles.heroBodyRow}>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Words Left Behind</Text>
              <Text style={styles.heroSubtitle}>
                Your personal chronicle of impressions, drape evaluations, and tactile notes on
                pieces you've acquired, worn, or gifted.
              </Text>
            </View>

            {/* Score Box */}
            <View style={styles.scoreBox}>
              <Text style={styles.scoreNumber}>{avg}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(Number(avg)) ? "star" : "star-outline"}
                    size={11}
                    color="#C8A44A"
                  />
                ))}
              </View>
              <Text style={styles.scoreLabel}>SCORE</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 3. Luxury 2x2 Metric Grid */}
        <View style={styles.statsGrid}>
          {/* Card 1: Reviews */}
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="star-outline" size={16} color="#85651B" />
            </View>
            <Text style={styles.statNumber}>{reviews.length}</Text>
            <Text style={styles.statLabel}>CRITIQUES</Text>
            <Text style={styles.statSub}>Written records</Text>
          </View>

          {/* Card 2: Helpful */}
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="thumbs-up-outline" size={16} color="#85651B" />
            </View>
            <Text style={styles.statNumber}>{totalHelpful}</Text>
            <Text style={styles.statLabel}>PATRON ACCLAIM</Text>
            <Text style={styles.statSub}>Helpful endorsements</Text>
          </View>

          {/* Card 3: Photos */}
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="image-outline" size={16} color="#85651B" />
            </View>
            <Text style={styles.statNumber}>{totalPhotos}</Text>
            <Text style={styles.statLabel}>VISUAL ASSETS</Text>
            <Text style={styles.statSub}>Editorial imagery</Text>
          </View>

          {/* Card 4: Rank */}
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="ribbon-outline" size={16} color="#85651B" />
            </View>
            <Text style={styles.statNumber}>{rank}</Text>
            <Text style={styles.statLabel}>CRITIC RANK</Text>
            <Text style={styles.statSub}>{rankTitle}</Text>
          </View>
        </View>

        {/* 4. Segmented Filter Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === "all" && styles.tabButtonActive]}
            onPress={() => setTab("all")}
          >
            <Text style={[styles.tabButtonText, tab === "all" && styles.tabButtonTextActive]}>
              All ({reviews.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === "published" && styles.tabButtonActive]}
            onPress={() => setTab("published")}
          >
            <Text
              style={[styles.tabButtonText, tab === "published" && styles.tabButtonTextActive]}
            >
              Published ({publishedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === "pending" && styles.tabButtonActive]}
            onPress={() => setTab("pending")}
          >
            <Text style={[styles.tabButtonText, tab === "pending" && styles.tabButtonTextActive]}>
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5. Reviews List or Luxury Empty State */}
        {filtered.length === 0 ? (
          /* Editorial Empty State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              {/* Double-Ring Gold Medallion */}
              <View style={styles.emptyMedallionOuter}>
                <View style={styles.emptyMedallionInner}>
                  <Ionicons name="chatbubble-ellipses-outline" size={26} color="#C8A44A" />
                  <View style={styles.emptySparkle}>
                    <Ionicons name="sparkles" size={10} color="#E8CF8F" />
                  </View>
                </View>
              </View>

              <Text style={styles.emptyTitle}>The Archive Awaits Your Voice</Text>
              <Text style={styles.emptyBody}>
                You haven't chronicled any acquisitions yet. After receiving a garment or bespoke
                piece, share your textural and sizing notes to guide fellow connoisseurs.
              </Text>

              {/* Primary Action Button */}
              <TouchableOpacity
                style={styles.emptyPrimaryButton}
                activeOpacity={0.85}
                onPress={() => router.push("/(main)/account/orders")}
              >
                <LinearGradient
                  colors={["#1C1A17", "#141311"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyPrimaryButtonGradient}
                >
                  <Text style={styles.emptyPrimaryButtonText}>Review Completed Orders</Text>
                  <Ionicons name="arrow-forward" size={15} color="#E8CF8F" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary Action Button */}
              <TouchableOpacity
                style={styles.emptySecondaryButton}
                activeOpacity={0.7}
                onPress={() => router.push("/(main)/account/wardrobe")}
              >
                <Ionicons name="shirt-outline" size={14} color="#85651B" />
                <Text style={styles.emptySecondaryButtonText}>Explore The Wardrobe</Text>
              </TouchableOpacity>
            </View>

            {/* 6. "The Art of the Atelier Critique" 3-Feature Section */}
            <View style={styles.protocolsSection}>
              <View style={styles.protocolsHeaderRow}>
                <Ionicons name="shield-outline" size={14} color="#85651B" />
                <Text style={styles.protocolsEyebrow}>CONNOISSEUR STANDARDS</Text>
              </View>
              <Text style={styles.protocolsTitle}>The Art of the Atelier Critique</Text>

              <View style={styles.protocolCardsList}>
                {/* Step 1 */}
                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>01</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>Sizing & Drape Precision</Text>
                    <Text style={styles.protocolCardDesc}>
                      Inform fellow patrons on true-to-form chest drape, shoulder ease, and fabric
                      hand-feel across various silhouettes.
                    </Text>
                  </View>
                </View>

                {/* Step 2 */}
                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>02</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>Material Resilience</Text>
                    <Text style={styles.protocolCardDesc}>
                      Document how natural wools, raw linens, and woven silks age, soften, and patina
                      over seasons of wear.
                    </Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View style={styles.protocolCard}>
                  <View style={styles.protocolNumberBadge}>
                    <Text style={styles.protocolNumberText}>03</Text>
                  </View>
                  <View style={styles.protocolCardContent}>
                    <Text style={styles.protocolCardTitle}>Patron Status Progression</Text>
                    <Text style={styles.protocolCardDesc}>
                      Earn Atelier loyalty points and unlock exclusive critic standing badges across
                      the private member directory.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Concierge Guarantee Callout */}
              <View style={styles.guaranteeBanner}>
                <Ionicons name="ribbon-outline" size={16} color="#C8A44A" />
                <Text style={styles.guaranteeText}>
                  Authenticity Guarantee: All reviews undergo editorial moderation to ensure genuine
                  patron insights and verified provenance.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* Active Reviews List */
          <View style={styles.reviewsList}>
            {filtered.map((review) => {
              const initials = review.product
                .split(" ")
                .filter(Boolean)
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <View key={review.id} style={styles.reviewCard}>
                  {/* Header Row: Status & Actions */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.statusBadgesRow}>
                      {review.status === "published" ? (
                        <View style={styles.publishedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#2B6E3F" />
                          <Text style={styles.publishedBadgeText}>PUBLISHED</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <Ionicons name="time-outline" size={12} color="#85651B" />
                          <Text style={styles.pendingBadgeText}>MODERATION</Text>
                        </View>
                      )}

                      {review.isVerifiedPurchase && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="shield-checkmark" size={11} color="#414A23" />
                          <Text style={styles.verifiedBadgeText}>VERIFIED ACQUISITION</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.deleteIconButton}
                      onPress={() => removeReview(review.id, review.product)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={15} color="#8F8B82" />
                    </TouchableOpacity>
                  </View>

                  {/* Middle Row: Product Emblem & Title */}
                  <View style={styles.productRow}>
                    <View style={styles.productEmblem}>
                      <Text style={styles.productEmblemText}>{initials || "AT"}</Text>
                    </View>

                    <View style={styles.productInfo}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          review.productSlug && router.push(`/(main)/products/${review.productSlug}`)
                        }
                      >
                        <Text style={styles.productName} numberOfLines={1}>
                          {review.product}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.productMeta}>
                        {review.variant} · {new Date(review.date).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  {/* Rating Stars & Critique Content */}
                  <View style={styles.reviewBodyContainer}>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? "star" : "star-outline"}
                          size={13}
                          color="#C8A44A"
                        />
                      ))}
                      <Text style={styles.ratingDigit}>{review.rating}.0</Text>
                    </View>

                    {review.title ? (
                      <Text style={styles.reviewHeadline}>{review.title}</Text>
                    ) : null}

                    {review.body ? (
                      <Text style={styles.reviewBodyText}>{review.body}</Text>
                    ) : null}
                  </View>

                  {/* Card Footer: Acclaim & Navigation */}
                  <View style={styles.cardFooterRow}>
                    <View style={styles.helpfulBadge}>
                      <Ionicons name="thumbs-up-outline" size={13} color="#85651B" />
                      <Text style={styles.helpfulBadgeText}>
                        {review.helpful} {review.helpful === 1 ? "endorsement" : "endorsements"}
                      </Text>
                    </View>

                    {review.productSlug && (
                      <TouchableOpacity
                        style={styles.viewProductLink}
                        onPress={() => router.push(`/(main)/products/${review.productSlug}`)}
                      >
                        <Text style={styles.viewProductLinkText}>View Piece</Text>
                        <Ionicons name="arrow-forward" size={12} color="#141311" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F4EF",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F5F4EF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "#85651B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#141311",
    letterSpacing: -0.3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* Velvet Obsidian Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    marginBottom: 16,
    ...shadows.glow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#E8CF8F",
  },
  featherMedallion: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    padding: 3,
  },
  featherMedallionInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#201E1A",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBodyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#FAF8F5",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#B3AFA5",
  },
  scoreBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    minWidth: 80,
  },
  scoreNumber: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 22,
    color: "#FAF8F5",
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 4,
  },
  scoreLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.4,
    color: "#85651B",
  },

  /* 2x2 Metric Grid */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F6F4EB",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: "#141311",
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#85651B",
    marginBottom: 2,
  },
  statSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#8F8B82",
  },

  /* Segmented Filter Tabs */
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#EBE8DF",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "#DFDBCF",
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: "#141311",
  },
  tabButtonText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "#6B675E",
  },
  tabButtonTextActive: {
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },

  /* Editorial Empty State */
  emptyContainer: {
    gap: 20,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 26,
    alignItems: "center",
    ...shadows.soft,
  },
  emptyMedallionOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    padding: 4,
    marginBottom: 16,
  },
  emptyMedallionInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#141311",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emptySparkle: {
    position: "absolute",
    top: 6,
    right: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: "#141311",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 20,
    color: "#787469",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emptyPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
    ...shadows.soft,
  },
  emptyPrimaryButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  emptyPrimaryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
  },
  emptySecondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  emptySecondaryButtonText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: "#85651B",
  },

  /* Protocols Section */
  protocolsSection: {
    backgroundColor: "#FAF9F5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBE7DD",
    padding: 20,
  },
  protocolsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  protocolsEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#85651B",
  },
  protocolsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: "#141311",
    marginBottom: 16,
  },
  protocolCardsList: {
    gap: 12,
    marginBottom: 18,
  },
  protocolCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAE6DB",
    padding: 14,
  },
  protocolNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F2EFE6",
    borderWidth: 1,
    borderColor: "#E0DCcf",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolNumberText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#85651B",
  },
  protocolCardContent: {
    flex: 1,
  },
  protocolCardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
    marginBottom: 3,
  },
  protocolCardDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#787469",
  },
  guaranteeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(200, 164, 74, 0.08)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.2)",
  },
  guaranteeText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    lineHeight: 16,
    color: "#6B5219",
  },

  /* Reviews List */
  reviewsList: {
    gap: 14,
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 18,
    ...shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  publishedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C5E6CC",
  },
  publishedBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: "#2B6E3F",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F7F5EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E6E2D4",
  },
  pendingBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: "#85651B",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1EEDB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: "#414A23",
  },
  deleteIconButton: {
    padding: 4,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F1EC",
  },
  productEmblem: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F6F4EB",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    alignItems: "center",
    justifyContent: "center",
  },
  productEmblemText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    color: "#414A23",
    letterSpacing: 1,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: "#141311",
    marginBottom: 2,
  },
  productMeta: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "#8F8B82",
  },
  reviewBodyContainer: {
    gap: 6,
    marginBottom: 12,
  },
  ratingDigit: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#85651B",
    marginLeft: 4,
  },
  reviewHeadline: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#141311",
    marginTop: 2,
  },
  reviewBodyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B675E",
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F1EC",
  },
  helpfulBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  helpfulBadgeText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: "#85651B",
  },
  viewProductLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewProductLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#141311",
  },
});
