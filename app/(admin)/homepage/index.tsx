import React from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Switch } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminHomepageSections, toggleHomepageSection } from "@/lib/api";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  hero: "image-outline",
  flash_sale: "flash-outline",
  category_grid: "grid-outline",
  trending: "flame-outline",
  editorial: "book-outline",
  testimonials: "chatbubbles-outline",
  marquee: "reorder-three-outline",
  promise: "shield-checkmark-outline",
  drops: "sparkles-outline",
  tenets: "ribbon-outline",
};

export default function AdminHomepage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-homepage"],
    queryFn: async () => {
      const r = await getAdminHomepageSections();
      return r.ok ? r.data : [];
    },
  });
  const toggleM = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleHomepageSection(id, enabled), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-homepage"] }) });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HOMEPAGE</Text>
        <Text style={styles.title}>CMS Sections</Text>
        <Text style={styles.sub}>Toggle which editorial blocks appear on the storefront.</Text>
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(s: any) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="globe-outline" title="No sections" />}
        renderItem={({ item, index }: any) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.index}>{String(item.position ?? index + 1).padStart(2, "0")}</Text>
              <View style={styles.iconWrap}>
                <Ionicons name={ICONS[item.key] ?? "square-outline"} size={18} color={colors.light.foreground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.title}</Text>
                <Text style={styles.meta}>{item.key} · position {item.position}</Text>
              </View>
              <Switch
                value={item.enabled}
                onValueChange={(v) => toggleM.mutate({ id: item.id, enabled: v })}
                trackColor={{ true: colors.olive[500], false: colors.light.border }}
                thumbColor={colors.light.card}
              />
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { padding: 20, paddingBottom: 8 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.light.accent + "55", alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" },
});
