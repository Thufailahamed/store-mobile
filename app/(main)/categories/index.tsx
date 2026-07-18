import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { AppHeader, PaperBackground } from "@/components/layout";
import { Body, Display, Label } from "@/components/ui/Typography";
import { getAllCategories } from "@/lib/api";
import { useTrackEvent } from "@/lib/recommender";
import type { Category } from "@/lib/types";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Skeleton } from "@/components/ui/Skeleton";

export default function CategoriesDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tracker = useTrackEvent();
  const [all, setAll] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Screen-view: fire once on mount.
  useEffect(() => {
    tracker.screen("categories_directory");
  }, []);

  const load = async () => {
    const res = await getAllCategories();
    if (res.ok) setAll(res.data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const { parents, childrenByParent } = useMemo(() => {
    const parents: Category[] = [];
    const childrenByParent = new Map<string, Category[]>();
    for (const c of all) {
      if (!c.parent_id) {
        parents.push(c);
      } else {
        const list = childrenByParent.get(c.parent_id) ?? [];
        list.push(c);
        childrenByParent.set(c.parent_id, list);
      }
    }
    return { parents, childrenByParent };
  }, [all]);

  const navigate = (slug: string) => {
    tracker.action("category_clicked", { categorySlug: slug });
    router.push({ pathname: "/(main)/products", params: { category: slug } } as never);
  };

  return (
    <PaperBackground>
      <AppHeader showSearch />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        <View style={styles.hero}>
          <Label style={styles.kicker}>BROWSE</Label>
          <Display size="2xl" style={styles.title}>
            All categories
          </Display>
          <Body muted style={styles.subtitle}>
            Pick a corner of the catalogue. Each tile leads to live inventory.
          </Body>
        </View>

        {parents.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={28} color={colors.light.mutedForeground} />
            <Display size="md" style={styles.emptyTitle}>
              No categories yet
            </Display>
            <Body muted size="sm" style={styles.emptyCopy}>
              Admins can add categories from the catalogue manager.
            </Body>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHead}>
                  <Skeleton width={56} height={56} borderRadius={radii.lg} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="60%" height={14} />
                    <Skeleton width="85%" height={12} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
        <View style={styles.grid}>
          {parents.map((cat) => {
            const children = childrenByParent.get(cat.id) ?? [];
            return (
              <View key={cat.id} style={styles.card}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigate(cat.slug)}
                  style={styles.cardHead}
                >
                  {cat.image_url ? (
                    <Image
                      source={{ uri: resolveImageUrl(cat.image_url) ?? cat.image_url }}
                      style={styles.cardImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.cardImage, styles.cardImageFallback]}>
                      <Ionicons name="grid-outline" size={22} color={colors.light.mutedForeground} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body size="sm" style={styles.cardName} numberOfLines={1}>
                      {cat.name}
                    </Body>
                    {cat.description ? (
                      <Body muted size="xs" numberOfLines={2}>
                        {cat.description}
                      </Body>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
                </TouchableOpacity>
                {children.length > 0 ? (
                  <View style={styles.chipRow}>
                    {children.map((ch) => (
                      <TouchableOpacity
                        key={ch.id}
                        style={styles.chip}
                        onPress={() => navigate(ch.slug)}
                        activeOpacity={0.85}
                      >
                        <Label style={styles.chipText}>{ch.name}</Label>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: spacing[2] },
  hero: { gap: 4, paddingBottom: spacing[4] },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: { lineHeight: 32 },
  subtitle: { marginTop: 2 },
  grid: { gap: spacing[3] },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
  },
  cardImageFallback: { alignItems: "center", justifyContent: "center" },
  cardName: { fontFamily: fontFamilies.sans.semibold },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing[3],
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  chipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
    letterSpacing: 0.4,
  },
  empty: {
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[8],
  },
  emptyTitle: { fontSize: typography.fontSizes.lg },
  emptyCopy: { textAlign: "center" },
});
