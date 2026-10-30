import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Alert, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminReviews, deleteAdminReview, getAdminQA, type ModerationReview, type ModerationQA } from "@/lib/api";
import { EmptyState, Skeleton, Button } from "@/components/ui";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils";
import { AdminMasthead, Segmented, ChipRail, premiumCard, GOLD, RUST } from "@/components/admin/premium-kit";

type Tab = "reviews" | "qa";
type ReviewFilter = "all" | "approved" | "pending" | "rejected";
type QAFilter = "all" | "pending" | "answered";

const REVIEW_TONE: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  approved: { label: "Published", dot: "#4f8a2c", text: colors.olive[800], bg: "rgba(83,94,44,0.12)" },
  pending: { label: "Pending", dot: GOLD, text: "#7a5b1a", bg: "rgba(200,164,74,0.18)" },
  rejected: { label: "Hidden", dot: RUST, text: RUST, bg: "rgba(184,92,58,0.1)" },
};

function rel(s?: string | null) {
  if (!s) return "";
  const d = new Date(s).getTime();
  if (!Number.isFinite(d)) return "";
  const m = Math.max(0, Math.floor((Date.now() - d) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 60) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminContent() {
  const [tab, setTab] = useState<Tab>("reviews");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [qaFilter, setQAFilter] = useState<QAFilter>("all");

  // Both lists are fetched with status=all and filtered locally so the
  // filter chips can show live counts.
  const reviewsQ = useQuery({
    queryKey: ["admin-reviews", "all"],
    queryFn: async () => {
      const r = await getAdminReviews("all");
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });
  const qaQ = useQuery({
    queryKey: ["admin-qa", "all"],
    queryFn: async () => {
      const r = await getAdminQA("all");
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  const reviews = reviewsQ.data ?? [];
  const questions = qaQ.data ?? [];
  const avg = reviews.length ? reviews.reduce((n, r) => n + (r.rating ?? 0), 0) / reviews.length : 0;
  const unanswered = questions.filter((q) => !q.answer).length;

  const header = (
    <View>
      <AdminMasthead
        eyebrow="Moderation"
        title="Content"
        italic="Desk"
        subtitle="What shoppers are saying. Reviews publish automatically — remove anything that breaks the rules."
      />

      <View style={styles.summary}>
        <SummaryCell
          big={avg ? avg.toFixed(1) : "—"}
          suffix={avg ? <Ionicons name="star" size={13} color={GOLD} /> : null}
          label="AVG RATING"
        />
        <View style={styles.summaryRule} />
        <SummaryCell big={String(reviews.length)} label="REVIEWS" />
        <View style={styles.summaryRule} />
        <SummaryCell big={String(unanswered)} label="UNANSWERED" accent={unanswered > 0} />
      </View>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "reviews", label: "Reviews", count: reviews.length },
          { value: "qa", label: "Q&A", count: questions.length },
        ]}
      />

      {tab === "reviews" ? (
        <ChipRail<ReviewFilter>
          value={reviewFilter}
          onChange={setReviewFilter}
          options={[
            { value: "all", label: "All", count: reviews.length },
            { value: "approved", label: "Published", count: reviews.filter((r) => r.status === "approved").length },
            { value: "pending", label: "Pending", count: reviews.filter((r) => r.status === "pending").length },
            { value: "rejected", label: "Hidden", count: reviews.filter((r) => r.status === "rejected").length },
          ]}
        />
      ) : (
        <ChipRail<QAFilter>
          value={qaFilter}
          onChange={setQAFilter}
          options={[
            { value: "all", label: "All", count: questions.length },
            { value: "pending", label: "Awaiting answer", count: unanswered },
            { value: "answered", label: "Answered", count: questions.length - unanswered },
          ]}
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {tab === "reviews" ? (
        <ReviewsList
          header={header}
          query={reviewsQ}
          items={reviewFilter === "all" ? reviews : reviews.filter((r) => r.status === reviewFilter)}
        />
      ) : (
        <QAList
          header={header}
          query={qaQ}
          items={
            qaFilter === "all" ? questions
            : qaFilter === "pending" ? questions.filter((q) => !q.answer)
            : questions.filter((q) => !!q.answer)
          }
        />
      )}
    </View>
  );
}

function SummaryCell({ big, label, suffix, accent }: { big: string; label: string; suffix?: React.ReactNode; accent?: boolean }) {
  return (
    <View style={styles.summaryCell}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={[styles.summaryBig, accent && { color: RUST }]}>{big}</Text>
        {suffix}
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

type Q<T> = { isLoading: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => unknown; data?: T };

function ListShell<T extends { id: string }>({
  header,
  query,
  items,
  empty,
  renderItem,
}: {
  header: React.ReactElement;
  query: Q<T[]>;
  items: T[];
  empty: React.ReactElement;
  renderItem: (item: T) => React.ReactElement;
}) {
  return (
    <FlatList
      data={query.isLoading || query.isError ? [] : items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={query.isFetching && !query.isLoading} onRefresh={() => query.refetch()} tintColor={colors.light.primary} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        query.isLoading ? (
          <View style={{ paddingHorizontal: 16, gap: 14 }}>
            <Skeleton height={150} style={{ borderRadius: radii["2xl"] }} />
            <Skeleton height={150} style={{ borderRadius: radii["2xl"] }} />
          </View>
        ) : query.isError ? (
          <View style={styles.errorWrap}>
            <EmptyState icon="cloud-offline-outline" title="Couldn't load" description={(query.error as Error)?.message} />
            <Button onPress={() => query.refetch()}>Retry</Button>
          </View>
        ) : (
          empty
        )
      }
      renderItem={({ item }) => renderItem(item)}
    />
  );
}

function Avatar({ name, url }: { name?: string | null; url?: string | null }) {
  const src = url ? resolveImageUrl(url) || url : null;
  return src ? (
    <Image source={{ uri: src }} style={styles.avatar} contentFit="cover" />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarText}>{(name ?? "?").charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= value ? "star" : "star-outline"} size={13} color={i <= value ? GOLD : "#d6d4c4"} />
      ))}
    </View>
  );
}

function ReviewsList({ header, query, items }: { header: React.ReactElement; query: Q<ModerationReview[]>; items: ModerationReview[] }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteAdminReview(id);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
    onError: (e: unknown) => Alert.alert("Error", e instanceof Error ? e.message : "Delete failed"),
  });

  const confirmDelete = (r: ModerationReview) =>
    Alert.alert("Remove review?", "This permanently deletes the review and its photos.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove.mutate(r.id) },
    ]);

  return (
    <ListShell
      header={header}
      query={query}
      items={items}
      empty={<EmptyState icon="star-outline" title="No reviews here" description="Nothing in this filter yet." />}
      renderItem={(item) => {
        const tone = REVIEW_TONE[item.status] ?? REVIEW_TONE.pending;
        const text = item.content ?? item.body;
        const photos = (item.photos ?? []).filter(Boolean);
        return (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Stars value={item.rating ?? 0} />
              <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                <View style={[styles.pillDot, { backgroundColor: tone.dot }]} />
                <Text style={[styles.pillText, { color: tone.text }]}>{tone.label.toUpperCase()}</Text>
              </View>
            </View>

            {item.title ? <Text style={styles.reviewTitle}>{item.title}</Text> : null}
            {text ? (
              <Text style={[styles.reviewBody, !item.title && styles.reviewBodyLead]} numberOfLines={5}>
                {item.title ? text : `“${text}”`}
              </Text>
            ) : null}

            {photos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                {photos.map((p, i) => (
                  <Image key={`${p}-${i}`} source={{ uri: resolveImageUrl(p) || p }} style={styles.photo} contentFit="cover" />
                ))}
              </ScrollView>
            ) : null}

            {item.seller_reply ? (
              <View style={styles.reply}>
                <Text style={styles.replyLabel}>SELLER REPLY</Text>
                <Text style={styles.replyText} numberOfLines={3}>{item.seller_reply}</Text>
              </View>
            ) : null}

            <View style={styles.productTag}>
              <Ionicons name="pricetag-outline" size={11} color={colors.olive[700]} />
              <Text style={styles.productTagText} numberOfLines={1}>{item.product?.name ?? "Product"}</Text>
            </View>

            <View style={styles.footer}>
              <Avatar name={item.user?.full_name} url={item.user?.avatar_url} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={styles.author} numberOfLines={1}>{item.user?.full_name ?? "Anonymous"}</Text>
                  {item.is_verified_purchase ? <Ionicons name="checkmark-circle" size={13} color={colors.olive[600]} /> : null}
                </View>
                <Text style={styles.when}>
                  {rel(item.created_at)}
                  {item.is_verified_purchase ? " · Verified purchase" : ""}
                  {item.helpful_count ? ` · ${item.helpful_count} helpful` : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmDelete(item)}
                disabled={remove.isPending}
                hitSlop={8}
                style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                accessibilityLabel="Remove review"
              >
                <Ionicons name="trash-outline" size={14} color={RUST} />
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

function QAList({ header, query, items }: { header: React.ReactElement; query: Q<ModerationQA[]>; items: ModerationQA[] }) {
  return (
    <ListShell
      header={header}
      query={query}
      items={items}
      empty={<EmptyState icon="help-circle-outline" title="No questions here" description="Nothing in this filter yet." />}
      renderItem={(item) => {
        const answered = !!item.answer;
        const asker = item.user?.full_name ?? item.user_name ?? "Shopper";
        return (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.productTagInline}>
                <Ionicons name="pricetag-outline" size={11} color={colors.olive[700]} />
                <Text style={styles.productTagText} numberOfLines={1}>{item.product?.name ?? item.product_name ?? "Product"}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: answered ? "rgba(83,94,44,0.12)" : "rgba(200,164,74,0.18)" }]}>
                <View style={[styles.pillDot, { backgroundColor: answered ? "#4f8a2c" : GOLD }]} />
                <Text style={[styles.pillText, { color: answered ? colors.olive[800] : "#7a5b1a" }]}>
                  {answered ? "ANSWERED" : "AWAITING"}
                </Text>
              </View>
            </View>

            <View style={styles.qaRow}>
              <Text style={styles.qaMark}>Q.</Text>
              <Text style={styles.question}>{item.question}</Text>
            </View>
            {answered ? (
              <View style={[styles.qaRow, styles.answerRow]}>
                <Text style={[styles.qaMark, styles.aMark]}>A.</Text>
                <Text style={styles.answer}>{item.answer}</Text>
              </View>
            ) : (
              <Text style={styles.awaiting}>No answer yet — the seller has been notified.</Text>
            )}

            <View style={styles.footer}>
              <Avatar name={asker} url={item.user?.avatar_url} />
              <View style={{ flex: 1 }}>
                <Text style={styles.author} numberOfLines={1}>{asker}</Text>
                <Text style={styles.when}>
                  Asked {rel(item.created_at)}
                  {item.helpful_count ? ` · ${item.helpful_count} found helpful` : ""}
                </Text>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingBottom: 140, gap: 14 },
  errorWrap: { alignItems: "center", gap: 12, paddingVertical: 24 },

  summary: {
    ...premiumCard,
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 16,
  },
  summaryCell: { flex: 1, alignItems: "center" },
  summaryRule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.light.border },
  summaryBig: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: colors.light.foreground, letterSpacing: -0.5 },
  summaryLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 8.5, color: colors.light.mutedForeground, letterSpacing: 1.3, marginTop: 3 },

  card: { ...premiumCard, marginHorizontal: 16, padding: 16, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  stars: { flexDirection: "row", gap: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1 },

  reviewTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 18, lineHeight: 23, color: colors.light.foreground, letterSpacing: -0.3 },
  reviewBody: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 20, color: colors.ink.soft },
  reviewBodyLead: { fontFamily: fontFamilies.display.italic, fontSize: 16, lineHeight: 23, color: colors.light.foreground },
  photos: { gap: 8 },
  photo: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.light.muted },
  reply: {
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    paddingLeft: 10,
    paddingVertical: 2,
  },
  replyLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, color: "#8d6a1f", letterSpacing: 1.3 },
  replyText: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 18, color: colors.ink.soft, marginTop: 2 },

  productTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "#eef0dc",
  },
  productTagInline: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full, backgroundColor: "#eef0dc" },
  productTagText: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: colors.olive[800], flexShrink: 1 },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dddccd",
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.olive[100] },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.olive[900] },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 13, color: colors.paper.cream },
  author: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.light.foreground, flexShrink: 1 },
  when: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 1 },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(184,92,58,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(184,92,58,0.3)",
  },

  qaRow: { flexDirection: "row", gap: 10 },
  qaMark: { fontFamily: fontFamilies.display.italic, fontSize: 20, lineHeight: 24, color: colors.olive[500], width: 24 },
  aMark: { color: GOLD },
  question: { flex: 1, fontFamily: fontFamilies.display.semibold, fontSize: 16.5, lineHeight: 23, color: colors.light.foreground, letterSpacing: -0.2 },
  answerRow: { backgroundColor: "#f4f2e8", borderRadius: radii.lg, padding: 10, marginLeft: -2 },
  answer: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 20, color: colors.ink.soft },
  awaiting: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: colors.light.mutedForeground, fontStyle: "italic", marginLeft: 34 },
});
