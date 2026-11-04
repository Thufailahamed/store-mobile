import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView, Modal } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui";
import { Display, Label, Body } from "@/components/ui/Typography";
import { spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product, Review } from "@/lib/types";
import { HelpfulButton } from "@/components/reviews/HelpfulButton";
import { C } from "@/components/orders/parcel-track";

const INK = "#141414";
const MUTED = "#6b6b6b";
const HAIRLINE = "rgba(0,0,0,0.08)";
const GOLD = "#c8a44a";

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
  const clearFilters = () => { setRatingFilter(null); setPhotosOnly(false); };

  if (reviewCount === 0) {
    return (
      <View style={styles.rvShadow}>
        <View style={[styles.rvCard, styles.emptyReviews]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color={C.accent} />
          </View>
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptySub}>Own this piece? Tell others how it fits, feels and wears.</Text>
          <WriteButton label="Write the first review" onPress={onWriteReview} compact />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.reviewsContainer}>
      {/* Summary */}
      <View style={styles.rvShadow}>
        <View style={styles.rvCard}>
          <View style={styles.summaryRow}>
            <View style={styles.scoreCol}>
              <Text style={styles.score}>{avgRating.toFixed(1)}</Text>
              <PartialStars value={avgRating} size={14} />
              <Text style={styles.scoreCount}>
                {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.bars}>
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
                    accessibilityLabel={`Show ${star}-star reviews, ${count}`}
                    style={[styles.barRow, dimmed && { opacity: 0.35 }]}
                  >
                    <Text style={styles.barStar}>{star}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%` }, active && styles.barFillActive]} />
                    </View>
                    <Text style={[styles.barCount, count > 0 && styles.barCountOn]}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.verdictLine}>
            <View style={styles.verdictPill}>
              <Ionicons name="ribbon-outline" size={13} color={C.accent} />
              <Text style={styles.verdictPillText}>{verdict}</Text>
            </View>
            <Text style={styles.verdictHint}>Tap a bar to filter</Text>
          </View>

          <View style={styles.statsStrip}>
            <SummaryStat value={recommendPct === null ? "—" : `${recommendPct}%`} label="Recommend" />
            <View style={styles.statDivider} />
            <SummaryStat value={String(verifiedCount)} label="Verified" />
            <View style={styles.statDivider} />
            <SummaryStat value={String(withPhotosCount)} label="With photos" />
          </View>

          <WriteButton label="Write a review" onPress={onWriteReview} />
        </View>
      </View>

      {/* Worn by clients */}
      {photos.length > 0 && (
        <View style={styles.photoSection}>
          <View style={styles.photoHeader}>
            <Text style={styles.sectionTitle}>Worn by clients</Text>
            <Text style={styles.photoCount}>{photos.length} photo{photos.length === 1 ? "" : "s"}</Text>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        <Chip active={ratingFilter === null && !photosOnly} onPress={clearFilters} label="All" count={reviews.length} />
        {[5, 4, 3, 2, 1].map((s) => {
          const c = breakdown[s] || 0;
          if (c === 0) return null;
          return (
            <Chip
              key={s}
              active={ratingFilter === s}
              onPress={() => setRatingFilter(ratingFilter === s ? null : s)}
              icon="star"
              label={String(s)}
              count={c}
            />
          );
        })}
        {withPhotosCount > 0 && (
          <Chip
            active={photosOnly}
            onPress={() => setPhotosOnly((v) => !v)}
            icon="image-outline"
            label="Photos"
            count={withPhotosCount}
          />
        )}
      </ScrollView>

      {/* Review cards — show all fetched (backend pages at 20) */}
      <View style={styles.reviewList}>
        {visible.length === 0 ? (
          <View style={styles.noMatch}>
            <Text style={styles.emptySub}>No reviews match those filters.</Text>
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearLink}>Clear filters</Text>
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
  const stars = Math.round(r.rating);

  return (
    <View style={styles.rvShadow}>
      <View style={styles.rvCard}>
        <View style={styles.reviewHead}>
          <Avatar name={name} uri={r.user?.avatar_url} size={44} />
          <View style={styles.reviewMeta}>
            <Text style={styles.reviewAuthor} numberOfLines={1}>{name}</Text>
            <Text style={styles.reviewSub} numberOfLines={1}>
              {r.is_verified_purchase ? "Verified buyer" : "Client"}
              {date ? `  ·  ${date}` : ""}
            </Text>
          </View>
          <View style={styles.ratingBadge} accessibilityLabel={`${stars} out of 5`}>
            <Ionicons name="star" size={12} color={C.lime} />
            <Text style={styles.ratingBadgeText}>{stars}.0</Text>
          </View>
        </View>

        {r.title ? <Text style={styles.reviewTitle}>{r.title}</Text> : null}
        {content ? <Text style={styles.reviewContent}>{content}</Text> : null}
        {isLong && (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
            <Text style={styles.readMore}>{expanded ? "Show less" : "Read more"}</Text>
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
          {r.is_verified_purchase ? (
            <View style={styles.verifiedTag}>
              <Ionicons name="shield-checkmark" size={12} color={C.accent} />
              <Text style={styles.verifiedTagText}>Verified purchase</Text>
            </View>
          ) : (
            <View />
          )}
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
            <Ionicons name="star" size={size} color={C.faint} style={StyleSheet.absoluteFill} />
            <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: size * fill, overflow: "hidden" }}>
              <Ionicons name="star" size={size} color={GOLD} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Ink pill with a lime icon disc — same CTA language as the order screens. */
function WriteButton({ label, onPress, compact = false }: { label: string; onPress?: () => void; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.writeBtn, compact && styles.writeBtnCompact, pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] }]}
    >
      <Text style={styles.writeBtnText}>{label}</Text>
      <View style={styles.writeBtnIcon}>
        <Ionicons name="create-outline" size={17} color={C.ink} />
      </View>
    </Pressable>
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}
    >
      {icon && <Ionicons name={icon} size={13} color={active ? C.lime : icon === "star" ? GOLD : C.text} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {count !== undefined && (
        <View style={[styles.chipCount, active && styles.chipCountActive]}>
          <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
        </View>
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

  /* Reviews — My Orders language: white cards, ink + lime accents */
  reviewsContainer: { gap: 16 },
  rvShadow: {
    borderRadius: 26,
    backgroundColor: C.card,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  rvCard: {
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    gap: 16,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  scoreCol: { alignItems: "center", gap: 6, minWidth: 92 },
  score: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.6,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  summaryStars: { flexDirection: "row", gap: 2 },
  scoreCount: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },
  bars: { flex: 1, gap: 7 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 16 },
  barStar: { width: 10, fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.text, textAlign: "center" },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#f1efe6", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.ink },
  barFillActive: { backgroundColor: C.accent },
  barCount: {
    width: 20,
    textAlign: "right",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: C.faint,
    fontVariant: ["tabular-nums"],
  },
  barCountOn: { color: C.text },
  verdictLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  verdictPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: C.accentSoft,
  },
  verdictPillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.accent },
  verdictHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, color: C.cream, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },
  writeBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 22,
    paddingRight: 6,
    backgroundColor: C.ink,
  },
  writeBtnCompact: { alignSelf: "stretch", marginTop: 8 },
  writeBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: C.cream },
  writeBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.lime,
  },

  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
  photoSection: { gap: 10 },
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  photoCount: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },
  photoStrip: { gap: 10 },
  photoThumb: {
    width: 84,
    height: 104,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#f0ede2",
  },

  chipScroll: { marginHorizontal: -spacing[4] },
  chipRow: { paddingHorizontal: spacing[4], gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  chipTextActive: { color: C.cream },
  chipCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  chipCountActive: { backgroundColor: "rgba(200,224,138,0.18)" },
  chipCountText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: C.muted },
  chipCountTextActive: { color: C.lime },

  reviewList: { gap: 14 },
  noMatch: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
    borderRadius: 26,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  clearLink: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.accent },

  reviewHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  reviewMeta: { flex: 1, minWidth: 0, gap: 2 },
  reviewAuthor: { fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, letterSpacing: -0.2, color: C.text },
  reviewSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: C.ink,
  },
  ratingBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.cream, fontVariant: ["tabular-nums"] },
  reviewTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, letterSpacing: -0.3, color: C.text, marginBottom: -8 },
  reviewContent: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: "#3d3d36" },
  readMore: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.accent, marginTop: -8 },
  reviewPhotos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reviewPhoto: { width: 72, height: 72, borderRadius: 16, overflow: "hidden", backgroundColor: "#f0ede2" },
  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(22,23,15,0.1)",
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
  },
  verifiedTagText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.accent },

  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,10,8,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: { width: "100%", height: "80%" },
  viewerClose: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  emptyReviews: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
  },
});
