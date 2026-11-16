/**
 * Stylists' Picks — editorial trend cards on the home screen.
 *
 * 4:5 image cards aligned to the page gutter, with the next card peeking in
 * at the right edge. Snaps card-by-card and auto-advances every 4.5s while the
 * user isn't touching it. Each card's artwork carries its own title and
 * tagline; tapping opens a search for that trend.
 *
 * Add / reorder picks in `PICKS` below. Images live in
 * `assets/stylists-picks/` (864×1080 webp).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing } from "@/lib/theme/tokens";

type Pick = { key: string; image: ImageSourcePropType; title: string; search: string };

const PICKS: Pick[] = [
  { key: "check-mate", image: require("@/assets/stylists-picks/check-mate.webp"), title: "Check Mate", search: "check" },
  { key: "power-dressing", image: require("@/assets/stylists-picks/power-dressing.webp"), title: "Power Dressing", search: "blazer" },
  { key: "summer-state", image: require("@/assets/stylists-picks/summer-state.webp"), title: "Summer State", search: "summer" },
  { key: "denim-days", image: require("@/assets/stylists-picks/denim-days.webp"), title: "Denim Days", search: "denim" },
  { key: "knit-escape", image: require("@/assets/stylists-picks/knit-escape.webp"), title: "Knit Escape", search: "knit" },
  { key: "street-culture", image: require("@/assets/stylists-picks/street-culture.webp"), title: "Street Culture", search: "streetwear" },
  { key: "jewellery-stacking", image: require("@/assets/stylists-picks/jewellery-stacking.webp"), title: "Jewellery Stacking", search: "jewellery" },
  { key: "little-style-icons", image: require("@/assets/stylists-picks/little-style-icons.webp"), title: "Little Style Icons", search: "kids" },
];

const AUTO_MS = 4500;
const GAP = 10;
const H_PAD = spacing[5];

export function StylistsPicks() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.round(width * 0.84);
  const cardH = Math.round(cardW * 1.25);
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  const [touching, setTouching] = useState(false);
  const n = PICKS.length;

  const goTo = useCallback(
    (i: number) => {
      ref.current?.scrollTo({ x: i * step, animated: true });
      setIdx(i);
    },
    [step],
  );

  useEffect(() => {
    if (n < 2 || touching) return;
    const t = setTimeout(() => goTo((idx + 1) % n), AUTO_MS);
    return () => clearTimeout(t);
  }, [idx, n, touching, goTo]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.min(n - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
    setTouching(false);
  };

  const open = (p: Pick) =>
    router.push(
      `/(main)/products?search=${encodeURIComponent(p.search)}&title=${encodeURIComponent(p.title)}` as never,
    );

  return (
    <View style={styles.root}>
      {/* Wordmark: serif "stylists'" + tilted magenta PICKS tag */}
      <View style={styles.heading} accessibilityRole="header" accessibilityLabel="Stylists' picks">
        <Text style={styles.headSerif}>stylists’</Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>PICKS</Text>
        </View>
      </View>

      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingLeft: H_PAD, paddingRight: side, gap: GAP }}
        onScrollBeginDrag={() => setTouching(true)}
        onScrollEndDrag={() => setTouching(false)}
        onMomentumScrollEnd={onMomentumEnd}
        accessibilityLabel="Stylists' picks"
      >
        {PICKS.map((p, i) => (
          <Pressable
            key={p.key}
            onPress={() => open(p)}
            accessibilityRole="link"
            accessibilityLabel={`${p.title} — shop the trend`}
            style={({ pressed }) => [{ width: cardW, height: cardH, opacity: pressed ? 0.92 : 1 }]}
          >
            <Image
              source={p.image}
              style={[styles.img, { opacity: i === idx ? 1 : 0.85 }]}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PICKS.map((p, i) => (
          <Pressable key={p.key} onPress={() => goTo(i)} hitSlop={6} accessibilityLabel={`Pick ${i + 1}: ${p.title}`}>
            <View style={[styles.dot, i === idx && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 0,
    marginBottom: 8,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headSerif: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1,
    color: "#141414",
  },
  tag: {
    marginLeft: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#ff2e93",
    borderRadius: 3,
    transform: [{ rotate: "-3deg" }],
  },
  tagText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.5,
    color: "#ffffff",
  },
  // Radius on the image itself — overflow:hidden + radius can leave
  // children unpainted on some Android devices.
  img: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#ece8e1",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(20,20,20,0.2)",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#141414",
  },
});
