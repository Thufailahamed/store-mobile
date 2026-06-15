import React from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet, Pressable, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminBlogPosts, toggleBlogPost } from "@/lib/api";
import { Card, EmptyState, Badge, Skeleton } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminBlog() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-blog"],
    queryFn: async () => {
      const r = await getAdminBlogPosts();
      return r.ok ? r.data : [];
    },
  });
  const toggleM = useMutation({ mutationFn: ({ id, status }: { id: string; status: "draft" | "published" }) => toggleBlogPost(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog"] }) });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EDITORIAL</Text>
          <Text style={styles.title}>Blog</Text>
        </View>
        <Text style={styles.count}>{(q.data ?? []).length}</Text>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(p: any) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="document-text-outline" title="No posts" />}
        renderItem={({ item, index }: any) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title2} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.author ?? "Unknown"} · {rel(item.created_at)} ago
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    item.status === "published" ? "Unpublish" : "Publish",
                    item.title,
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Confirm", onPress: () => toggleM.mutate({ id: item.id, status: item.status === "published" ? "draft" : "published" }) },
                    ]
                  )
                }
              >
                <Badge variant={item.status === "published" ? "default" : "outline"}>{item.status}</Badge>
              </Pressable>
            </View>
            {item.excerpt ? <Text style={styles.excerpt} numberOfLines={2}>{item.excerpt}</Text> : null}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  title2: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  excerpt: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 8, lineHeight: 18 },
});
