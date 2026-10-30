import React, { useRef, useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Animated,
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
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Banner } from "@/lib/types";
import { C } from "@/components/orders/parcel-track";

const CARD_HEIGHT = 400;

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
  const STEP = CARD_WIDTH + spacing[3];
  const list = banners.length ? banners : FALLBACK_PROMOS;
  const [active, setActive] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (list.length <= 1) return;
    const interval = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % list.length;
        scrollRef.current?.scrollTo({ x: next * STEP, animated: true });
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [list.length, STEP]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / STEP);
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
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STEP}
        decelerationRate="fast"
        contentContainerStyle={styles.scroll}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        {list.map((b, i) => {
          const inputRange = [(i - 1) * STEP, i * STEP, (i + 1) * STEP];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.93, 1, 0.93],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.6, 1, 0.6],
            extrapolate: "clamp",
          });

          return (
            <TouchableOpacity
              key={b.id}
              style={{ width: CARD_WIDTH }}
              activeOpacity={0.92}
              onPress={() => handleCta(b)}
            >
              <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
                <View style={styles.eyebrow}>
                  <View style={styles.eyebrowDot} />
                  <Text style={styles.eyebrowText}>FEATURED · {String(i + 1).padStart(2, "0")}</Text>
                </View>
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
                  <View style={styles.ctaStamp}>
                    <Text style={styles.ctaText}>{b.cta_text || "Shop now"}</Text>
                    <View style={styles.ctaArrow}>
                      <Ionicons name="arrow-forward" size={13} color={C.lime} />
                    </View>
                  </View>
                </View>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </Animated.ScrollView>
      {list.length > 1 ? (
        <View style={styles.progressWrap}>
          {list.map((b, i) => (
            <TouchableOpacity
              key={b.id}
              style={styles.progressTrack}
              onPress={() => {
                setActive(i);
                scrollRef.current?.scrollTo({ x: i * STEP, animated: true });
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.progressBar, i === active && styles.progressBarActive]} />
            </TouchableOpacity>
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
    borderRadius: 26,
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
    top: 14,
    left: 14,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: "rgba(22,23,15,0.72)",
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.lime,
  },
  eyebrowText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: C.goldSoft,
  },
  copy: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[4],
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
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: spacing[3],
    backgroundColor: "#FFFFFF",
    borderRadius: radii.full,
    paddingLeft: 18,
    paddingRight: 5,
    height: 44,
  },
  ctaArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: C.text,
  },
  progressWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[3.5],
    paddingHorizontal: spacing[5],
  },
  progressTrack: {
    flex: 1,
    maxWidth: 28,
    height: 4,
    backgroundColor: "rgba(22,23,15,0.1)",
    borderRadius: radii.full,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    width: "0%",
    backgroundColor: C.ink,
    borderRadius: radii.full,
  },
  progressBarActive: {
    width: "100%",
  },
});
