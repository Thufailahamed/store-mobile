import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const CARD_WIDTH = 260;
const BANNER_HEIGHT = 120;

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
 * Store cards: banner band on top, logo + name + meta on a solid panel
 * below. Store banners are seller-uploaded wide artwork that often
 * contains its own text, so the name is never overlaid on the image.
 */
export function FeaturedStoresRow({ stores }: FeaturedStoresRowProps) {
  const router = useRouter();
  const list = useMemo(() => stores.slice(0, 10), [stores]);
  if (!list.length) return null;

  const goToStore = (s: Store) => {
    if (s.slug) {
      router.push({ pathname: "/(main)/stores/[slug]", params: { slug: s.slug, id: s.id } });
    } else {
      router.push("/(main)/products");
    }
  };

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Shop by store"
        kicker="Boutique plates"
        onPress={() => router.push("/(main)/stores")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((s, i) => (
          <StorePlate key={s.id} store={s} index={i} onPress={() => goToStore(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** Fades + slides up on mount, staggered by index, so the row reveals itself card by card instead of popping in all at once. */
function StorePlate({ store, index, onPress }: { store: Store; index: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
      delay: Math.min(index, 8) * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const gradient = gradientFor(store.name);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={onPress}>
        {/* Banner band — store banners are wide artwork (often with their own
            text), so they get their own area instead of having the name
            printed over them. */}
        <View style={styles.banner}>
          {store.banner_url ? (
            <Image source={{ uri: store.banner_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.logoWrap}>
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <Text style={styles.logoInitial}>{store.name.charAt(0)}</Text>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {store.name}
          </Text>
          <View style={styles.metaRow}>
            {store.rating > 0 ? (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={11} color={colors.accent2.ochre} />
                <Text style={styles.metaText}>{store.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            {store.rating > 0 && store.total_products > 0 ? <Text style={styles.metaText}>·</Text> : null}
            {store.total_products > 0 ? (
              <Text style={styles.metaText}>{formatCount(store.total_products)} pieces</Text>
            ) : null}
            <View style={styles.visitPill}>
              <Text style={styles.visitText}>Visit</Text>
              <Ionicons name="arrow-forward" size={11} color={colors.light.primaryForeground} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border + "99",
  },
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.olive[100],
  },
  panel: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    paddingTop: 30,
  },
  logoWrap: {
    position: "absolute",
    top: -26,
    left: spacing[4],
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.light.card,
    borderWidth: 3,
    borderColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.soft,
  },
  logo: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
  },
  logoInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.primary,
  },
  name: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.light.foreground,
    marginBottom: spacing[2],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  visitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.light.primary,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: "auto",
  },
  visitText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.light.primaryForeground,
  },
});
