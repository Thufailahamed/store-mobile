import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { getBlogPosts, type BlogPost } from "@/lib/api";
import { Skeleton } from "@/components/ui";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { blogAuthorName, blogReadingTime, formatBlogDate } from "@/lib/utils/blog";

const HAIRLINE = "rgba(22, 23, 15, 0.1)";

function coverUri(post: BlogPost) {
  return post.cover_image ? resolveImageUrl(post.cover_image) ?? post.cover_image : null;
}

function MetaLine({ post, light }: { post: BlogPost; light?: boolean }) {
  const date = formatBlogDate(post.published_at ?? post.created_at);
  const mins = blogReadingTime(post.content);
  const color = light ? "rgba(255,255,255,0.78)" : colors.ink.mute;
  const parts = [blogAuthorName(post.author), date, mins ? `${mins} min read` : null].filter(Boolean);
  return (
    <Text style={[styles.metaLine, { color }]} numberOfLines={1}>
      {parts.join("  ·  ")}
    </Text>
  );
}

export default function BlogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const postsQuery = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const res = await getBlogPosts();
      return res.ok ? res.data : [];
    },
  });

  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => (p.tags ?? []).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 12);
  }, [posts]);

  const filtered = activeTag ? posts.filter((p) => p.tags?.includes(activeTag)) : posts;
  const [featured, ...rest] = filtered;

  const openPost = (slug: string) =>
    router.push({ pathname: "/(main)/blog/[slug]", params: { slug } });

  const barHeight = insets.top + 56;
  const compactOpacity = scrollY.interpolate({ inputRange: [70, 120], outputRange: [0, 1], extrapolate: "clamp" });
  const issueLabel = new Date()
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

  const masthead = (
    <View style={[styles.masthead, { paddingTop: barHeight + spacing[2] }]}>
      <View style={styles.issueRow}>
        <View style={styles.issueRule} />
        <Text style={styles.issueText}>THE LUXE JOURNAL  ·  {issueLabel}</Text>
        <View style={styles.issueRule} />
      </View>
      <Text style={styles.title}>Editorial</Text>
      <Text style={styles.titleItalic}>& Stories</Text>
      <Text style={styles.subtitle}>
        Curated chronicles of horology, craftsmanship, textiles & ateliers.
      </Text>

      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {[null, ...tags].map((tag) => {
            const active = activeTag === tag;
            return (
              <Pressable
                key={tag ?? "__all"}
                onPress={() => setActiveTag(tag)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag ?? "All Stories"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const renderFeatured = (post: BlogPost) => {
    const uri = coverUri(post);
    const kicker = post.tags?.[0];
    return (
      <Pressable
        onPress={() => openPost(post.slug)}
        style={({ pressed }) => [styles.featuredCard, { height: Math.min(width * 1.25, 520) }, pressed && styles.pressed]}
      >
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.olive[800] }]} />
        )}
        <LinearGradient
          colors={["rgba(12,13,8,0)", "rgba(12,13,8,0.35)", "rgba(12,13,8,0.88)"]}
          locations={[0.3, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.featuredBadge}>
          <View style={styles.featuredDot} />
          <Text style={styles.featuredBadgeText}>COVER STORY</Text>
        </View>
        <View style={styles.featuredBody}>
          {kicker ? <Text style={styles.featuredKicker}>{kicker.toUpperCase()}</Text> : null}
          <Text style={styles.featuredTitle} numberOfLines={3}>
            {post.title}
          </Text>
          {post.excerpt ? (
            <Text style={styles.featuredExcerpt} numberOfLines={2}>
              {post.excerpt}
            </Text>
          ) : null}
          <View style={styles.featuredFooter}>
            <MetaLine post={post} light />
            <View style={styles.readCta}>
              <Ionicons name="arrow-forward" size={16} color={colors.ink.DEFAULT} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderStory = ({ item, index }: { item: BlogPost; index: number }) => {
    const uri = coverUri(item);
    const kicker = item.tags?.[0];
    return (
      <Pressable
        onPress={() => openPost(item.slug)}
        style={({ pressed }) => [styles.story, pressed && styles.pressed]}
      >
        <View style={styles.storyImageWrap}>
          {uri ? (
            <Image source={{ uri }} style={styles.storyImage} contentFit="cover" transition={300} />
          ) : (
            <View style={styles.storyPlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.olive[400]} />
            </View>
          )}
          <View style={styles.storyIndex}>
            <Text style={styles.storyIndexText}>No. {String(index + 2).padStart(2, "0")}</Text>
          </View>
        </View>
        <View style={styles.storyBody}>
          {kicker ? (
            <Text style={styles.storyKicker}>
              {kicker.toUpperCase()}
              {item.tags && item.tags.length > 1 ? (
                <Text style={styles.storyKickerMuted}>{"  /  " + item.tags[1].toUpperCase()}</Text>
              ) : null}
            </Text>
          ) : null}
          <Text style={styles.storyTitle} numberOfLines={3}>
            {item.title}
          </Text>
          {item.excerpt ? (
            <Text style={styles.storyExcerpt} numberOfLines={2}>
              {item.excerpt}
            </Text>
          ) : null}
          <View style={styles.storyFooter}>
            <MetaLine post={item} />
            <Text style={styles.readLink}>Read</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {postsQuery.isLoading ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing[12] }}>
          {masthead}
          <View style={styles.listPad}>
            <Skeleton width="100%" height={Math.min(width * 1.1, 460)} style={{ borderRadius: radii["3xl"] }} />
            {[1, 2].map((i) => (
              <View key={i} style={{ marginTop: spacing[8] }}>
                <Skeleton width="100%" height={210} style={{ borderRadius: radii["2xl"] }} />
                <Skeleton width="30%" height={12} style={{ marginTop: 16 }} />
                <Skeleton width="90%" height={24} style={{ marginTop: 10 }} />
                <Skeleton width="70%" height={16} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Animated.FlatList
          data={rest}
          keyExtractor={(item) => item.id}
          renderItem={renderStory}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing[12] }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={postsQuery.isRefetching}
              onRefresh={() => postsQuery.refetch()}
              tintColor={colors.olive[600]}
              progressViewOffset={barHeight}
            />
          }
          ListHeaderComponent={
            <>
              {masthead}
              {featured ? <View style={styles.listPad}>{renderFeatured(featured)}</View> : null}
              {rest.length > 0 && (
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Latest Stories</Text>
                  <View style={styles.sectionRule} />
                  <Text style={styles.sectionCount}>{String(rest.length).padStart(2, "0")}</Text>
                </View>
              )}
            </>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            featured ? null : (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="book-outline" size={28} color={colors.olive[700]} />
                </View>
                <Text style={styles.emptyTitle}>{activeTag ? "Nothing filed here yet" : "No Stories Yet"}</Text>
                <Text style={styles.emptySubtitle}>
                  {activeTag
                    ? "Try another theme from the journal index above."
                    : "Our editorial desk is crafting upcoming pieces. Check back soon."}
                </Text>
              </View>
            )
          }
        />
      )}

      {/* ── Floating Glass Navigation ── */}
      <View style={[styles.topBar, { height: barHeight, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: compactOpacity }]}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.topBarTint]} />
        </Animated.View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={18} color={colors.ink.DEFAULT} />
        </Pressable>
        <Animated.Text style={[styles.compactTitle, { opacity: compactOpacity }]}>The Journal</Animated.Text>
        <View style={styles.iconBtnGhost} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },

  // Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
  },
  topBarTint: {
    backgroundColor: "rgba(245, 244, 239, 0.72)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22, 23, 15, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  iconBtnGhost: { width: 40, height: 40 },
  compactTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.2,
  },

  // Masthead
  masthead: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: spacing[5],
  },
  issueRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(22, 23, 15, 0.25)",
  },
  issueText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.ink.mute,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 48,
    lineHeight: 52,
    color: colors.ink.DEFAULT,
    letterSpacing: -1.4,
  },
  titleItalic: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 44,
    lineHeight: 50,
    color: colors.accent2.rust,
    letterSpacing: -1,
    marginTop: -4,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink.mute,
    marginTop: spacing[3],
    maxWidth: 320,
  },
  chipsScroll: {
    marginTop: spacing[5],
    marginHorizontal: -spacing[5],
  },
  chipsRow: {
    paddingHorizontal: spacing[5],
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.14)",
  },
  chipActive: {
    backgroundColor: colors.ink.DEFAULT,
    borderColor: colors.ink.DEFAULT,
  },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.ink.soft,
    textTransform: "capitalize",
  },
  chipTextActive: {
    color: colors.paper.cream,
  },

  listPad: {
    paddingHorizontal: spacing[4],
  },

  // Featured
  featuredCard: {
    borderRadius: radii["3xl"],
    overflow: "hidden",
    backgroundColor: colors.olive[900],
    justifyContent: "flex-end",
  },
  featuredBadge: {
    position: "absolute",
    top: spacing[4],
    left: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
  },
  featuredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2.rust,
  },
  featuredBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: colors.ink.DEFAULT,
  },
  featuredBody: {
    padding: spacing[5],
    paddingTop: 0,
  },
  featuredKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.accent2.ochre,
    marginBottom: spacing[2],
  },
  featuredTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: "#ffffff",
  },
  featuredExcerpt: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.82)",
    marginTop: spacing[2.5],
  },
  featuredFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[4],
    paddingTop: spacing[3.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.28)",
    gap: 12,
  },
  readCta: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  metaLine: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    letterSpacing: 0.1,
  },

  // Section head
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[5],
    marginTop: spacing[10],
    marginBottom: spacing[5],
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink.DEFAULT,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(22, 23, 15, 0.25)",
  },
  sectionCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
    letterSpacing: 1,
  },

  // Story rows
  story: {
    paddingHorizontal: spacing[4],
  },
  storyImageWrap: {
    width: "100%",
    aspectRatio: 16 / 11,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.olive[50],
  },
  storyImage: {
    width: "100%",
    height: "100%",
  },
  storyPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  storyIndex: {
    position: "absolute",
    top: spacing[3],
    right: spacing[3],
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(250, 248, 241, 0.9)",
  },
  storyIndexText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.ink.DEFAULT,
  },
  storyBody: {
    paddingHorizontal: spacing[1],
    paddingTop: spacing[4],
  },
  storyKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent2.rust,
    marginBottom: spacing[2],
  },
  storyKickerMuted: {
    color: colors.ink.mute,
  },
  storyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.ink.DEFAULT,
  },
  storyExcerpt: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink.soft,
    opacity: 0.85,
    marginTop: spacing[2],
  },
  storyFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[3.5],
    gap: 12,
  },
  readLink: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12.5,
    color: colors.ink.DEFAULT,
    textDecorationLine: "underline",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginHorizontal: spacing[5],
    marginVertical: spacing[7],
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[16],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.ink.DEFAULT,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.ink.mute,
    textAlign: "center",
    lineHeight: 21,
  },
});
