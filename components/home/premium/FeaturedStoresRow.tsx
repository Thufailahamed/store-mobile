import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const CARD_HEIGHT = 268;

const GRADIENTS: [string, string][] = [
  [colors.olive[700], colors.olive[950]],
  ["#3f4a2e", "#1f2414"],
  ["#4a3f2e", "#241f14"],
  ["#2e3f4a", "#141f24"],
];

function gradientFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return value.toLocaleString();
}

interface FeaturedStoresRowProps {
  stores: Store[];
}

/**
 * A full-bleed, one-slide-at-a-time carousel — swipe through boutiques with
 * dot pagination, mirroring the hero PromoCarousel's pattern instead of the
 * card-row/directory-list shapes used elsewhere on Home.
 */
export function FeaturedStoresRow({ stores }: FeaturedStoresRowProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const CARD_WIDTH = screenWidth - spacing[5] * 2;
  const list = stores.slice(0, 8);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-advance every 5s; resets on every change to `active` — including a
  // manual swipe, which updates `active` via onScrollEnd below — so the
  // countdown restarts from wherever the user leaves it instead of fighting
  // their gesture.
  useEffect(() => {
    if (list.length <= 1) return;
    const timer = setTimeout(() => {
      const next = (active + 1) % list.length;
      scrollRef.current?.scrollTo({ x: next * (CARD_WIDTH + spacing[3]), animated: true });
      setActive(next);
    }, 5000);
    return () => clearTimeout(timer);
  }, [active, list.length, CARD_WIDTH]);

  if (!list.length) return null;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + spacing[3]));
    setActive(Math.min(Math.max(i, 0), list.length - 1));
  };

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Shop by store"
        kicker="Boutique spotlight"
        onPress={() => router.push("/(main)/stores")}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + spacing[3]}
        decelerationRate="fast"
        contentContainerStyle={styles.scroll}
        onMomentumScrollEnd={onScrollEnd}
      >
        {list.map((s) => {
          const gradient = gradientFor(s.name);
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.card, { width: CARD_WIDTH }]}
              activeOpacity={0.9}
              onPress={() => {
                if (s.slug) {
                  router.push({
                    pathname: "/(main)/stores/[slug]",
                    params: { slug: s.slug, id: s.id },
                  });
                } else {
                  router.push("/(main)/products");
                }
              }}
            >
              {s.banner_url ? (
                <Image source={{ uri: s.banner_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.78)"]} style={styles.overlay} />

              <View style={styles.cardTop}>
                <Text style={styles.tag}>BOUTIQUE</Text>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.logoWrap}>
                  {s.logo_url ? (
                    <Image source={{ uri: s.logo_url }} style={styles.logo} contentFit="cover" />
                  ) : (
                    <Text style={styles.logoInitial}>{s.name.charAt(0)}</Text>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                </Text>
                <View style={styles.metaRow}>
                  {s.rating > 0 ? (
                    <View style={styles.metaItem}>
                      <Ionicons name="star" size={11} color="#f5d76e" />
                      <Text style={styles.metaText}>{s.rating.toFixed(1)}</Text>
                    </View>
                  ) : null}
                  {s.total_products > 0 ? (
                    <Text style={styles.metaText}>{formatCount(s.total_products)} pieces</Text>
                  ) : null}
                  {s.total_followers > 0 ? (
                    <Text style={styles.metaText}>{formatCount(s.total_followers)} followers</Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {list.length > 1 ? (
        <View style={styles.dots}>
          {list.map((s, i) => (
            <View key={s.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.olive[100],
    ...shadows.editorial,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "72%",
  },
  cardTop: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
  },
  tag: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.85)",
  },
  cardBottom: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[4],
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing[2],
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  logoInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.primary,
  },
  name: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing[3],
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[3],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.light.primary,
  },
});
