/**
 * WholesaleHero — the wholesale counterpart of the Home FestiveHero.
 *
 *   1. Department tabs (shared with Home) — drive the gender filter.
 *   2. Category icon row (shared with Home) — filters the grid in place.
 *   3. Peek banner carousel. CMS banners at position `wholesale_hero` win;
 *      otherwise bundled lifestyle art with wholesale copy laid over it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { CategoryIcons, DeptTabs, FRAME_COLORS, type Dept } from "@/components/home/premium/FestiveHero";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Banner, Category } from "@/lib/types";

const SLIDE_MS = 5000;
const CARD_GAP = 12;
const CARD_SIDE = 16;
const CARD_RADIUS = 20;
const CARD_BORDER = 3;
const GOLD = "#c9b27a";
const GOLD_SOFT = "#e3d4a4";
const INK = "#16170f";

type ArtSlide = {
  key: string;
  image: ImageSourcePropType;
  frame: string;
  base: string;
  kicker: string;
  title: string;
  italic: string;
  sub: string;
  cta: string;
  dept: Dept;
};

/** Bundled art carries retail copy in its lower third; the panel below covers it. */
const ART_SLIDES: ArtSlide[] = [
  {
    key: "festive",
    image: require("@/assets/home-banners/wedding.webp"),
    frame: FRAME_COLORS[0],
    base: "#3d0718",
    kicker: "FESTIVE TRADE EDIT",
    title: "Festive,",
    italic: "by the pack.",
    sub: "Bridal & occasion styles, priced per piece for boutiques.",
    cta: "Shop festive",
    dept: "women",
  },
  {
    key: "mens",
    image: require("@/assets/home-banners/mens.webp"),
    frame: FRAME_COLORS[2],
    base: "#0a1636",
    kicker: "MENSWEAR · BULK",
    title: "Menswear,",
    italic: "stocked deep.",
    sub: "Shirts, trousers and tailoring in pack sizes.",
    cta: "Shop men",
    dept: "men",
  },
  {
    key: "kids",
    image: require("@/assets/home-banners/kids.webp"),
    frame: FRAME_COLORS[1],
    base: "#4a2a00",
    kicker: "KIDS ESSENTIALS",
    title: "Little looks,",
    italic: "low minimums.",
    sub: "Everyday kidswear from just a few pieces.",
    cta: "Shop kids",
    dept: "kids",
  },
  {
    key: "street",
    image: require("@/assets/home-banners/streetwear.webp"),
    frame: FRAME_COLORS[3],
    base: "#05322a",
    kicker: "RESELLER DROPS",
    title: "Streetwear,",
    italic: "made to resell.",
    sub: "Trend-led drops with healthy margins.",
    cta: "Shop the drop",
    dept: "all",
  },
  {
    key: "summer",
    image: require("@/assets/home-banners/summer.webp"),
    frame: "#c2410c",
    base: "#3a1606",
    kicker: "RESORT LINE",
    title: "Summer stock,",
    italic: "ready to ship.",
    sub: "Linen, cotton and resort pieces, islandwide.",
    cta: "Shop resort",
    dept: "all",
  },
];

export function WholesaleHero({
  dept,
  onDeptChange,
  categories,
  category,
  onCategoryChange,
  banners,
  onSlidePress,
}: {
  dept: Dept;
  onDeptChange: (d: Dept) => void;
  categories: Category[];
  category: string | null;
  onCategoryChange: (slug: string | null) => void;
  banners: Banner[];
  /** Art slides jump to their department in the grid. */
  onSlidePress: (dept: Dept) => void;
}) {
  return (
    <View style={styles.root}>
      <DeptTabs value={dept} onChange={onDeptChange} />
      <CategoryIcons
        categories={categories}
        dept={dept}
        showRunway={false}
        selected={category}
        onPick={(c) => onCategoryChange(category === c.slug ? null : c.slug)}
      />
      <BannerCarousel banners={banners} onSlidePress={onSlidePress} />
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Banner carousel                                                       */
/* -------------------------------------------------------------------- */

type Slide =
  | { kind: "cms"; key: string; source: ImageSourcePropType; frame: string; label: string; link: string }
  | ({ kind: "art" } & ArtSlide);

function BannerCarousel({ banners, onSlidePress }: { banners: Banner[]; onSlidePress: (d: Dept) => void }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.round(width * 0.74);
  const cardH = Math.round(cardW * (4 / 3));
  const step = cardW + CARD_GAP;
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    const cms = banners.filter((b) => !!b.image_url);
    if (cms.length) {
      return cms.map((b, i) => ({
        kind: "cms" as const,
        key: String(b.id ?? i),
        source: { uri: b.image_url as string },
        frame: b.accent_color || b.bg_color || FRAME_COLORS[i % FRAME_COLORS.length],
        label: b.title || `Banner ${i + 1}`,
        link: b.link || "/(main)/wholesale",
      }));
    }
    return ART_SLIDES.map((s) => ({ kind: "art" as const, ...s }));
  }, [banners]);
  const n = slides.length;

  const goTo = useCallback(
    (i: number) => {
      ref.current?.scrollTo({ x: i * step, animated: true });
      setIdx(i);
    },
    [step],
  );

  useEffect(() => {
    if (n < 2 || dragging) return;
    const t = setTimeout(() => goTo((idx + 1) % n), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, n, dragging, goTo]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.min(n - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
    setDragging(false);
  };

  return (
    <View style={styles.carousel}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: CARD_SIDE, gap: CARD_GAP }}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={onMomentumEnd}
        accessibilityLabel="Wholesale campaigns"
      >
        {slides.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => (s.kind === "cms" ? router.push(s.link as never) : onSlidePress(s.dept))}
            accessibilityRole="link"
            accessibilityLabel={s.kind === "cms" ? s.label : `${s.title} ${s.italic} ${s.sub}`}
            style={({ pressed }) => [
              styles.card,
              { width: cardW, height: cardH, borderColor: s.frame, transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
          >
            {s.kind === "cms" ? (
              <Image
                source={s.source}
                style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS - CARD_BORDER }]}
                contentFit="cover"
                transition={250}
              />
            ) : (
              <ArtCard slide={s} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      {n > 1 && (
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <Pressable key={s.key} onPress={() => goTo(i)} hitSlop={6} accessibilityLabel={`Banner ${i + 1}`}>
              <View style={[styles.dot, i === idx && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ArtCard({ slide }: { slide: ArtSlide }) {
  const r = CARD_RADIUS - CARD_BORDER;
  return (
    <>
      <Image
        source={slide.image}
        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        contentFit="cover"
        contentPosition="top"
        transition={250}
      />
      {/* Solid lower panel hides the art's own retail lockup. */}
      <LinearGradient
        colors={["transparent", "transparent", `${slide.base}d9`, slide.base, slide.base]}
        locations={[0, 0.36, 0.52, 0.6, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
      />
      {/* Inner hairline frame, like the Home art. */}
      <View pointerEvents="none" style={[styles.innerFrame, { borderRadius: r - 6 }]} />

      <View style={styles.moqSeal}>
        <Text style={styles.moqSealSmall}>TRADE</Text>
        <Text style={styles.moqSealBig}>B2B</Text>
      </View>

      <View style={styles.lockup}>
        <View style={styles.kickerPill}>
          <View style={styles.kickerDot} />
          <Text style={styles.kickerText}>{slide.kicker}</Text>
        </View>
        <Text style={styles.title}>
          {slide.title}
          {"\n"}
          <Text style={styles.titleItalic}>{slide.italic}</Text>
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {slide.sub}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{slide.cta}</Text>
          <View style={styles.ctaIcon}>
            <Ionicons name="arrow-forward" size={12} color={GOLD_SOFT} />
          </View>
        </View>
      </View>
    </>
  );
}

/* -------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { paddingBottom: 6 },

  carousel: { marginTop: 4 },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: CARD_BORDER,
    backgroundColor: "#f3ece4",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  innerFrame: {
    position: "absolute",
    left: 6,
    top: 6,
    right: 6,
    bottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,240,200,0.55)",
  },
  moqSeal: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(22,23,15,0.82)",
    borderWidth: 1.5,
    borderColor: GOLD,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-10deg" }],
  },
  moqSealSmall: { fontFamily: fontFamilies.mono.semibold, fontSize: 7.5, letterSpacing: 1.4, color: GOLD },
  moqSealBig: { fontFamily: fontFamilies.display.semibold, fontSize: 18, lineHeight: 20, color: GOLD_SOFT },
  lockup: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
  },
  kickerPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(227,212,164,0.45)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  kickerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#25D366" },
  kickerText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.4, color: GOLD_SOFT },
  title: {
    marginTop: 10,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: "#fbf7ec",
  },
  titleItalic: { fontFamily: fontFamilies.display.italic, color: GOLD_SOFT },
  sub: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: "rgba(251,247,236,0.75)",
  },
  cta: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#fff3c4",
  },
  ctaText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: INK },
  ctaIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(30,11,58,0.25)" },
  dotActive: { width: 18, backgroundColor: "#1e0b3a" },

});
