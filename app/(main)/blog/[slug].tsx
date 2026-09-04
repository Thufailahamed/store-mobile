import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@/components/ui/Icon";
import { getBlogPostBySlug } from "@/lib/api";
import { Skeleton, useToast } from "@/components/ui";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { RichBlogContent } from "@/components/blog/RichBlogContent";

export default function BlogPostDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const postQuery = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      if (!slug) return null;
      const res = await getBlogPostBySlug(slug);
      return res.ok ? res.data : null;
    },
    enabled: !!slug,
  });

  const post = postQuery.data;

  // Calculate estimated reading time
  const readingTime = useMemo(() => {
    if (!post?.content) return 3;
    const words = post.content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [post?.content]);

  // Handle native share sheet
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

  // Handle copy link to clipboard
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

  if (postQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={() => router.back()}
            hitSlop={12}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color={colors.ink.DEFAULT} />
          </TouchableOpacity>
          <View style={styles.navJournalBadge}>
            <Ionicons name="newspaper-outline" size={12} color={colors.olive[700]} />
            <Text style={styles.navJournalText}>THE LUXE JOURNAL</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Skeleton width="100%" height={240} style={{ borderRadius: radii.xl }} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
            <Skeleton width={80} height={24} style={{ borderRadius: radii.full }} />
            <Skeleton width={100} height={24} style={{ borderRadius: radii.full }} />
          </View>
          <Skeleton width="90%" height={32} style={{ marginTop: 16 }} />
          <Skeleton width="70%" height={32} style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={16} style={{ marginTop: 24 }} />
          <Skeleton width="100%" height={16} style={{ marginTop: 8 }} />
          <Skeleton width="80%" height={16} style={{ marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <Ionicons name="book-outline" size={48} color={colors.ink.mute} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Story Not Found</Text>
          <Text style={styles.emptyText}>
            The editorial piece you are looking for may have been archived or moved.
          </Text>
          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.returnBtnText}>Return to Journal</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const authorName = post.author || "LUXE Editorial";
  const authorInitial = authorName.charAt(0).toUpperCase();

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Top Editorial Navigation Bar ── */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink.DEFAULT} />
        </TouchableOpacity>

        <View style={styles.navJournalBadge}>
          <Ionicons name="newspaper-outline" size={12} color={colors.olive[700]} />
          <Text style={styles.navJournalText}>THE LUXE JOURNAL</Text>
        </View>

        <View style={styles.navActions}>
          <TouchableOpacity
            style={styles.navActionBtn}
            onPress={handleCopyLink}
            hitSlop={10}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={17} color={colors.ink.DEFAULT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navActionBtn}
            onPress={handleShare}
            hitSlop={10}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color={colors.ink.DEFAULT} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero Cover Image ── */}
        {post.cover_image ? (
          <View style={styles.coverImageWrap}>
            <Image
              source={{ uri: resolveImageUrl(post.cover_image) ?? post.cover_image }}
              style={styles.coverImage}
              contentFit="cover"
              transition={300}
              priority="high"
            />
          </View>
        ) : null}

        {/* ── Editorial Tags ── */}
        {(post.tags ?? []).length > 0 ? (
          <View style={styles.tagsRow}>
            {post.tags!.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Story Title ── */}
        <Text style={styles.title}>{post.title}</Text>

        {/* ── Author Byline & Reading Metadata ── */}
        <View style={styles.bylineCard}>
          <View style={styles.authorAvatar}>
            <Text style={styles.authorAvatarText}>{authorInitial}</Text>
          </View>
          <View style={styles.bylineMeta}>
            <Text style={styles.authorName}>By {authorName}</Text>
            <View style={styles.subMetaRow}>
              {formattedDate ? <Text style={styles.dateText}>{formattedDate}</Text> : null}
              {formattedDate ? <Text style={styles.metaDot}>•</Text> : null}
              <View style={styles.readTimeRow}>
                <Ionicons name="time-outline" size={11} color={colors.ink.mute} style={{ marginRight: 3 }} />
                <Text style={styles.readTimeText}>{readingTime} min read</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.hairlineDivider} />

        {/* ── Excerpt (The Dek / Lead Intro) ── */}
        {post.excerpt ? (
          <View style={styles.excerptContainer}>
            <Text style={styles.excerptText}>{post.excerpt}</Text>
          </View>
        ) : null}

        {/* ── Rich Markdown Article Content ── */}
        <View style={styles.bodyWrapper}>
          <RichBlogContent content={post.content} />
        </View>

        {/* ── Story Footer & Share Section ── */}
        <View style={styles.footerSection}>
          <View style={styles.asterism}>
            <Text style={styles.asterismText}>❖   THE LUXE JOURNAL   ❖</Text>
          </View>

          <View style={styles.shareBanner}>
            <Text style={styles.shareTitle}>Enjoyed this story?</Text>
            <Text style={styles.shareSubtitle}>
              Share it with fellow horology and fashion connoisseurs.
            </Text>
            <View style={styles.shareActions}>
              <TouchableOpacity
                style={styles.sharePillBtn}
                onPress={handleShare}
                activeOpacity={0.85}
              >
                <Ionicons name="share-social-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.sharePillText}>Share Story</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.copyPillBtn}
                onPress={handleCopyLink}
                activeOpacity={0.85}
              >
                <Ionicons name="link-outline" size={16} color={colors.ink.DEFAULT} style={{ marginRight: 6 }} />
                <Text style={styles.copyPillText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.backToJournalBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={15} color={colors.olive[800]} style={{ marginRight: 6 }} />
            <Text style={styles.backToJournalText}>Back to Journal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 200, 184, 0.35)",
    backgroundColor: colors.light.background,
  },
  navBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  navJournalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(83, 94, 44, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    gap: 5,
  },
  navJournalText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.olive[800],
    textTransform: "uppercase",
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[12],
  },
  coverImageWrap: {
    width: "100%",
    height: 240,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    marginBottom: spacing[4],
    backgroundColor: colors.olive[50],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing[2.5],
  },
  tagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: "rgba(83, 94, 44, 0.09)",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.16)",
  },
  tagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[800],
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    lineHeight: 34,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.2,
    marginBottom: spacing[3.5],
  },
  bylineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(83, 94, 44, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.olive[900],
  },
  bylineMeta: {
    flex: 1,
  },
  authorName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.ink.DEFAULT,
  },
  subMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  dateText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
  },
  metaDot: {
    fontSize: 12,
    color: colors.ink.mute,
  },
  readTimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  readTimeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11.5,
    color: colors.ink.mute,
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: "rgba(200, 200, 184, 0.45)",
    marginVertical: spacing[4],
  },
  excerptContainer: {
    borderLeftWidth: 2.5,
    borderLeftColor: colors.accent2.rust,
    paddingLeft: spacing[3.5],
    marginBottom: spacing[5],
  },
  excerptText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 16.5,
    lineHeight: 26,
    color: colors.ink.soft,
  },
  bodyWrapper: {
    width: "100%",
  },
  footerSection: {
    marginTop: spacing[8],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 200, 184, 0.45)",
  },
  asterism: {
    alignItems: "center",
    marginVertical: spacing[5],
  },
  asterismText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.olive[600],
    opacity: 0.75,
  },
  shareBanner: {
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.45)",
    borderRadius: radii.xl,
    padding: spacing[5],
    alignItems: "center",
    marginBottom: spacing[6],
  },
  shareTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.ink.DEFAULT,
    marginBottom: 4,
  },
  shareSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.ink.mute,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  shareActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  sharePillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent2.rust,
    paddingVertical: 10,
    borderRadius: radii.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
    elevation: 2,
  },
  sharePillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: "#ffffff",
  },
  copyPillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.6)",
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  copyPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.ink.DEFAULT,
  },
  backToJournalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: "rgba(83, 94, 44, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.15)",
  },
  backToJournalText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.olive[800],
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing[6],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.ink.DEFAULT,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.ink.mute,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  returnBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.olive[700],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  returnBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#ffffff",
  },
});
