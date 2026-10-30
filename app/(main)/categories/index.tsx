import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import {
  EmptyCard,
  HeaderButton,
  SectionHead,
  UserPageFrame,
  userTheme,
} from "@/components/user/user-page";
import { C } from "@/components/orders/parcel-track";
import { getAllCategories } from "@/lib/api";
import { useTrackEvent } from "@/lib/recommender";
import type { Category } from "@/lib/types";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii } from "@/lib/theme/tokens";
import { Skeleton } from "@/components/ui/Skeleton";

const BANNER_HEIGHT = 208;

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

  const collectionCount = useMemo(
    () => sortedParents.reduce((sum, p) => sum + (childrenByParent.get(p.id)?.length ?? 0), 0),
    [sortedParents, childrenByParent],
  );

  return (
    <UserPageFrame
      title="Departments"
      right={
        <HeaderButton
          icon="search"
          label="Search"
          onPress={() => router.push("/(main)/search" as never)}
        />
      }
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={C.accent}
          />
        }
      >
        {/* Summary strip, same dark block as the profile stats */}
        <View style={styles.statsStrip}>
          <Stat
            value={loading ? "–" : String(sortedParents.length).padStart(2, "0")}
            label="Departments"
          />
          <View style={styles.statDivider} />
          <Stat
            value={loading ? "–" : String(collectionCount).padStart(2, "0")}
            label="Collections"
          />
          <View style={styles.statDivider} />
          <Stat value="Weekly" label="Curated" small />
        </View>

        <Text style={styles.intro}>
          Tap a department to see everything, or jump straight into a collection.
        </Text>

        <SectionHead kicker="The index" title="Shop by department" />

        {sortedParents.length === 0 && !loading ? (
          <EmptyCard
            icon="grid-outline"
            title="No departments yet"
            sub="Admins can add categories from the catalogue manager."
          />
        ) : null}

        {loading ? (
          <View style={styles.grid}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[userTheme.card, styles.card]}>
                <Skeleton width="100%" height={BANNER_HEIGHT} borderRadius={0} />
                <View style={styles.skeletonLinks}>
                  <Skeleton width={92} height={14} borderRadius={radii.full} />
                  <Skeleton width={70} height={14} borderRadius={radii.full} />
                  <Skeleton width={80} height={14} borderRadius={radii.full} />
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
            <Text style={styles.endmarkLabel}>END OF INDEX</Text>
            <View style={styles.endmarkRule} />
          </View>
        ) : null}
      </ScrollView>
    </UserPageFrame>
  );
}

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statNum, small && styles.statNumSmall]}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
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
    <Animated.View style={[userTheme.card, styles.card, { opacity: anim, transform: [{ translateY }] }]}>
      <Pressable
        onPress={() => onNavigate(cat.slug)}
        accessibilityRole="button"
        accessibilityLabel={`Shop ${cat.name}`}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
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
            colors={[C.accent, C.ink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.bannerFallback]}
          >
            <Ionicons name="grid-outline" size={40} color="rgba(250,248,241,0.35)" />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["rgba(22,23,15,0.18)", "rgba(22,23,15,0)", "rgba(22,23,15,0.6)", "rgba(22,23,15,0.9)"]}
          locations={[0, 0.35, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.bannerTop}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>Nº {String(index + 1).padStart(2, "0")}</Text>
          </View>
          {collections.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {String(collections.length).padStart(2, "0")} {collections.length === 1 ? "LINE" : "LINES"}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bannerFooter}>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {cat.name}
            </Text>
            <Text style={styles.bannerMeta} numberOfLines={1}>
              {cat.description
                ? cat.description
                : collections.length > 0
                  ? `${collections.length} ${collections.length === 1 ? "collection" : "collections"}`
                  : "Shop the edit"}
            </Text>
          </View>
          <View style={styles.arrowButton}>
            <Ionicons name="arrow-forward" size={18} color={C.ink} />
          </View>
        </View>
      </Pressable>

      {collections.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.linkRow}
          style={styles.linkStrip}
        >
          <Pressable
            onPress={() => onNavigate(cat.slug)}
            style={({ pressed }) => [styles.shopAll, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Shop all ${cat.name}`}
          >
            <Text style={styles.shopAllText}>Shop all</Text>
            <Ionicons name="arrow-forward" size={12} color={C.lime} />
          </Pressable>
          {collections.map((ch) => (
            <Pressable
              key={ch.id}
              onPress={() => onNavigate(ch.slug)}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${cat.name} ${ch.name}`}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={styles.chipText}>{ch.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: C.ink,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statNum: { fontFamily: fontFamilies.sans.bold, fontSize: 24, letterSpacing: -0.6, color: C.cream },
  statNumSmall: { fontSize: 18, color: C.lime },
  statLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 1.4, color: "rgba(250,248,241,0.55)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },

  intro: {
    marginTop: 14,
    paddingHorizontal: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
  },

  grid: { gap: 16 },
  card: { borderRadius: 26, overflow: "hidden" },
  pressed: { opacity: 0.85 },

  banner: {
    height: BANNER_HEIGHT,
    justifyContent: "space-between",
    backgroundColor: C.glow,
  },
  bannerFallback: { alignItems: "center", justifyContent: "center" },
  bannerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  indexBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(250,248,241,0.94)",
  },
  indexText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1, color: C.ink },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: C.ink,
  },
  countText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.2, color: C.lime },

  bannerFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    padding: 16,
  },
  bannerTextWrap: { flex: 1, gap: 4 },
  bannerTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: C.cream,
  },
  bannerMeta: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: "rgba(250,248,241,0.8)",
  },
  arrowButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },

  linkStrip: {
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  linkRow: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shopAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: C.ink,
  },
  shopAllText: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5, color: C.cream },
  chip: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.text },

  skeletonLinks: {
    flexDirection: "row",
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },

  endmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
  },
  endmarkRule: { flex: 1, height: 1, backgroundColor: C.line },
  endmarkLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 2,
    color: C.muted,
  },
});
