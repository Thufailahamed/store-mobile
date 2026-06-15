import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getBlogPostBySlug } from "@/lib/api";
import { Card, Button, Skeleton } from "@/components/ui";
import { colors, typography } from "@/lib/theme/tokens";

export default function BlogPostDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

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

  if (postQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Skeleton width="80%" height={24} />
          <Skeleton width="100%" height={16} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={16} style={{ marginTop: 8 }} />
          <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Post not found.</Text>
          <Button onPress={() => router.back()} variant="outline">
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button onPress={() => router.back()} variant="ghost" style={styles.backBtn}>
        ← Back
      </Button>

      {post.cover_image && (
        <View style={styles.coverContainer}>
          <Text style={styles.coverPlaceholder}>📷</Text>
        </View>
      )}

      <View style={styles.tags}>
        {post.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.title}>{post.title}</Text>

      <View style={styles.meta}>
        {post.author && <Text style={styles.author}>By {post.author}</Text>}
        {post.published_at && (
          <Text style={styles.date}>
            {new Date(post.published_at).toLocaleDateString("en-LK", { dateStyle: "long" })}
          </Text>
        )}
      </View>

      {post.excerpt && <Text style={styles.excerpt}>{post.excerpt}</Text>}

      <Card style={styles.contentCard}>
        <Text style={styles.body}>{post.content ?? "No content available."}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  backBtn: { alignSelf: "flex-start", marginBottom: 8 },
  coverContainer: { height: 200, backgroundColor: colors.light.muted + "20", borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  coverPlaceholder: { fontSize: 40 },
  tags: { flexDirection: "row", gap: 4, marginBottom: 16 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.light.primary + "15", borderRadius: 999 },
  tagText: { fontSize: typography.fontSizes.xs, color: colors.light.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: typography.fontSizes["3xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground, marginBottom: 16 },
  meta: { flexDirection: "row", gap: 24, marginBottom: 24 },
  author: { fontSize: typography.fontSizes.base, color: colors.light.foreground },
  date: { fontSize: typography.fontSizes.base, color: colors.light.muted },
  excerpt: { fontSize: typography.fontSizes.lg, color: colors.light.muted, lineHeight: 24, marginBottom: 24 },
  contentCard: { padding: 24 },
  body: { fontSize: typography.fontSizes.base, color: colors.light.foreground, lineHeight: 26 },
  emptyText: { fontSize: typography.fontSizes.base, color: colors.light.muted, marginBottom: 16 },
});
