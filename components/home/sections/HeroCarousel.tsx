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
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { colors, spacing, typography, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Banner, HeroMeta } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_META: HeroMeta = {
  issue_no: "014",
  top_caption: "Olive · Edition",
  kpi_ateliers_n: "08",
  kpi_ateliers_l: "Active ateliers",
  kpi_pieces_n: "120",
  kpi_pieces_l: "Pieces this drop",
  kpi_members_n: "1k+",
  kpi_members_l: "Members served",
};

interface HeroCarouselProps {
  banners: Banner[];
  heroMeta?: HeroMeta | null;
}

export function HeroCarousel({ banners, heroMeta }: HeroCarouselProps) {
  const router = useRouter();
  const meta = heroMeta ?? DEFAULT_META;
  const list = banners.length ? banners : [];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(1)).current;

  // Auto-advance every 6s with a cross-fade
  useEffect(() => {
    if (paused || list.length < 2) return;
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        setIdx((i) => (i + 1) % list.length);
        scrollerRef.current?.scrollTo({ x: ((idx + 1) % list.length) * SCREEN_WIDTH, animated: true });
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
    return <HeroFallback meta={meta} onShop={() => router.push("/(main)/products")} />;
  }

  const current = list[idx];
  const line1 = (current.title || "Considered").replace(/[.,!?]$/, "");
  const line2 = (current.subtitle || "never loud").replace(/[.,!?]$/, "");

  return (
    <View style={styles.root}>
      <BackgroundLayers />

      {/* Top rail */}
      <View style={styles.topRail}>
        <View style={styles.railSide}>
          <View style={styles.liveDotWrap}>
            <Animated.View style={styles.liveDotPulse} />
            <Ionicons name="radio-outline" size={11} color={colors.olive[300]} />
          </View>
          <Label style={styles.railText}>
            Issue Nº {meta.issue_no} · {meta.top_caption}
          </Label>
        </View>
        <View style={styles.railRight}>
          <Label style={styles.railText}>EN · LKR</Label>
          <View style={styles.railDivider} />
          <Label style={styles.railText}>
            {String(idx + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
          </Label>
        </View>
      </View>

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
        {list.map((b, i) => (
          <Slide
            key={b.id}
            banner={b}
            isActive={i === idx}
            onShop={() => router.push("/(main)/products")}
            onJournal={() => router.push("/(main)/blog")}
          />
        ))}
      </ScrollView>

      {/* Cross-fade overlay copy layer (so copy doesn't snap with swipe) */}
      <Animated.View pointerEvents="none" style={[styles.copyOverlay, { opacity: fade }]}>
        <View style={styles.copyKicker}>
          <View style={styles.kickerRule} />
          <Label style={styles.kickerText}>
            Edition {String(idx + 1).padStart(2, "0")} · Live now
          </Label>
        </View>
        <Display size="4xl" style={styles.titleLine1} numberOfLines={2}>
          {line1}
        </Display>
        <Display italic size="4xl" style={styles.titleLine2} numberOfLines={2}>
          {line2}
        </Display>
        <View style={styles.markerRule} />

        {current.cta_text ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryCta}
            onPress={() => router.push("/(main)/products")}
          >
            <Label style={styles.primaryCtaText}>{current.cta_text}</Label>
            <Ionicons name="arrow-forward" size={14} color={colors.olive[950]} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.secondaryLink}
          onPress={() => router.push("/(main)/blog")}
        >
          <View style={styles.linkRule} />
          <Label style={styles.secondaryLinkText}>Read the journal</Label>
        </TouchableOpacity>
      </Animated.View>

      {/* Slide controls */}
      <View style={styles.controls}>
        <View style={styles.dots}>
          {list.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              style={[styles.dot, i === idx ? styles.dotActive : styles.dotIdle]}
              accessibilityLabel={`Go to slide ${i + 1}`}
            />
          ))}
        </View>
        <View style={styles.controlsRight}>
          <TouchableOpacity
            onPress={() => setPaused((p) => !p)}
            style={styles.iconBtn}
            accessibilityLabel={paused ? "Resume" : "Pause"}
          >
            <Ionicons
              name={paused ? "play" : "pause"}
              size={14}
              color={colors.paper.cream}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => goTo(idx - 1)}
            style={styles.iconBtn}
            accessibilityLabel="Previous"
          >
            <Ionicons name="chevron-back" size={14} color={colors.paper.cream} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => goTo(idx + 1)}
            style={styles.iconBtn}
            accessibilityLabel="Next"
          >
            <Ionicons name="chevron-forward" size={14} color={colors.paper.cream} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom KPI band */}
      <View style={styles.kpiBand}>
        <View style={styles.kpiRow}>
          <Kpi value={meta.kpi_ateliers_n} label={meta.kpi_ateliers_l} />
          <View style={styles.kpiDivider} />
          <Kpi value={meta.kpi_pieces_n} label={meta.kpi_pieces_l} />
          <View style={styles.kpiDivider} />
          <Kpi value={meta.kpi_members_n} label={meta.kpi_members_l} />
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.ateliersLink}
          onPress={() => router.push("/(main)/products")}
        >
          <Ionicons name="sparkles-outline" size={12} color={colors.olive[300]} />
          <Label style={styles.ateliersLinkText}>Visit the ateliers</Label>
          <Ionicons name="arrow-up" size={11} color={colors.olive[300]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Slide({
  banner,
  isActive,
  onShop,
  onJournal,
}: {
  banner: Banner;
  isActive: boolean;
  onShop: () => void;
  onJournal: () => void;
}) {
  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      {banner.image_url ? (
        <Image
          source={{ uri: banner.image_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />
      ) : null}
      <View style={styles.slideGradient} />
      <View style={styles.slideLookChip}>
        <Label style={styles.slideLookText}>
          <Label style={styles.slideLookDot}>● </Label>
          Look {isActive ? "01" : ""}
        </Label>
      </View>
    </View>
  );
}

function HeroFallback({ meta, onShop }: { meta: HeroMeta; onShop: () => void }) {
  return (
    <View style={styles.root}>
      <BackgroundLayers />
      <View style={styles.topRail}>
        <View style={styles.railSide}>
          <View style={styles.liveDotWrap}>
            <View style={styles.liveDotPulse} />
            <Ionicons name="radio-outline" size={11} color={colors.olive[300]} />
          </View>
          <Label style={styles.railText}>
            Issue Nº {meta.issue_no} · {meta.top_caption}
          </Label>
        </View>
        <View style={styles.railRight}>
          <Label style={styles.railText}>EN · LKR</Label>
        </View>
      </View>
      <View style={styles.fallbackCopy}>
        <View style={styles.copyKicker}>
          <View style={styles.kickerRule} />
          <Label style={styles.kickerText}>Edition 01 · Live now</Label>
        </View>
        <Display size="4xl" style={styles.titleLine1}>Editorial</Display>
        <Display italic size="4xl" style={styles.titleLine2}>fashion.</Display>
        <View style={styles.markerRule} />
        <Body style={styles.fallbackSub}>
          Considered clothing, dyed in olive and worn close to the skin. Eighty to a
          hundred and twenty pieces per drop, then archived.
        </Body>
        <Button variant="brand" size="lg" onPress={onShop}>
          Shop the drop
        </Button>
      </View>
      <View style={styles.kpiBand}>
        <View style={styles.kpiRow}>
          <Kpi value={meta.kpi_ateliers_n} label={meta.kpi_ateliers_l} />
          <View style={styles.kpiDivider} />
          <Kpi value={meta.kpi_pieces_n} label={meta.kpi_pieces_l} />
          <View style={styles.kpiDivider} />
          <Kpi value={meta.kpi_members_n} label={meta.kpi_members_l} />
        </View>
      </View>
    </View>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.kpi}>
      <Display size="xl" style={styles.kpiValue}>
        {value}
      </Display>
      <Label style={styles.kpiLabel}>{label}</Label>
    </View>
  );
}

function BackgroundLayers() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.bgBase} />
      <View style={styles.bgWindowLight} />
      <View style={styles.bgCenterGlow} />
      <View style={styles.bgVignette} />
      <View style={styles.bgTopHairline} />
      <View style={styles.bgBottomHairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.olive[950],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168, 176, 107, 0.15)",
    overflow: "hidden",
  },
  // Background
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.olive[950] },
  bgWindowLight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232, 220, 170, 0.10)",
  },
  bgCenterGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(116, 130, 60, 0.18)",
  },
  bgVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  bgTopHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(168, 176, 107, 0.2)",
  },
  bgBottomHairline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(168, 176, 107, 0.2)",
  },
  // Top rail
  topRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  railSide: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  railRight: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  railDivider: { width: 1, height: 10, backgroundColor: "rgba(245, 244, 239, 0.25)" },
  railText: { color: "rgba(245, 244, 239, 0.7)" },
  liveDotWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  liveDotPulse: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(168, 176, 107, 0.4)",
  },
  // Slides
  slidesWrap: { height: 460 },
  slide: { height: 460, position: "relative" },
  slideGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22, 26, 10, 0.55)",
  },
  slideLookChip: {
    position: "absolute",
    top: spacing[4],
    left: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
  },
  slideLookText: { color: colors.olive[800], fontSize: 10 },
  slideLookDot: { color: colors.olive[600] },
  // Copy overlay
  copyOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 60,
    gap: spacing[2],
  },
  copyKicker: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 28, height: 1, backgroundColor: colors.olive[300] },
  kickerText: { color: colors.olive[300] },
  titleLine1: { color: colors.paper.cream, lineHeight: 38 },
  titleLine2: { color: colors.olive[300], lineHeight: 38 },
  markerRule: {
    width: 48,
    height: 1,
    backgroundColor: "rgba(168, 176, 107, 0.6)",
    marginTop: 4,
    marginBottom: 6,
  },
  primaryCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.paper.cream,
    marginTop: spacing[2],
    ...shadows.glow,
  },
  primaryCtaText: {
    color: colors.olive[950],
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: typography.letterSpacing.editorial,
  },
  secondaryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    alignSelf: "flex-start",
    marginTop: spacing[2],
  },
  linkRule: { width: 22, height: 1, backgroundColor: "rgba(245, 244, 239, 0.6)" },
  secondaryLinkText: { color: "rgba(245, 244, 239, 0.9)" },
  // Controls
  controls: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 28, backgroundColor: colors.olive[300] },
  dotIdle: { width: 8, backgroundColor: "rgba(245, 244, 239, 0.25)" },
  controlsRight: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(245, 244, 239, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  // KPI band
  kpiBand: {
    paddingHorizontal: 20,
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    backgroundColor: "rgba(13, 14, 10, 0.4)",
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 244, 239, 0.08)",
    gap: spacing[3],
  },
  kpiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpi: { flex: 1, gap: 2 },
  kpiValue: { color: colors.paper.cream, fontSize: 22 },
  kpiLabel: { color: "rgba(245, 244, 239, 0.55)", fontSize: 9 },
  kpiDivider: { width: 1, height: 24, backgroundColor: "rgba(245, 244, 239, 0.12)", marginHorizontal: 8 },
  ateliersLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  ateliersLinkText: { color: "rgba(245, 244, 239, 0.9)" },
  // Fallback
  fallbackCopy: { paddingHorizontal: 20, paddingVertical: spacing[8], gap: spacing[3] },
  fallbackSub: { color: "rgba(245, 244, 239, 0.8)", marginBottom: spacing[3] },
});
