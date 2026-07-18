import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { getBlogPostBySlug } from "@/lib/api";
import { Card, Button, Skeleton } from "@/components/ui";
import { colors, typography } from "@/lib/theme/tokens";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";

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
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <Skeleton width="80%" height={24} />
          <Skeleton width="100%" height={16} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={16} style={{ marginTop: 8 }} />
          <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Post not found.</Text>
          <Button onPress={() => router.back()} variant="outline">
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button onPress={() => router.back()} variant="ghost" style={styles.backBtn}>
          ← Back
        </Button>

      {post.cover_image && (
        <Image
          source={{ uri: resolveImageUrl(post.cover_image) ?? post.cover_image }}
          style={styles.coverImage}
          contentFit="cover"
          transition={300}
        />
      )}

      <View style={styles.tags}>
        {(post.tags ?? []).map((tag) => (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  backBtn: { alignSelf: "flex-start", marginBottom: 8 },
  coverImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 24 },
  tags: { flexDirection: "row", gap: 4, marginBottom: 16 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.light.primary + "15", borderRadius: 999 },
  tagText: { fontSize: typography.fontSizes.xs, color: colors.light.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: typography.fontSizes["3xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground, marginBottom: 16 },
  meta: { flexDirection: "row", gap: 24, marginBottom: 24 },
  author: { fontSize: typography.fontSizes.base, color: colors.light.foreground },
  date: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },
  excerpt: { fontSize: typography.fontSizes.lg, color: colors.light.mutedForeground, lineHeight: 24, marginBottom: 24 },
  contentCard: { padding: 24 },
  body: { fontSize: typography.fontSizes.base, color: colors.light.foreground, lineHeight: 26 },
  emptyText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground, marginBottom: 16 },
});
