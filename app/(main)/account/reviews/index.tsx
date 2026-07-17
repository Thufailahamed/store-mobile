import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import { getMyReviews, deleteReview as deleteReviewApi } from "@/lib/api";
import { getStoredReviews, setStoredReviews, mapReview, type MobileReview } from "@/lib/account-local";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Tab = "all" | "published" | "pending";

export default function ReviewsScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [reviews, setReviews] = useState<MobileReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const activeUserId = userId as string;
    let cancelled = false;

    async function load() {
      const res = await getMyReviews(activeUserId);
      if (!cancelled) {
        if (res.ok) {
          const mapped = res.data.map(mapReview);
          setReviews(mapped);
          await setStoredReviews(activeUserId, mapped);
        } else {
          const local = await getStoredReviews(activeUserId);
          setReviews(local);
          toast(res.error, "error");
        }
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, toast]);

  const filtered = useMemo(() => {
    if (tab === "all") return reviews;
    return reviews.filter((r) => r.status === tab);
  }, [reviews, tab]);

  const avg = useMemo(() => {
    if (reviews.length === 0) return "0.0";
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  const totalPhotos = reviews.reduce((sum, r) => sum + r.photos, 0);
  const totalHelpful = reviews.reduce((sum, r) => sum + r.helpful, 0);

  const removeReview = async (id: string) => {
    if (!user?.id) return;
    const next = reviews.filter((r) => r.id !== id);
    setReviews(next);
    await setStoredReviews(user.id, next);
    const res = await deleteReviewApi(id, user.id);
    if (res.ok) toast("Review deleted", "success");
    else toast(res.error, "error");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="My reviews" />
        <View style={styles.loading}><Body muted>Loading reviews…</Body></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="My reviews" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Label style={styles.heroLabel}>Feedback</Label>
            <Display size="2xl" style={styles.heroTitle}>Words left behind</Display>
            <Body muted>The notes you've left on things you've worn, used, or gifted.</Body>
          </View>
          <View style={styles.ratingBox}>
            <Display size="xl">{avg}</Display>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons key={star} name={star <= Math.round(Number(avg)) ? "star" : "star-outline"} size={12} color={colors.accent2.ochre} />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Reviews" value={reviews.length} icon="star-outline" />
          <Stat label="Helpful" value={totalHelpful} icon="thumbs-up-outline" />
          <Stat label="Photos" value={totalPhotos} icon="image-outline" />
          <Stat label="Rank" value={reviews.length >= 5 ? "Silver" : "Bronze"} icon="ribbon-outline" />
        </View>

        <View style={styles.tabs}>
          {(["all", "published", "pending"] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Body size="xs" style={[styles.tabText, tab === t && styles.tabTextActive]}>{t[0].toUpperCase() + t.slice(1)}</Body>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.light.mutedForeground} /></View>
            <Display size="xl">No reviews yet</Display>
            <Body muted>Write reviews from completed orders to share your thoughts.</Body>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.productMark}>
                    <Body style={styles.productInitials}>{review.product.split(" ").map((w) => w[0]).slice(0, 2).join("")}</Body>
                  </View>
                  <View style={styles.reviewInfo}>
                    <View style={styles.reviewTitleRow}>
                      <Body style={styles.reviewTitle} numberOfLines={1}>{review.product}</Body>
                      <Badge style={{ backgroundColor: review.status === "published" ? colors.olive[100] : colors.accent2.ochre + "20" }}>
                        <Label style={{ color: review.status === "published" ? colors.olive[700] : colors.accent2.ochre }}>{review.status === "published" ? "Live" : "Pending"}</Label>
                      </Badge>
                    </View>
                    <Body muted size="xs">{review.variant} · {new Date(review.date).toLocaleDateString()}</Body>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={styles.stars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons key={star} name={star <= review.rating ? "star" : "star-outline"} size={12} color={colors.accent2.ochre} />
                        ))}
                      </View>
                      {review.isVerifiedPurchase && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: `${colors.olive[600]}10`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                          <Ionicons name="checkmark-circle" size={10} color={colors.olive[600]} />
                          <Label style={{ color: colors.olive[700], fontSize: 9, fontFamily: fontFamilies.sans.medium }}>Verified</Label>
                        </View>
                      )}
                    </View>
                    {review.title ? <Body style={styles.reviewTitleText}>{review.title}</Body> : null}
                    {review.body ? <Body muted numberOfLines={3}>{review.body}</Body> : null}
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert("Delete review", "Remove this review?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => removeReview(review.id) },
                  ])} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={18} color={colors.light.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}><Ionicons name={icon} size={18} color={colors.light.primary} /></View>
      <Display size="lg">{typeof value === "number" ? value.toLocaleString() : value}</Display>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
  },
  heroText: { flex: 1, marginRight: spacing[3] },
  heroLabel: { color: colors.light.mutedForeground },
  heroTitle: { marginTop: spacing[2], marginBottom: spacing[2] },
  ratingBox: {
    flexShrink: 0,
    alignItems: "flex-end",
    backgroundColor: colors.olive[50],
    borderRadius: radii.xl,
    padding: 12,
    gap: 6,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing[5] },
  statCard: { width: "48%", backgroundColor: colors.light.card, borderRadius: radii.xl, padding: 14, borderWidth: 1, borderColor: colors.light.border },
  statIcon: { width: 34, height: 34, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[50], marginBottom: 8 },
  statLabel: { color: colors.light.mutedForeground, marginTop: 4 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radii.lg },
  tabActive: { backgroundColor: colors.light.primary },
  tabText: { color: colors.light.mutedForeground },
  tabTextActive: { color: colors.light.primaryForeground },
  empty: {
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[8],
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[3],
  },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[50] },
  list: { gap: 12 },
  reviewCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  reviewTop: { flexDirection: "row", gap: 12 },
  productMark: {
    width: 52,
    height: 52,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  productInitials: { fontFamily: fontFamilies.mono.semibold, color: colors.light.primary, fontSize: typography.fontSizes.lg },
  reviewInfo: { flex: 1, gap: 5 },
  reviewTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewTitle: { flex: 1, fontWeight: typography.fontWeights.semibold },
  reviewTitleText: { fontWeight: typography.fontWeights.medium, marginTop: 2 },
  deleteButton: { width: 36, height: 36, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.light.destructive + "10" },
  stars: { flexDirection: "row", gap: 2 },
});
