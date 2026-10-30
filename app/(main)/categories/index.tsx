import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

  const sortedParents = useMemo(
    () => [...parents].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [parents],
  );

  return (
    <PaperBackground>
      <AppHeader showSearch showBackToHome />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Label style={styles.kicker}>
              BROWSE{!loading && sortedParents.length > 0
                ? ` · ${String(sortedParents.length).padStart(2, "0")} DEPARTMENTS`
                : ""}
            </Label>
            <View style={{ flex: 1 }} />
            <Label style={styles.kickerMeta}>THE INDEX</Label>
          </View>
          <Display size="5xl" style={styles.title}>
            Shop by
          </Display>
          <Display size="5xl" italic style={[styles.title, styles.titleAccent]}>
            department.
          </Display>
          <Body muted size="sm" style={styles.subtitle}>
            Tap a department to see everything, or jump straight into a collection.
          </Body>
        </View>

        {sortedParents.length === 0 && !loading ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="grid-outline" size={24} color={colors.olive[700]} />
            </View>
            <Display size="lg" style={styles.emptyTitle}>
              No categories yet
            </Display>
            <Body muted size="sm" style={styles.emptyCopy}>
              Admins can add categories from the catalogue manager.
            </Body>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.grid}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.card}>
                <Skeleton width="100%" height={BANNER_HEIGHT} borderRadius={0} />
                <View style={styles.skeletonLinks}>
                  <Skeleton width={92} height={12} borderRadius={radii.full} />
                  <Skeleton width={70} height={12} borderRadius={radii.full} />
                  <Skeleton width={80} height={12} borderRadius={radii.full} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {sortedParents.map((cat, index) => (
              <DepartmentCard
                key={cat.id}
                cat={cat}
                index={index}
                collections={childrenByParent.get(cat.id) ?? []}
                onNavigate={navigate}
              />
            ))}
          </View>
        )}

        {!loading && sortedParents.length > 0 ? (
          <View style={styles.endmark}>
            <View style={styles.endmarkRule} />
            <Label style={styles.endmarkLabel}>END OF INDEX</Label>
            <View style={styles.endmarkRule} />
          </View>
        ) : null}
      </ScrollView>
    </PaperBackground>
  );
}

function DepartmentCard({
  cat,
  index,
  collections,
  onNavigate,
}: {
  cat: Category;
  index: number;
  collections: Category[];
  onNavigate: (slug: string) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 520,
      delay: 70 + index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const imageUri = cat.image_url ? resolveImageUrl(cat.image_url) ?? cat.image_url : null;

  return (
    <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY }] }]}>
      <Pressable
        onPress={() => onNavigate(cat.slug)}
        accessibilityRole="button"
        accessibilityLabel={`Shop ${cat.name}`}
        style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <LinearGradient
            colors={[colors.olive[500], colors.olive[800]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.bannerFallback]}
          >
            <Ionicons name="grid-outline" size={40} color="rgba(250,248,241,0.35)" />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["rgba(13,14,10,0.22)", "rgba(13,14,10,0)", "rgba(13,14,10,0.55)", "rgba(13,14,10,0.88)"]}
          locations={[0, 0.35, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bannerTop}>
          <View style={styles.indexBadge}>
            <Label style={styles.indexText}>Nº {String(index + 1).padStart(2, "0")}</Label>
          </View>
          {collections.length > 0 ? (
            <Label style={styles.bannerCount}>
              {String(collections.length).padStart(2, "0")} {collections.length === 1 ? "LINE" : "LINES"}
            </Label>
          ) : null}
        </View>
        <View style={styles.bannerFooter}>
          <View style={{ flex: 1, gap: 6 }}>
            <Display size="4xl" style={styles.bannerTitle} numberOfLines={1}>
              {cat.name}
            </Display>
            <View style={styles.bannerMetaRow}>
              <View style={styles.bannerMetaRule} />
              <Label style={styles.bannerMeta} numberOfLines={1}>
                {cat.description
                  ? cat.description
                  : collections.length > 0
                    ? `${collections.length} ${collections.length === 1 ? "COLLECTION" : "COLLECTIONS"}`
                    : "SHOP THE EDIT"}
              </Label>
            </View>
          </View>
          <View style={styles.arrowButton}>
            <Ionicons name="arrow-forward" size={18} color={colors.ink.DEFAULT} />
          </View>
        </View>
      </Pressable>

      {collections.length > 0 ? (
        <View style={styles.linkStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.linkRow}
          >
            <Pressable
              onPress={() => onNavigate(cat.slug)}
              style={({ pressed }) => [styles.shopAll, pressed && styles.linkPressed]}
            >
              <Label style={styles.shopAllText}>SHOP ALL</Label>
              <Ionicons name="arrow-forward" size={11} color={colors.ink.DEFAULT} />
            </Pressable>
            {collections.map((ch) => (
              <React.Fragment key={ch.id}>
                <View style={styles.linkDivider} />
                <Pressable
                  onPress={() => onNavigate(ch.slug)}
                  accessibilityRole="button"
                  accessibilityLabel={`Shop ${cat.name} ${ch.name}`}
                  style={({ pressed }) => [pressed && styles.linkPressed]}
                >
                  <Label style={styles.linkText}>{ch.name}</Label>
                </Pressable>
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Animated.View>
  );
}

const BANNER_HEIGHT = 216;

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: spacing[4] },
  hero: { gap: spacing[2], paddingBottom: spacing[7] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  kickerRule: { width: 20, height: 1, backgroundColor: colors.light.primary },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.6,
  },
  kickerMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 1.6,
  },
  title: { lineHeight: 52, color: colors.ink.DEFAULT },
  titleAccent: { color: colors.olive[600] },
  subtitle: { maxWidth: 300, lineHeight: 20, marginTop: spacing[1] },
  grid: { gap: spacing[6] },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["3xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.editorial,
  },
  banner: {
    height: BANNER_HEIGHT,
    justifyContent: "flex-end",
    backgroundColor: colors.olive[100],
  },
  bannerPressed: { opacity: 0.94 },
  bannerFallback: { alignItems: "center", justifyContent: "center" },
  bannerTop: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  indexBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.9)",
  },
  indexText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.ink.DEFAULT,
  },
  bannerCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: "rgba(250,248,241,0.9)",
  },
  bannerFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[3],
    padding: spacing[4],
  },
  bannerTitle: {
    color: colors.paper.cream,
    lineHeight: 40,
  },
  bannerMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bannerMetaRule: {
    width: 14,
    height: 1,
    backgroundColor: "rgba(250,248,241,0.55)",
  },
  bannerMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "rgba(250,248,241,0.85)",
  },
  arrowButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  linkStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  linkRow: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
  },
  shopAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shopAllText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.ink.DEFAULT,
  },
  linkDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.light.border,
  },
  linkText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.ink.mute,
  },
  linkPressed: { opacity: 0.55 },
  skeletonLinks: {
    flexDirection: "row",
    gap: 12,
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  endmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginTop: spacing[8],
  },
  endmarkRule: { flex: 1, height: 1, backgroundColor: colors.light.border },
  endmarkLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.ink.mute,
  },
  empty: {
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[8],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[1],
  },
  emptyTitle: { fontSize: typography.fontSizes.lg },
  emptyCopy: { textAlign: "center" },
});
