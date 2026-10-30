import React, { useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Pressable, ScrollView, Modal } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui";
import { Display, Label, Body } from "@/components/ui/Typography";
import { spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product, Review } from "@/lib/types";
import { HelpfulButton } from "@/components/reviews/HelpfulButton";

const INK = "#141414";
const MUTED = "#6b6b6b";
const HAIRLINE = "rgba(0,0,0,0.08)";
const GOLD = "#c8a44a";
const GOLD_LIGHT = "#ecd593";
const OLIVE_DARK = "#17180f";
const CREAM = "#faf8f1";

type Tab = "description" | "specs" | "reviews";

interface ProductDetailsProps {
  product: Product;
  reviews: Review[];
  onWriteReview?: () => void;
}

export function ProductDetails({ product, reviews, onWriteReview }: ProductDetailsProps) {
  const [tab, setTab] = useState<Tab>("description");

  const reviewCount = reviews.length || product.total_reviews;
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : product.rating;

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    const k = Math.max(1, Math.min(5, Math.round(r.rating)));
    breakdown[k]++;
  });

  const specs = [
    { k: "Material", v: product.material },
    { k: "Fit", v: product.fit },
    { k: "Pattern", v: product.pattern },
    { k: "Sleeve", v: product.sleeve },
    { k: "Occasion", v: product.occasion },
    { k: "Season", v: product.season },
    { k: "Care", v: product.care_instructions },
    { k: "SKU", v: product.sku },
  ].filter((x): x is { k: string; v: string } => !!x.v);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "description", label: "Description" },
    { key: "specs", label: "Specs" },
    { key: "reviews", label: "Reviews", count: reviewCount },
  ];
  // Q&A has its own section further down the page, so no tab for it here.
  const visibleTabs = specs.length > 0 ? tabs : tabs.filter((t) => t.key !== "specs");

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Label style={styles.kicker}>THE DETAILS</Label>
        <Display size="xl" style={styles.title}>
          About this <Display size="xl" italic style={styles.titleItalic}>piece</Display>
        </Display>
      </View>

      {/* Tab bar — segmented control */}
      <View style={styles.tabBar}>
        {visibleTabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Body size="sm" style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Body>
              {typeof t.count === "number" && t.count > 0 ? (
                <View style={[styles.tabCount, active && styles.tabCountActive]}>
                  <Label style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                    {t.count}
                  </Label>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {tab === "description" && (
          <DescriptionTab product={product} />
        )}
        {tab === "specs" && (
          <SpecsTab specs={specs} />
        )}
        {tab === "reviews" && (
          <ReviewsTab
            reviews={reviews}
            avgRating={avgRating}
            reviewCount={reviewCount}
            breakdown={breakdown}
            onWriteReview={onWriteReview}
          />
        )}
      </View>
    </View>
  );
}

/* ─── Description Tab ─── */
function DescriptionTab({ product }: { product: Product }) {
  const highlights = [
    { k: "Material", v: product.material, icon: "layers-outline" as const },
    { k: "Fit", v: product.fit, icon: "body-outline" as const },
    { k: "Pattern", v: product.pattern, icon: "grid-outline" as const },
    { k: "Care", v: product.care_instructions, icon: "water-outline" as const },
  ].filter((x) => x.v);

  return (
    <View style={styles.descContainer}>
      <View style={styles.cardShadow}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={14} color={INK} />
            <Label style={styles.cardEyebrow}>DESCRIPTION</Label>
          </View>
          {product.description ? (
            <Body style={styles.descText}>{product.description}</Body>
          ) : (
            <Body size="sm" style={styles.descEmpty}>The seller hasn't added a description yet.</Body>
          )}
        </View>
      </View>

      {highlights.length > 0 && (
        <View style={styles.highlightGrid}>
          {highlights.map((x) => (
            <View key={x.k} style={styles.highlightTile}>
              <View style={styles.highlightIcon}>
                <Ionicons name={x.icon} size={15} color={INK} />
              </View>
              <Label style={styles.highlightKey}>{x.k.toUpperCase()}</Label>
              <Body size="sm" style={styles.highlightValue} numberOfLines={2}>{x.v}</Body>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Specs Tab ─── */
function SpecsTab({ specs }: { specs: { k: string; v: string }[] }) {
  return (
    <View style={styles.cardShadow}>
      <View style={[styles.card, styles.specsCard]}>
        {specs.map((s, i) => (
          <View
            key={s.k}
            style={[styles.specsRow, i === specs.length - 1 && styles.specsRowLast]}
          >
            <Body size="sm" style={styles.specsKey}>{s.k}</Body>
            <Body size="sm" style={styles.specsValue}>{s.v}</Body>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── Reviews Tab ─── */
const VERDICTS: [number, string][] = [
  [4.7, "Exceptional"],
  [4.2, "Loved by clients"],
  [3.6, "Well regarded"],
  [2.8, "Mixed impressions"],
  [0, "Room to improve"],
];

function ReviewsTab({
  reviews,
  avgRating,
  reviewCount,
  breakdown,
  onWriteReview,
}: {
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  breakdown: Record<number, number>;
  onWriteReview?: () => void;
}) {
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const photos = useMemo(() => reviews.flatMap((r) => r.photos ?? []).slice(0, 12), [reviews]);
  const verifiedCount = reviews.filter((r) => r.is_verified_purchase).length;
  const withPhotosCount = reviews.filter((r) => (r.photos?.length ?? 0) > 0).length;
  const distTotal = [1, 2, 3, 4, 5].reduce((s, k) => s + (breakdown[k] || 0), 0);
  // Bars use the distribution's own total so a product.total_reviews
  // fallback never renders "1 review" next to five empty bars.
  const barBase = Math.max(1, distTotal);
  const recommendPct = distTotal > 0 ? Math.round((((breakdown[5] || 0) + (breakdown[4] || 0)) / distTotal) * 100) : null;
  const verdict = VERDICTS.find(([min]) => avgRating >= min)?.[1] ?? "";

  const visible = reviews.filter((r) => {
    if (ratingFilter !== null && Math.round(r.rating) !== ratingFilter) return false;
    if (photosOnly && (r.photos?.length ?? 0) === 0) return false;
    return true;
  });

  if (reviewCount === 0) {
    return (
      <View style={styles.cardShadow}>
        <View style={[styles.card, styles.emptyReviews]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={GOLD} />
          </View>
          <Display size="lg" style={styles.emptyTitle}>No reviews yet</Display>
          <Body size="sm" style={styles.emptySub}>
            Own this piece? Tell others how it fits, feels and wears.
          </Body>
          <Pressable
            onPress={onWriteReview}
            style={({ pressed }) => [styles.solidBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="create-outline" size={15} color={GOLD} />
            <Body size="sm" style={styles.solidBtnText}>Write the first review</Body>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.reviewsContainer}>
      {/* Client verdict */}
      <View style={styles.verdictShadow}>
        <LinearGradient
          colors={["#2c3119", "#20240f", OLIVE_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.verdictCard}
        >
          <View style={styles.verdictRing} pointerEvents="none" />
          <View style={styles.verdictRingInner} pointerEvents="none" />

          <View style={styles.verdictTop}>
            <Label style={styles.verdictKicker}>CLIENT VERDICT</Label>
            <View style={styles.verdictPill}>
              <Body size="xs" style={styles.verdictPillText}>{verdict}</Body>
            </View>
          </View>

          <View style={styles.verdictScoreRow}>
            <Display size="4xl" style={styles.verdictScore}>{avgRating.toFixed(1)}</Display>
            <View style={styles.verdictScoreMeta}>
              <PartialStars value={avgRating} size={15} />
              <Body size="xs" style={styles.verdictCount}>
                Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </Body>
            </View>
          </View>

          <View style={styles.verdictBars}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = breakdown[star] || 0;
              const pct = (count / barBase) * 100;
              const active = ratingFilter === star;
              const dimmed = ratingFilter !== null && !active;
              return (
                <Pressable
                  key={star}
                  disabled={count === 0}
                  onPress={() => setRatingFilter(active ? null : star)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${star}-star reviews`}
                  style={[styles.vBarRow, active && styles.vBarRowActive, dimmed && { opacity: 0.4 }]}
                >
                  <View style={styles.vBarLabel}>
                    <Body size="xs" style={styles.vBarLabelText}>{star}</Body>
                    <Ionicons name="star" size={9} color={GOLD} />
                  </View>
                  <View style={styles.vBarTrack}>
                    <LinearGradient
                      colors={["#a8852f", GOLD, GOLD_LIGHT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.vBarFill, { width: `${pct}%` }]}
                    />
                  </View>
                  <Body size="xs" style={styles.vBarPct}>{distTotal > 0 ? `${Math.round(pct)}%` : "0"}</Body>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.verdictStats}>
            <VerdictStat icon="thumbs-up-outline" value={recommendPct === null ? "—" : `${recommendPct}%`} label="RECOMMEND" />
            <View style={styles.verdictStatDivider} />
            <VerdictStat icon="shield-checkmark-outline" value={String(verifiedCount)} label="VERIFIED" />
            <View style={styles.verdictStatDivider} />
            <VerdictStat icon="image-outline" value={String(withPhotosCount)} label="PHOTOS" />
          </View>

          <Pressable
            onPress={onWriteReview}
            style={({ pressed }) => [styles.goldBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] }]}
          >
            <LinearGradient
              colors={[GOLD, "#e0c574"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="create-outline" size={16} color={OLIVE_DARK} />
            <Body size="sm" style={styles.goldBtnText}>Write a review</Body>
          </Pressable>
        </LinearGradient>
      </View>

      {/* Worn by clients */}
      {photos.length > 0 && (
        <View style={styles.photoSection}>
          <View style={styles.photoHeader}>
            <View style={styles.photoHeaderLeft}>
              <Ionicons name="camera-outline" size={12} color={GOLD} />
              <Label style={styles.photoKicker}>WORN BY CLIENTS</Label>
            </View>
            <Body size="xs" style={styles.photoCount}>{photos.length} photo{photos.length === 1 ? "" : "s"}</Body>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
            {photos.map((uri, i) => (
              <Pressable key={`${i}-${uri}`} onPress={() => setViewer(uri)} style={styles.photoThumb}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip
          active={ratingFilter === null && !photosOnly}
          onPress={() => { setRatingFilter(null); setPhotosOnly(false); }}
          label="All"
          count={reviews.length}
        />
        {[5, 4, 3, 2, 1].map((s) => {
          const c = breakdown[s] || 0;
          if (c === 0) return null;
          return (
            <Chip
              key={s}
              active={ratingFilter === s}
              onPress={() => setRatingFilter(ratingFilter === s ? null : s)}
              label={`${s}★`}
              count={c}
            />
          );
        })}
        {withPhotosCount > 0 && (
          <Chip
            active={photosOnly}
            onPress={() => setPhotosOnly((v) => !v)}
            icon="image-outline"
            label="With photos"
            count={withPhotosCount}
          />
        )}
      </ScrollView>

      {/* Review cards — show all fetched (backend pages at 20) */}
      <View style={styles.reviewList}>
        {visible.length === 0 ? (
          <View style={styles.noMatch}>
            <Body size="sm" style={styles.emptySub}>No reviews match those filters.</Body>
            <Pressable onPress={() => { setRatingFilter(null); setPhotosOnly(false); }} hitSlop={8}>
              <Body size="xs" style={styles.clearLink}>Clear filters</Body>
            </Pressable>
          </View>
        ) : (
          visible.map((r) => <ReviewCard key={r.id} review={r} onPhoto={setViewer} />)
        )}
      </View>

      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={styles.viewerImage} contentFit="contain" />}
          <View style={styles.viewerClose}>
            <Ionicons name="close" size={20} color="#ffffff" />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ReviewCard({ review: r, onPhoto }: { review: Review; onPhoto: (uri: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const name = r.user?.full_name?.trim() || "Member";
  const isLong = (r.content?.length ?? 0) > 220;
  const content = isLong && !expanded ? `${r.content!.slice(0, 220)}…` : r.content;
  const date = r.created_at
    ? new Date(r.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <View style={styles.reviewShadow}>
      <View style={styles.reviewCard}>
        <Display size="4xl" style={styles.quoteMark}>{"\u201C"}</Display>

        <View style={styles.reviewTopRow}>
          <View style={styles.reviewStars}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < Math.round(r.rating) ? "star" : "star-outline"}
                size={14}
                color={i < Math.round(r.rating) ? GOLD : "#d8d4c6"}
              />
            ))}
          </View>
          {date && <Body size="xs" style={styles.reviewDate}>{date}</Body>}
        </View>

        {r.title ? (
          <Display size="md" style={styles.reviewTitle}>{r.title}</Display>
        ) : null}
        {content ? (
          <Body size="sm" style={styles.reviewContent}>{content}</Body>
        ) : null}
        {isLong && (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
            <Body size="xs" style={styles.readMore}>{expanded ? "Show less" : "Read more"}</Body>
          </Pressable>
        )}

        {(r.photos?.length ?? 0) > 0 && (
          <View style={styles.reviewPhotos}>
            {r.photos.map((uri, i) => (
              <Pressable key={`${i}-${uri}`} onPress={() => onPhoto(uri)} style={styles.reviewPhoto}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.reviewFooter}>
          <View style={styles.reviewAuthorRow}>
            <View style={styles.avatarRing}>
              <Avatar name={name} uri={r.user?.avatar_url} size={34} />
            </View>
            <View style={styles.reviewMeta}>
              <Body size="sm" style={styles.reviewAuthor} numberOfLines={1}>{name}</Body>
              {r.is_verified_purchase ? (
                <View style={styles.verifiedTag}>
                  <Ionicons name="shield-checkmark" size={10} color="#5b6a2a" />
                  <Body size="xs" style={styles.verifiedTagText}>Verified buyer</Body>
                </View>
              ) : (
                <Body size="xs" style={styles.reviewDate}>Client</Body>
              )}
            </View>
          </View>
          <HelpfulButton
            reviewId={r.id}
            initialVoted={Boolean((r as any).user_voted_helpful)}
            initialCount={r.helpful_count ?? 0}
          />
        </View>
      </View>
    </View>
  );
}

function PartialStars({ value, size }: { value: number; size: number }) {
  return (
    <View style={styles.summaryStars} accessibilityLabel={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => {
        const fill = Math.max(0, Math.min(1, value - (s - 1)));
        return (
          <View key={s} style={{ width: size, height: size }}>
            <Ionicons name="star" size={size} color="rgba(250,248,241,0.2)" style={StyleSheet.absoluteFill} />
            <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: size * fill, overflow: "hidden" }}>
              <Ionicons name="star" size={size} color={GOLD} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function VerdictStat({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; value: string; label: string }) {
  return (
    <View style={styles.verdictStat}>
      <Display size="xl" style={styles.verdictStatValue}>{value}</Display>
      <View style={styles.verdictStatLabelRow}>
        <Ionicons name={icon} size={10} color="rgba(250,248,241,0.5)" />
        <Label style={styles.verdictStatLabel}>{label}</Label>
      </View>
    </View>
  );
}

function Chip({
  active,
  onPress,
  label,
  count,
  icon,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  count?: number;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}>
      {icon && <Ionicons name={icon} size={12} color={active ? CREAM : INK} />}
      <Body size="xs" style={[styles.chipText, active && styles.chipTextActive]}>{label}</Body>
      {count !== undefined && (
        <Body size="xs" style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Body>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  sectionHeader: {
    paddingHorizontal: spacing[5],
    gap: spacing[1],
  },
  kicker: {
    color: MUTED,
    fontSize: 10,
    letterSpacing: 2.2,
    fontFamily: fontFamilies.sans.bold,
  },
  title: {
    color: INK,
    letterSpacing: -0.3,
  },
  titleItalic: {
    color: MUTED,
  },

  /* Shared card */
  cardShadow: {
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  card: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    padding: spacing[4],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing[2.5],
  },
  cardEyebrow: {
    color: INK,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: fontFamilies.sans.bold,
  },

  /* Tabs */
  tabBar: {
    flexDirection: "row",
    marginHorizontal: spacing[5],
    padding: 4,
    gap: 4,
    borderRadius: radii.full,
    backgroundColor: "#ececea",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: radii.full,
  },
  tabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    color: MUTED,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  tabTextActive: {
    color: INK,
    fontFamily: fontFamilies.sans.bold,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  tabCountActive: {
    backgroundColor: INK,
  },
  tabCountText: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.bold,
  },
  tabCountTextActive: {
    color: "#ffffff",
  },
  tabContent: {
    paddingHorizontal: spacing[4],
  },

  /* Description */
  descContainer: {
    gap: spacing[3],
  },
  descText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    lineHeight: 24,
    color: "#2b2b2b",
  },
  descEmpty: {
    color: MUTED,
  },
  highlightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2.5],
  },
  highlightTile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: spacing[3.5],
    gap: 4,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f2",
    marginBottom: 4,
  },
  highlightKey: {
    color: MUTED,
    fontSize: 9.5,
    letterSpacing: 1.4,
    fontFamily: fontFamilies.sans.bold,
  },
  highlightValue: {
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
  },

  /* Specs */
  specsCard: {
    paddingVertical: spacing[1],
  },
  specsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
    gap: spacing[3],
  },
  specsRowLast: {
    borderBottomWidth: 0,
  },
  specsKey: {
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    minWidth: 90,
  },
  specsValue: {
    flex: 1,
    textAlign: "right",
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
  },

  /* Reviews */
  reviewsContainer: {
    gap: spacing[4],
  },
  summaryStars: {
    flexDirection: "row",
    gap: 2,
  },
  verdictShadow: {
    borderRadius: 28,
    shadowColor: OLIVE_DARK,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 8,
  },
  verdictCard: {
    borderRadius: 28,
    overflow: "hidden",
    padding: spacing[5],
    gap: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
  },
  verdictRing: {
    position: "absolute",
    right: -70,
    top: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.18)",
  },
  verdictRingInner: {
    position: "absolute",
    right: -24,
    top: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.1)",
  },
  verdictTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verdictKicker: {
    color: GOLD,
    fontSize: 10,
    letterSpacing: 2.4,
  },
  verdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.07)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.12)",
  },
  verdictPillText: {
    color: "rgba(250,248,241,0.75)",
    fontSize: 10.5,
  },
  verdictScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[4],
  },
  verdictScore: {
    color: CREAM,
    fontSize: 72,
    lineHeight: 72,
    letterSpacing: -2,
  },
  verdictScoreMeta: {
    gap: 6,
    paddingBottom: 10,
  },
  verdictCount: {
    color: "rgba(250,248,241,0.55)",
  },
  verdictBars: {
    gap: 2,
  },
  vBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 12,
  },
  vBarRowActive: {
    backgroundColor: "rgba(250,248,241,0.08)",
  },
  vBarLabel: {
    width: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  vBarLabelText: {
    color: "rgba(250,248,241,0.8)",
    fontFamily: fontFamilies.sans.semibold,
  },
  vBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(250,248,241,0.09)",
    overflow: "hidden",
  },
  vBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  vBarPct: {
    width: 38,
    textAlign: "right",
    color: "rgba(250,248,241,0.5)",
  },
  verdictStats: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 18,
    backgroundColor: "rgba(250,248,241,0.045)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.1)",
  },
  verdictStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing[3],
    gap: 5,
  },
  verdictStatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(250,248,241,0.14)",
  },
  verdictStatValue: {
    color: CREAM,
  },
  verdictStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verdictStatLabel: {
    color: "rgba(250,248,241,0.5)",
    fontSize: 8.5,
    letterSpacing: 1.4,
  },
  goldBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  goldBtnText: {
    color: OLIVE_DARK,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
  },
  photoSection: {
    gap: spacing[2.5],
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photoHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoKicker: {
    color: MUTED,
    fontSize: 10,
    letterSpacing: 2,
  },
  photoCount: {
    color: MUTED,
  },
  photoStrip: {
    gap: 10,
  },
  photoThumb: {
    width: 88,
    height: 110,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ededeb",
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    backgroundColor: "#ffffff",
  },
  chipActive: {
    backgroundColor: OLIVE_DARK,
    borderColor: OLIVE_DARK,
  },
  chipText: {
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
  },
  chipTextActive: {
    color: CREAM,
  },
  chipCount: {
    color: MUTED,
  },
  chipCountActive: {
    color: GOLD_LIGHT,
  },
  solidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    paddingHorizontal: spacing[5],
    marginTop: spacing[2],
    borderRadius: radii.full,
    backgroundColor: OLIVE_DARK,
  },
  solidBtnText: {
    color: CREAM,
    fontFamily: fontFamilies.sans.bold,
  },
  reviewList: {
    gap: spacing[3],
  },
  noMatch: {
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing[8],
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.14)",
  },
  clearLink: {
    color: INK,
    fontFamily: fontFamilies.sans.bold,
    textDecorationLine: "underline",
  },
  reviewShadow: {
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  reviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    padding: spacing[5],
    gap: spacing[3],
    overflow: "hidden",
  },
  quoteMark: {
    position: "absolute",
    right: 18,
    top: 4,
    fontSize: 84,
    lineHeight: 96,
    color: "rgba(200,164,74,0.16)",
  },
  reviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 54,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewDate: {
    color: MUTED,
  },
  reviewTitle: {
    color: INK,
    paddingRight: 24,
  },
  reviewContent: {
    fontSize: 15,
    lineHeight: 23,
    color: "#3a3a3a",
  },
  readMore: {
    color: INK,
    fontFamily: fontFamilies.sans.bold,
    textDecorationLine: "underline",
  },
  reviewPhotos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reviewPhoto: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#ededeb",
  },
  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    marginTop: spacing[1],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  reviewAuthorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2.5],
  },
  avatarRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(200,164,74,0.45)",
  },
  reviewMeta: {
    flex: 1,
    gap: 2,
  },
  reviewAuthor: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedTagText: {
    color: "#5b6a2a",
    fontFamily: fontFamilies.sans.semibold,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,10,8,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
  viewerClose: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  emptyReviews: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[8],
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,164,74,0.12)",
    marginBottom: spacing[1],
  },
  emptyTitle: {
    color: INK,
  },
  emptySub: {
    color: MUTED,
    textAlign: "center",
  },
});
