import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Animated,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@/components/ui/Icon";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/api";
import { Skeleton, useToast } from "@/components/ui";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { blogAuthorName, blogReadingTime, formatBlogDate } from "@/lib/utils/blog";
import { RichBlogContent } from "@/components/blog/RichBlogContent";

const HAIRLINE = "rgba(22, 23, 15, 0.1)";
const SHEET_OVERLAP = 28;

export default function BlogPostDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const { width, height: windowH } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [contentH, setContentH] = useState(1);
  const [viewH, setViewH] = useState(windowH);

  const postQuery = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      if (!slug) return null;
      const res = await getBlogPostBySlug(slug);
      return res.ok ? res.data : null;
    },
    enabled: !!slug,
  });

  const postsQuery = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const res = await getBlogPosts();
      return res.ok ? res.data : [];
    },
  });

  const post = postQuery.data;
  const heroH = Math.round(Math.min(windowH * 0.58, width * 1.2));
  const barH = insets.top + 56;
  const hasCover = !!post?.cover_image;
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    const threshold = heroH - barH - SHEET_OVERLAP;
    const id = scrollY.addListener(({ value }) => {
      const next = value < threshold;
      setOverHero((prev) => (prev === next ? prev : next));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, heroH, barH]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [slug]);

  const readingTime = useMemo(() => blogReadingTime(post?.content) ?? 3, [post?.content]);

  const related = useMemo(() => {
    const all = (postsQuery.data ?? []).filter((p) => p.slug !== slug);
    const tags = new Set(post?.tags ?? []);
    return all
      .map((p) => ({ p, score: (p.tags ?? []).filter((t) => tags.has(t)).length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ p }) => p);
  }, [postsQuery.data, post?.tags, slug]);

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        title: post.title,
        message: `${post.title}\n\nRead the full story on LUXE Journal.`,
      });
    } catch {
      // User dismissed share dialog
    }
  };

  const handleCopyLink = async () => {
    if (!post) return;
    try {
      const url = `https://luxe.store/blog/${post.slug}`;
      await Clipboard.setStringAsync(url);
      toast("Story link copied to clipboard", "success");
    } catch {
      toast("Could not copy link", "error");
    }
  };

  // ── Scroll-driven animation values ──
  const fadeStart = hasCover ? heroH - barH - 80 : 0;
  const barOpacity = scrollY.interpolate({
    inputRange: [fadeStart, fadeStart + 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const heroTranslate = scrollY.interpolate({
    inputRange: [-heroH, 0, heroH],
    outputRange: [heroH / 2, 0, -heroH * 0.5],
    extrapolate: "clamp",
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-heroH, 0],
    outputRange: [2, 1],
    extrapolate: "clamp",
  });
  const progress = scrollY.interpolate({
    inputRange: [0, Math.max(1, contentH - viewH)],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const lightChrome = hasCover && overHero;

  const navButton = (icon: React.ComponentProps<typeof Ionicons>["name"], onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}>
      {lightChrome ? <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, lightChrome ? styles.navBtnGlass : styles.navBtnSolid]} />
      <Ionicons name={icon} size={18} color={colors.ink.DEFAULT} />
    </Pressable>
  );

  const topBar = (title?: string) => (
    <View style={[styles.topBar, { height: barH, paddingTop: insets.top }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: hasCover ? barOpacity : 1 }]} pointerEvents="none">
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.topBarTint]} />
      </Animated.View>
      {navButton("arrow-back", () => router.back())}
      <Animated.Text
        numberOfLines={1}
        style={[styles.topBarTitle, { opacity: hasCover ? barOpacity : 1 }]}
      >
        {title ?? "The Journal"}
      </Animated.Text>
      {post ? (
        <View style={styles.navActions}>
          {navButton("link-outline", handleCopyLink)}
          {navButton("share-outline", handleShare)}
        </View>
      ) : (
        <View style={{ width: 40 }} />
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.progressTrack,
          { opacity: hasCover ? barOpacity : 1, transform: [{ scaleX: progress }] },
        ]}
      />
    </View>
  );

  if (postQuery.isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={{ paddingBottom: spacing[12] }}>
          <Skeleton width="100%" height={heroH} style={{ borderRadius: 0 }} />
          <View style={[styles.sheet, { marginTop: -SHEET_OVERLAP }]}>
            <Skeleton width={140} height={12} />
            <Skeleton width="92%" height={34} style={{ marginTop: 16 }} />
            <Skeleton width="70%" height={34} style={{ marginTop: 8 }} />
            <Skeleton width="100%" height={18} style={{ marginTop: 24 }} />
            <Skeleton width="85%" height={18} style={{ marginTop: 8 }} />
            <Skeleton width="100%" height={56} style={{ marginTop: 28, borderRadius: radii.xl }} />
          </View>
        </ScrollView>
        {topBar()}
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="book-outline" size={28} color={colors.olive[700]} />
          </View>
          <Text style={styles.emptyTitle}>Story Not Found</Text>
          <Text style={styles.emptyText}>
            The editorial piece you are looking for may have been archived or moved.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={colors.paper.cream} style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Return to Journal</Text>
          </Pressable>
        </View>
        {topBar()}
      </View>
    );
  }

  const authorName = blogAuthorName(post.author);
  const authorInitial = authorName.charAt(0).toUpperCase();
  const formattedDate = formatBlogDate(post.published_at ?? post.created_at, "long");
  const tags = post.tags ?? [];
  const coverUri = post.cover_image ? resolveImageUrl(post.cover_image) ?? post.cover_image : null;

  return (
    <View style={styles.container}>
      <StatusBar style={lightChrome ? "light" : "dark"} animated />

      {/* ── Parallax Hero ── */}
      {coverUri ? (
        <Animated.View
          style={[
            styles.hero,
            { height: heroH, transform: [{ translateY: heroTranslate }, { scale: heroScale }] },
          ]}
          pointerEvents="none"
        >
          <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} priority="high" />
          <LinearGradient
            colors={["rgba(12,13,8,0.55)", "rgba(12,13,8,0)"]}
            style={[styles.heroTopShade, { height: barH + 40 }]}
          />
          <LinearGradient
            colors={["rgba(12,13,8,0)", "rgba(12,13,8,0.35)"]}
            style={styles.heroBottomShade}
          />
        </Animated.View>
      ) : null}

      <Animated.ScrollView
        ref={scrollRef as never}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        onContentSizeChange={(_, h) => setContentH(h)}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[10] }}
      >
        <View style={{ height: coverUri ? heroH - SHEET_OVERLAP : barH }} />

        <View style={[styles.sheet, !coverUri && styles.sheetFlat]}>
          {coverUri ? <View style={styles.sheetHandle} /> : null}

          {/* ── Kicker ── */}
          {tags.length > 0 ? (
            <View style={styles.kickerRow}>
              <View style={styles.kickerDot} />
              <Text style={styles.kicker} numberOfLines={1}>
                {tags.slice(0, 2).join("  /  ").toUpperCase()}
              </Text>
            </View>
          ) : null}

          <Text style={styles.title}>{post.title}</Text>

          {post.excerpt ? <Text style={styles.dek}>{post.excerpt}</Text> : null}

          {/* ── Byline ── */}
          <View style={styles.byline}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{authorInitial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bylineLabel}>WORDS BY</Text>
              <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
            </View>
            <View style={styles.bylineRight}>
              {formattedDate ? <Text style={styles.dateText}>{formattedDate}</Text> : null}
              <View style={styles.readPill}>
                <Ionicons name="time-outline" size={11} color={colors.olive[800]} />
                <Text style={styles.readPillText}>{readingTime} MIN READ</Text>
              </View>
            </View>
          </View>

          {/* ── Body ── */}
          <View style={styles.body}>
            <RichBlogContent content={post.content} />
          </View>

          {/* ── End mark ── */}
          <View style={styles.endMark}>
            <View style={styles.endRule} />
            <Text style={styles.endGlyph}>❖</Text>
            <View style={styles.endRule} />
          </View>

          {/* ── Filed Under ── */}
          {tags.length > 0 ? (
            <View style={styles.filed}>
              <Text style={styles.filedLabel}>FILED UNDER</Text>
              <View style={styles.tagsWrap}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── Share Card ── */}
          <View style={styles.shareCard}>
            <LinearGradient
              colors={[colors.olive[800], colors.olive[950]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.shareKicker}>THE LUXE JOURNAL</Text>
            <Text style={styles.shareTitle}>Pass the story on.</Text>
            <Text style={styles.shareSubtitle}>
              Share it with fellow horology and fashion connoisseurs.
            </Text>
            <View style={styles.shareActions}>
              <Pressable
                style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
                onPress={handleShare}
              >
                <Ionicons name="share-social-outline" size={16} color={colors.ink.DEFAULT} style={{ marginRight: 8 }} />
                <Text style={styles.shareBtnText}>Share Story</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.85 }]}
                onPress={handleCopyLink}
              >
                <Ionicons name="link-outline" size={16} color={colors.paper.cream} style={{ marginRight: 8 }} />
                <Text style={styles.copyBtnText}>Copy Link</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── More from the Journal ── */}
        {related.length > 0 ? (
          <View style={styles.related}>
            <View style={styles.relatedHead}>
              <Text style={styles.relatedTitle}>More from the Journal</Text>
              <View style={styles.relatedRule} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={width * 0.68 + spacing[3]}
              decelerationRate="fast"
              contentContainerStyle={styles.relatedRow}
            >
              {related.map((r) => {
                const uri = r.cover_image ? resolveImageUrl(r.cover_image) ?? r.cover_image : null;
                return (
                  <Pressable
                    key={r.id}
                    style={({ pressed }) => [styles.relatedCard, { width: width * 0.68 }, pressed && { opacity: 0.9 }]}
                    onPress={() => router.push({ pathname: "/(main)/blog/[slug]", params: { slug: r.slug } })}
                  >
                    <View style={styles.relatedImageWrap}>
                      {uri ? (
                        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, styles.relatedPlaceholder]}>
                          <Ionicons name="image-outline" size={24} color={colors.olive[400]} />
                        </View>
                      )}
                    </View>
                    {r.tags?.[0] ? <Text style={styles.relatedKicker}>{r.tags[0].toUpperCase()}</Text> : null}
                    <Text style={styles.relatedCardTitle} numberOfLines={2}>{r.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.backToJournal, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={15} color={colors.ink.DEFAULT} style={{ marginRight: 8 }} />
          <Text style={styles.backToJournalText}>Back to Journal</Text>
        </Pressable>
      </Animated.ScrollView>

      {topBar(post.title)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
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
    gap: spacing[3],
  },
  topBarTint: {
    backgroundColor: "rgba(245, 244, 239, 0.78)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15.5,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.2,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.accent2.rust,
    transformOrigin: "left",
  },
  navActions: {
    flexDirection: "row",
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnGlass: {
    backgroundColor: "rgba(250, 248, 241, 0.72)",
    borderRadius: 20,
  },
  navBtnSolid: {
    backgroundColor: colors.paper.cream,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22, 23, 15, 0.14)",
  },

  // Hero
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    backgroundColor: colors.olive[900],
  },
  heroTopShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  heroBottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },

  // Sheet
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
  },
  sheetFlat: {
    paddingTop: spacing[4],
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(22, 23, 15, 0.12)",
    marginTop: -spacing[3],
    marginBottom: spacing[5],
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing[3],
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2.rust,
  },
  kicker: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.accent2.rust,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.9,
    color: colors.ink.DEFAULT,
  },
  dek: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 18,
    lineHeight: 27,
    color: colors.ink.soft,
    opacity: 0.85,
    marginTop: spacing[4],
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22, 23, 15, 0.18)",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ink.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.paper.cream,
  },
  bylineLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.ink.mute,
    marginBottom: 2,
  },
  authorName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.ink.DEFAULT,
  },
  bylineRight: {
    alignItems: "flex-end",
    gap: 5,
  },
  dateText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.ink.mute,
  },
  readPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive[200],
  },
  readPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: colors.olive[800],
  },
  body: {
    marginTop: spacing[4],
  },

  // End matter
  endMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: spacing[6],
    marginBottom: spacing[8],
  },
  endRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(22, 23, 15, 0.25)",
  },
  endGlyph: {
    fontSize: 13,
    color: colors.accent2.rust,
  },
  filed: {
    marginBottom: spacing[8],
  },
  filedLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.ink.mute,
    marginBottom: spacing[3],
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.14)",
  },
  tagText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.ink.soft,
    textTransform: "capitalize",
  },
  shareCard: {
    borderRadius: radii["3xl"],
    overflow: "hidden",
    padding: spacing[6],
  },
  shareKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent2.ochre,
    marginBottom: spacing[3],
  },
  shareTitle: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.5,
    color: colors.paper.cream,
  },
  shareSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(250, 248, 241, 0.72)",
    marginTop: spacing[2],
    marginBottom: spacing[5],
  },
  shareActions: {
    flexDirection: "row",
    gap: 10,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
  },
  shareBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.ink.DEFAULT,
  },
  copyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(250, 248, 241, 0.35)",
  },
  copyBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.paper.cream,
  },

  // Related
  related: {
    marginTop: spacing[10],
  },
  relatedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  relatedTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.ink.DEFAULT,
  },
  relatedRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(22, 23, 15, 0.25)",
  },
  relatedRow: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  relatedCard: {},
  relatedImageWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.olive[50],
  },
  relatedPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  relatedKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: colors.accent2.rust,
    marginTop: spacing[3],
  },
  relatedCardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: colors.ink.DEFAULT,
    marginTop: spacing[1.5],
  },
  backToJournal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: spacing[10],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.14)",
  },
  backToJournalText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.ink.DEFAULT,
  },

  // Empty
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing[8],
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
    fontSize: 24,
    color: colors.ink.DEFAULT,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.ink.mute,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.ink.DEFAULT,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: radii.full,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
});
