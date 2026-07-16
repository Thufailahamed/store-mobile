import React, { useRef, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Text,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Banner } from "@/lib/types";

const CARD_HEIGHT = 440;

interface PromoCarouselProps {
  banners: Banner[];
}

/**
 * Full-bleed editorial hero — a magazine cover spread rather than a
 * split copy/image tile, so it reads as the page's "feature story"
 * instead of one more product card.
 */
export function PromoCarousel({ banners }: PromoCarouselProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const CARD_WIDTH = screenWidth - spacing[5] * 2;
  const list = banners.length ? banners : FALLBACK_PROMOS;
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + spacing[3]));
    setActive(i);
  };

  const handleCta = (banner: Banner) => {
    if (banner.link) {
      router.push(banner.link as any);
      return;
    }
    router.push("/(main)/products");
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + spacing[3]}
        decelerationRate="fast"
        contentContainerStyle={styles.scroll}
        onMomentumScrollEnd={onScrollEnd}
      >
        {list.map((b, i) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.card, { width: CARD_WIDTH }]}
            activeOpacity={0.92}
            onPress={() => handleCta(b)}
          >
            <Text style={styles.eyebrow}>ISSUE No {String(i + 1).padStart(2, "0")} — FEATURED STORY</Text>
            {b.image_url ? (
              <Image source={{ uri: b.image_url }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={styles.imagePlaceholder} />
            )}
            <LinearGradient
              colors={["transparent", "rgba(10,9,8,0.15)", "rgba(10,9,8,0.88)"]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.copy}>
              <Text style={styles.brand} numberOfLines={1}>
                {b.title}
              </Text>
              <Text style={styles.headline} numberOfLines={2}>
                {b.subtitle || "Curated pieces, delivered with care"}
              </Text>
            </View>
            <View style={styles.ctaStamp}>
              <View style={styles.ctaDot} />
              <Text style={styles.ctaText}>{b.cta_text || "Shop now"}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {list.length > 1 ? (
        <View style={styles.dots}>
          {list.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const FALLBACK_PROMOS: Banner[] = [
  {
    id: "fallback-1",
    title: "LUXE Edit",
    subtitle: "Up to 50% off selected styles",
    image_url: "",
    position: "home_hero",
    display_order: 0,
    is_active: true,
    cta_text: "Shop now",
    bg_color: "#f0e8c8",
  },
];

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.olive[200],
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.olive[200],
  },
  eyebrow: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
    zIndex: 2,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.light.card,
    backgroundColor: "rgba(22,23,15,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  copy: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[7],
    gap: 4,
  },
  brand: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: "#e3ded0",
  },
  headline: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.light.card,
    letterSpacing: -0.2,
  },
  ctaStamp: {
    position: "absolute",
    left: spacing[4],
    bottom: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    transform: [{ rotate: "-2deg" }],
  },
  ctaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.light.foreground,
  },
  ctaText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.light.foreground,
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
