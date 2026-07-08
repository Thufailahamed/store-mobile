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
import { useRouter } from "expo-router";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Banner } from "@/lib/types";

const CARD_HEIGHT = 168;

interface PromoCarouselProps {
  banners: Banner[];
}

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
        {list.map((b) => {
          const bg = b.bg_color || colors.accent2.ochre + "33";
          const accent = b.accent_color || colors.light.foreground;
          return (
            <View key={b.id} style={[styles.card, { width: CARD_WIDTH }]}>
              <View style={[styles.copy, { backgroundColor: bg }]}>
                <Text style={[styles.brand, { color: accent }]} numberOfLines={1}>
                  {b.title}
                </Text>
                <Text style={styles.headline} numberOfLines={2}>
                  {b.subtitle || "Curated pieces, delivered with care"}
                </Text>
                <TouchableOpacity
                  style={styles.cta}
                  activeOpacity={0.85}
                  onPress={() => handleCta(b)}
                >
                  <Text style={styles.ctaText}>{b.cta_text || "Shop now"}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.visual}>
                {b.image_url ? (
                  <Image source={{ uri: b.image_url }} style={styles.image} contentFit="cover" />
                ) : (
                  <View style={styles.imagePlaceholder} />
                )}
              </View>
            </View>
          );
        })}
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
    marginBottom: spacing[5],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  card: {
    flexDirection: "row",
    height: CARD_HEIGHT,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.light.card,
    ...shadows.soft,
  },
  copy: {
    flex: 1,
    padding: spacing[4],
    justifyContent: "center",
    gap: spacing[2],
  },
  brand: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  headline: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  cta: {
    alignSelf: "flex-start",
    marginTop: spacing[1],
    backgroundColor: colors.light.foreground,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  ctaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.card,
  },
  visual: {
    width: CARD_HEIGHT,
    height: CARD_HEIGHT,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: colors.olive[200],
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
