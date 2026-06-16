import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { getBlogPosts, type BlogPost } from "@/lib/api";
import { Card, Skeleton } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Blog</Text>
        <Text style={styles.subtitle}>Style guides, trends & stories</Text>
      </View>

      {postsQuery.isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={styles.postCard}>
              <Skeleton width="100%" height={160} />
              <Skeleton width="80%" height={18} style={{ marginTop: 12 }} />
              <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : posts.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 8 }}>No posts yet</Text>
          <Text style={{ fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" }}>Check back soon for style tips and brand stories.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: "/(main)/blog/[slug]", params: { slug: item.slug } })}>
              <Card style={styles.postCard}>
                {item.cover_image ? (
                  <Image
                    source={{ uri: resolveImageUrl(item.cover_image) ?? item.cover_image }}
                    style={styles.coverImage}
                    contentFit="cover"
                    transition={300}
                  />
                ) : (
                  <View style={styles.coverContainer}>
                    <Text style={styles.coverPlaceholder}>📷</Text>
                  </View>
                )}
                <View style={styles.postContent}>
                  {item.tags.length > 0 && (
                    <View style={styles.tags}>
                      {item.tags.slice(0, 3).map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
                  {item.excerpt && (
                    <Text style={styles.postExcerpt} numberOfLines={3}>{item.excerpt}</Text>
                  )}
                  <View style={styles.postMeta}>
                    {item.author && <Text style={styles.postAuthor}>By {item.author}</Text>}
                    {item.published_at && (
                      <Text style={styles.postDate}>
                        {new Date(item.published_at).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { padding: 24, paddingBottom: 0 },
  title: { fontSize: typography.fontSizes["3xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground },
  subtitle: { fontSize: typography.fontSizes.base, color: colors.light.muted, marginTop: 4 },
  list: { padding: 24 },
  postCard: { marginBottom: 24, padding: 0, overflow: "hidden" },
  coverContainer: { height: 160, backgroundColor: colors.light.muted + "20", justifyContent: "center", alignItems: "center" },
  coverImage: { width: "100%", height: 160 },
  coverPlaceholder: { fontSize: 32 },
  postContent: { padding: 24 },
  tags: { flexDirection: "row", gap: 4, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.light.primary + "15", borderRadius: radii.full },
  tagText: { fontSize: typography.fontSizes.xs, color: colors.light.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  postTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 8 },
  postExcerpt: { fontSize: typography.fontSizes.base, color: colors.light.muted, lineHeight: 22, marginBottom: 16 },
  postMeta: { flexDirection: "row", justifyContent: "space-between" },
  postAuthor: { fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  postDate: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
});
