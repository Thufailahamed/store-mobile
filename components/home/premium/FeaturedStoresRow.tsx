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

const CARD_WIDTH = 232;
const CARD_HEIGHT = 312;

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
 * "Boutique posters" — big, full-bleed portrait cards, numbered like
 * catalogue plates, with the store name set large in the display serif
 * directly over the photo. Full-bleed on purpose (no white caption band)
 * so it reads as one large image, not a smaller card-with-footer shape —
 * and it's a numbered continuous scroll, not the single-focus landscape
 * paging used for FeaturedBrandsRow below it.
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
        {store.banner_url ? (
          <Image source={{ uri: store.banner_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={["transparent", "transparent", "rgba(0,0,0,0.88)"]} style={StyleSheet.absoluteFill} />

        <View style={styles.top}>
          <Text style={styles.plate}>PLATE {String(index + 1).padStart(2, "0")}</Text>
          <View style={styles.logoWrap}>
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <Text style={styles.logoInitial}>{store.name.charAt(0)}</Text>
            )}
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.name} numberOfLines={2}>
            {store.name}
          </Text>
          <View style={styles.metaRow}>
            {store.rating > 0 ? (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={11} color="#f5d76e" />
                <Text style={styles.metaText}>{store.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            {store.total_products > 0 ? (
              <Text style={styles.metaText}>{formatCount(store.total_products)} pieces</Text>
            ) : null}
            <View style={styles.visitPill}>
              <Text style={styles.visitText}>Visit</Text>
              <Ionicons name="arrow-forward" size={11} color={colors.light.foreground} />
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
    height: CARD_HEIGHT,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.olive[100],
    ...shadows.editorial,
  },
  top: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  plate: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  logoInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.primary,
  },
  bottom: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[4],
  },
  name: {
    fontFamily: fontFamilies.display.semibold,
    fontStyle: "italic",
    fontSize: 26,
    lineHeight: 30,
    color: "#ffffff",
    marginBottom: spacing[2],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing[2],
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
  visitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: "auto",
  },
  visitText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.light.foreground,
  },
});
