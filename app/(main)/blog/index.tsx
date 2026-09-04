import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { getBlogPosts, type BlogPost } from "@/lib/api";
import { Skeleton } from "@/components/ui";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";

export default function BlogScreen() {
  const router = useRouter();

  const postsQuery = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const res = await getBlogPosts();
      return res.ok ? res.data : [];
    },
  });

  const posts = postsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Editorial Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={12}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color={colors.ink.DEFAULT} />
          </TouchableOpacity>
          <View style={styles.badge}>
            <Ionicons name="newspaper-outline" size={12} color={colors.olive[700]} />
            <Text style={styles.badgeText}>THE LUXE JOURNAL</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <Text style={styles.title}>Editorial & Stories</Text>
        <Text style={styles.subtitle}>
          Curated chronicles of horology, craftsmanship, textiles & ateliers
        </Text>
      </View>

      {postsQuery.isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton width="100%" height={180} style={{ borderRadius: radii.xl }} />
              <View style={{ padding: spacing[4] }}>
                <Skeleton width="40%" height={16} style={{ borderRadius: radii.full, marginBottom: 8 }} />
                <Skeleton width="85%" height={22} style={{ marginBottom: 8 }} />
                <Skeleton width="65%" height={16} />
              </View>
            </View>
          ))}
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={44} color={colors.ink.mute} style={{ marginBottom: 14 }} />
          <Text style={styles.emptyTitle}>No Stories Yet</Text>
          <Text style={styles.emptySubtitle}>
            Our editorial desk is crafting upcoming pieces. Check back soon.
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() =>
                router.push({
                  pathname: "/(main)/blog/[slug]",
                  params: { slug: item.slug },
                })
              }
              style={styles.postCard}
            >
              {item.cover_image ? (
                <View style={styles.coverImageWrap}>
                  <Image
                    source={{ uri: resolveImageUrl(item.cover_image) ?? item.cover_image }}
                    style={styles.coverImage}
                    contentFit="cover"
                    transition={300}
                  />
                </View>
              ) : (
                <View style={styles.coverPlaceholderWrap}>
                  <Ionicons name="image-outline" size={32} color={colors.ink.mute} />
                </View>
              )}

              <View style={styles.postContent}>
                {(item.tags ?? []).length > 0 && (
                  <View style={styles.tagsRow}>
                    {(item.tags ?? []).slice(0, 3).map((tag) => (
                      <View key={tag} style={styles.tagPill}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.postTitle} numberOfLines={2}>
                  {item.title}
                </Text>

                {item.excerpt && (
                  <Text style={styles.postExcerpt} numberOfLines={2}>
                    {item.excerpt}
                  </Text>
                )}

                <View style={styles.postMeta}>
                  <Text style={styles.postAuthor}>By {item.author || "LUXE Editorial"}</Text>
                  {item.published_at && (
                    <Text style={styles.postDate}>
                      {new Date(item.published_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 200, 184, 0.35)",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  backBtn: {
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
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(83, 94, 44, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    gap: 5,
  },
  badgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.olive[800],
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    lineHeight: 33,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.ink.mute,
    lineHeight: 19,
  },
  list: {
    padding: spacing[4],
    paddingBottom: spacing[12],
  },
  postCard: {
    marginBottom: spacing[5],
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.45)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  skeletonCard: {
    marginBottom: spacing[5],
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.35)",
    overflow: "hidden",
  },
  coverImageWrap: {
    width: "100%",
    height: 180,
    backgroundColor: colors.olive[50],
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholderWrap: {
    width: "100%",
    height: 140,
    backgroundColor: "rgba(83, 94, 44, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  postContent: {
    padding: spacing[4],
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing[2],
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    backgroundColor: "rgba(83, 94, 44, 0.09)",
    borderRadius: radii.full,
  },
  tagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: colors.olive[800],
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  postTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  postExcerpt: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.ink.soft,
    lineHeight: 20,
    marginBottom: 14,
  },
  postMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 200, 184, 0.35)",
    paddingTop: 10,
  },
  postAuthor: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.ink.DEFAULT,
  },
  postDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing[8],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
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
