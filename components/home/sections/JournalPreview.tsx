import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { BlogPost } from "@/lib/types";

interface JournalPreviewProps {
  posts: BlogPost[];
  kicker?: string;
  title?: string;
  onSeeAll?: () => void;
}

function fmtDate(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function JournalPreview({
  posts,
  kicker = "From the Journal · 09",
  title = "Read slowly.",
  onSeeAll,
}: JournalPreviewProps) {
  const router = useRouter();
  if (!posts.length) return null;
  const [feature, ...rest] = posts;

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View>
            <View style={styles.kickerRow}>
              <View style={styles.kickerRule} />
              <Label style={styles.kickerText}>{kicker}</Label>
            </View>
            <Display size="3xl" style={styles.title}>
              {title}
            </Display>
          </View>
          {onSeeAll ? (
            <TouchableOpacity activeOpacity={0.7} onPress={onSeeAll} style={styles.seeAll}>
              <Label style={styles.seeAllText}>The full archive</Label>
              <Ionicons name="arrow-up" size={11} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Feature */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/(main)/blog/${feature.slug}`)}
          style={styles.feature}
        >
          {feature.cover_image ? (
            <Image
              source={{ uri: feature.cover_image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={400}
            />
          ) : null}
          <View style={styles.featureGradient} />
          <View style={styles.featureTop}>
            <View style={styles.featureTag}>
              <Label style={styles.featureTagText}>Story</Label>
            </View>
            <Label style={styles.featureDate}>{fmtDate(feature.published_at)}</Label>
          </View>
          <View style={styles.featureBody}>
            <Display size="2xl" style={styles.featureTitle} numberOfLines={2}>
              {feature.title}
            </Display>
            {feature.excerpt ? (
              <Body size="sm" style={styles.featureExcerpt} numberOfLines={3}>
                {feature.excerpt}
              </Body>
            ) : null}
            <View style={styles.featureFooter}>
              <Label style={styles.featureFooterText}>The Editors</Label>
              <View style={styles.featureFooterDot} />
              <Label style={styles.featureFooterText}>5 min read</Label>
              <View style={styles.featureRead}>
                <Label style={styles.featureReadText}>Read</Label>
                <Ionicons name="arrow-up" size={11} color={colors.paper.cream} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Secondary cards */}
        {rest.length ? (
          <View style={styles.secondary}>
            {rest.map((post) => (
              <TouchableOpacity
                key={post.id}
                activeOpacity={0.9}
                onPress={() => router.push(`/(main)/blog/${post.slug}`)}
                style={styles.card}
              >
                {post.cover_image ? (
                  <View style={styles.cardImageWrap}>
                    <Image
                      source={{ uri: post.cover_image }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={400}
                    />
                    <View style={styles.cardImageTint} />
                  </View>
                ) : null}
                <View style={styles.cardBody}>
                  <View style={styles.cardMeta}>
                    <Label style={styles.cardMetaTag}>Story</Label>
                    <Label style={styles.cardMetaDate}>{fmtDate(post.published_at)}</Label>
                  </View>
                  <Display size="lg" style={styles.cardTitle} numberOfLines={2}>
                    {post.title}
                  </Display>
                  {post.excerpt ? (
                    <Body size="xs" style={styles.cardExcerpt} numberOfLines={2}>
                      {post.excerpt}
                    </Body>
                  ) : null}
                  <View style={styles.cardFooter}>
                    <Label style={styles.cardFooterText}>5 min read</Label>
                    <Ionicons name="arrow-up" size={11} color={colors.light.mutedForeground} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing[10], paddingBottom: spacing[8] },
  inner: { paddingHorizontal: 20, gap: spacing[6] },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing[3] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  title: { color: colors.light.foreground, lineHeight: 34 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 4 },
  seeAllText: { color: colors.light.foreground },
  // Feature
  feature: {
    height: 360,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[200],
    position: "relative",
  },
  featureGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22, 26, 10, 0.55)" },
  featureTop: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureTag: {
    backgroundColor: colors.paper.cream,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  featureTagText: { color: colors.light.primary, fontSize: 9 },
  featureDate: { color: "rgba(245, 244, 239, 0.9)" },
  featureBody: { position: "absolute", left: spacing[4], right: spacing[4], bottom: spacing[4], gap: spacing[2] },
  featureTitle: { color: colors.paper.cream, fontSize: 28, lineHeight: 32 },
  featureExcerpt: { color: "rgba(245, 244, 239, 0.85)" },
  featureFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: spacing[3],
    marginTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 244, 239, 0.20)",
  },
  featureFooterText: { color: "rgba(245, 244, 239, 0.9)" },
  featureFooterDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(245, 244, 239, 0.5)" },
  featureRead: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 },
  featureReadText: { color: colors.paper.cream },
  // Secondary
  secondary: { gap: spacing[3] },
  card: {
    flexDirection: "row",
    backgroundColor: colors.paper.cream,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[3],
    gap: spacing[3],
  },
  cardImageWrap: {
    width: 88,
    height: 110,
    borderRadius: radii.md,
    backgroundColor: colors.olive[100],
    overflow: "hidden",
    position: "relative",
  },
  cardImageTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22, 26, 10, 0.15)" },
  cardBody: { flex: 1, gap: spacing[1] },
  cardMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardMetaTag: { color: colors.light.primary, fontSize: 9 },
  cardMetaDate: { color: colors.light.mutedForeground, fontSize: 9 },
  cardTitle: { color: colors.light.foreground, fontSize: 16, lineHeight: 20 },
  cardExcerpt: { color: colors.light.mutedForeground },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto" },
  cardFooterText: { color: colors.light.mutedForeground, fontSize: 9 },
});
