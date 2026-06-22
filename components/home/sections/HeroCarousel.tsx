import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label } from "@/components/ui/Typography";
import { colors, spacing, typography, shadows, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { LinearGradient } from "expo-linear-gradient";
import type { Banner } from "@/lib/types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.55; // Aspect ratio ~55-60% of screen height for full bleed look

interface HeroCarouselProps {
  banners: Banner[];
}

export function HeroCarousel({ banners }: HeroCarouselProps) {
  const router = useRouter();
  const list = banners.length ? banners : [];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(1)).current;

  // Auto-advance every 6s with a cross-fade animation
  useEffect(() => {
    if (paused || list.length < 2) return;
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        const nextIdx = (idx + 1) % list.length;
        setIdx(nextIdx);
        scrollerRef.current?.scrollTo({ x: nextIdx * SCREEN_WIDTH, animated: true });
      }, 240);
    }, 6000);
    return () => clearInterval(t);
  }, [paused, list.length, idx, fade]);

  const goTo = useCallback(
    (next: number) => {
      const safe = ((next % list.length) + list.length) % list.length;
      setIdx(safe);
      scrollerRef.current?.scrollTo({ x: safe * SCREEN_WIDTH, animated: true });
    },
    [list.length]
  );

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (i !== idx) setIdx(i);
  };

  if (!list.length) {
    return <HeroFallback onShop={() => router.push("/(main)/products")} />;
  }

  const current = list[idx];
  const title = current.title || "Considered Design";
  const subtitle = current.subtitle || "";

  return (
    <View style={styles.root}>
      {/* Slides */}
      <ScrollView
        ref={scrollerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollBeginDrag={() => setPaused(true)}
        onScrollEndDrag={() => setPaused(false)}
        scrollEventThrottle={16}
        style={styles.slidesWrap}
      >
        {list.map((b) => (
          <View key={b.id} style={styles.slide}>
            {b.image_url ? (
              <Image
                source={{ uri: b.image_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={400}
              />
            ) : null}
            <LinearGradient
              colors={["transparent", "rgba(245, 244, 239, 0.4)", colors.light.background]}
              style={styles.bottomGradient}
            />
          </View>
        ))}
      </ScrollView>

      {/* Clean minimal text overlay */}
      <Animated.View pointerEvents="none" style={[styles.copyOverlay, { opacity: fade }]}>
        <Display italic size="4xl" style={styles.titleText} numberOfLines={2}>
          {title} {subtitle}
        </Display>

        {current.cta_text ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryCta}
            onPress={() => router.push("/(main)/products")}
          >
            <Label style={styles.primaryCtaText}>{current.cta_text}</Label>
            <Ionicons name="arrow-forward" size={14} color={colors.light.primaryForeground} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {/* Pagination dots at the bottom of the image */}
      <View style={styles.dotsContainer}>
        {list.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => goTo(i)}
            style={[styles.dot, i === idx ? styles.dotActive : styles.dotIdle]}
            accessibilityLabel={`Go to slide ${i + 1}`}
          />
        ))}
      </View>
    </View>
  );
}

function HeroFallback({ onShop }: { onShop: () => void }) {
  return (
    <View style={styles.root}>
      <View style={styles.slide}>
        <LinearGradient
          colors={["transparent", "rgba(245, 244, 239, 0.4)", colors.light.background]}
          style={styles.bottomGradient}
        />
      </View>
      <View style={styles.copyOverlay}>
        <Display italic size="4xl" style={styles.titleText}>
          Editorial Fashion
        </Display>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.primaryCta}
          onPress={onShop}
        >
          <Label style={styles.primaryCtaText}>Shop the drop</Label>
          <Ionicons name="arrow-forward" size={14} color={colors.light.primaryForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: colors.light.background,
    position: "relative",
    overflow: "hidden",
  },
  slidesWrap: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: colors.light.background,
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.45,
  },
  copyOverlay: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 40,
    gap: spacing[2],
  },
  titleText: {
    color: colors.light.foreground,
    lineHeight: 40,
  },
  primaryCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.light.primary,
    marginTop: spacing[2],
    ...shadows.soft,
  },
  primaryCtaText: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.light.primary,
  },
  dotIdle: {
    width: 6,
    backgroundColor: colors.light.accent,
    opacity: 0.5,
  },
});
