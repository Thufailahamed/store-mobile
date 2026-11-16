/**
 * FestiveHero — marketplace-style sale cover for the home screen.
 *
 * Top to bottom:
 *   1. Department tabs (All / Men / Women / Kids) with a folder-style active tab.
 *   2. Category icon row — filtered by the active department.
 *   3. Peek image carousel: portrait 3:4 banner images in coloured frames,
 *      next card peeking in. Images come from `heroBanners.ts` (local) or
 *      the CMS banners. Snaps per card, auto-advances every 5s (paused
 *      while the user drags).
 *   4. Pager dots.
 *   5. "Powered by" promo video — muted, looping, full-bleed.
 *
 * CMS `accent_color` / `bg_color` on a banner sets its frame colour.
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
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Banner, Brand, Category } from "@/lib/types";
import { HERO_BANNERS } from "./heroBanners";
import { PoweredByVideo } from "./PoweredByVideo";
import { POSTS_ENABLED, publicPostsApi } from "@/lib/posts/api";

const SLIDE_MS = 5000;
/** Category icon circle diameter (Myntra-style small round icons). */
const CAT_SIZE = 58;

export type Dept = "all" | "men" | "women" | "kids";
const DEPTS: { key: Dept; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "men", label: "MEN" },
  { key: "women", label: "WOMEN" },
  { key: "kids", label: "KIDS" },
];

/** Twinkle dots over the department tabs + category row (x%, y px, size). */
const TOP_SPARKLES: [number, number, number][] = [
  [4, 8, 3], [12, 60, 2], [22, 24, 4], [33, 90, 2], [41, 12, 3], [52, 70, 2],
  [60, 30, 4], [70, 95, 3], [78, 10, 2], [86, 55, 3], [94, 20, 4], [97, 110, 2],
  [8, 150, 2], [28, 175, 3], [48, 140, 2], [66, 165, 3], [90, 150, 2],
];

/* -------------------------------------------------------------------- */

export function FestiveHero({
  categories,
  banners,
  brands,
  dept: deptProp,
  onDeptChange,
}: {
  categories: Category[];
  banners: Banner[];
  brands: Brand[];
  /** Controlled department; the home screen uses it to recolour the header. */
  dept?: Dept;
  onDeptChange?: (d: Dept) => void;
}) {
  const [deptState, setDeptState] = useState<Dept>("all");
  const dept = deptProp ?? deptState;
  const setDept = (d: Dept) => {
    setDeptState(d);
    onDeptChange?.(d);
  };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.topSparkles}>
        {TOP_SPARKLES.map(([x, y, sz], k) => (
          <View
            key={k}
            style={[
              styles.sparkDot,
              { left: `${x}%`, top: y, width: sz, height: sz, borderRadius: sz / 2, opacity: k % 2 ? 0.9 : 0.55 },
            ]}
          />
        ))}
      </View>
      <DeptTabs value={dept} onChange={setDept} />
      <CategoryIcons categories={categories} dept={dept} />
      {banners.length > 0 && <SaleCarousel banners={banners} />}
      <PoweredByVideo />
      <OfferStrip />
      <FreeDeliveryBanner />
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Department tabs                                                       */
/* -------------------------------------------------------------------- */

/** Per-department colour theme: outline/ink colour + header gradient. */
export const DEPT_THEMES: Record<Dept, { line: string; bg: readonly [string, string, string] }> = {
  // Soft, muted wash (top → bottom) like a marketplace sale header:
  // sage for All, dusty blue / blush / butter for the departments.
  all: { line: "#7a1340", bg: ["#c3d8a0", "#d4e3b9", "#e7eed6"] },
  men: { line: "#0b3d91", bg: ["#b7cbe6", "#cbd9ee", "#e3eaf5"] },
  women: { line: "#a3124f", bg: ["#f1c2d2", "#f6d4df", "#fae7ed"] },
  kids: { line: "#8a4b00", bg: ["#f3d98f", "#f7e4ae", "#fbf0d2"] },
};
const DEPT_ORDER: Dept[] = ["all", "men", "women", "kids"];
const LINE_COLORS = DEPT_ORDER.map((d) => DEPT_THEMES[d].line);

const TAB_INK = "#2b2d42";
const TAB_H = 38;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Folder-tab outline: one continuous line runs along the bottom, rises
 * through an S-curve into the active tab, across its top, and back down
 * into the baseline on the other side. The active tab itself is unfilled.
 */
function tabPath(x1: number, x2: number, w: number): string {
  "worklet";
  const T = 1;
  const B = TAB_H - 1;
  return [
    `M 0 ${B}`,
    `L ${Math.max(0, x1 - 12)} ${B}`,
    // bottom flare
    `C ${x1 - 3} ${B} ${x1 - 1} ${B - 4} ${x1 + 1} ${B - 10}`,
    // steep slanted side
    `L ${x1 + 6} ${T + 11}`,
    // rounded top corner
    `C ${x1 + 8} ${T + 3} ${x1 + 13} ${T} ${x1 + 22} ${T}`,
    `L ${x2 - 22} ${T}`,
    `C ${x2 - 13} ${T} ${x2 - 8} ${T + 3} ${x2 - 6} ${T + 11}`,
    `L ${x2 - 1} ${B - 10}`,
    `C ${x2 + 1} ${B - 4} ${x2 + 3} ${B} ${x2 + 12} ${B}`,
    `L ${w} ${B}`,
  ].join(" ");
}

function DeptTabs({ value, onChange }: { value: Dept; onChange: (d: Dept) => void }) {
  const router = useRouter();
  const [rowW, setRowW] = useState(0);
  const [cells, setCells] = useState<Record<string, { x: number; w: number }>>({});
  const cell = cells[value];
  const theme = DEPT_THEMES[value];

  // Outline edges + colour index animate together when the tab changes.
  const x1 = useSharedValue(-1);
  const x2 = useSharedValue(-1);
  const ci = useSharedValue(DEPT_ORDER.indexOf(value));
  useEffect(() => {
    if (!cell) return;
    const cfg = { duration: 360, easing: Easing.out(Easing.cubic) };
    if (x1.value < 0) {
      x1.value = cell.x;
      x2.value = cell.x + cell.w;
    } else {
      x1.value = withTiming(cell.x, cfg);
      x2.value = withTiming(cell.x + cell.w, cfg);
    }
    ci.value = withTiming(DEPT_ORDER.indexOf(value), cfg);
  }, [cell?.x, cell?.w, value]); // eslint-disable-line react-hooks/exhaustive-deps

  const pathProps = useAnimatedProps(() => ({
    d: tabPath(x1.value, x2.value, rowW),
    stroke: interpolateColor(ci.value, [0, 1, 2, 3], LINE_COLORS),
  }), [rowW]);

  return (
    <View style={styles.tabsRow} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      {rowW > 0 && cell ? (
        <Svg pointerEvents="none" width={rowW} height={TAB_H} style={styles.tabsSvg}>
          <AnimatedPath animatedProps={pathProps} strokeWidth={2} fill="none" strokeLinejoin="round" />
        </Svg>
      ) : null}
      {DEPTS.map((d) => {
        const active = d.key === value;
        return (
          <Pressable
            key={d.key}
            onPress={() => onChange(d.key)}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setCells((c) => (c[d.key]?.x === x && c[d.key]?.w === width ? c : { ...c, [d.key]: { x, w: width } }));
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabText, active && [styles.tabTextActive, { color: theme.line }]]}>{d.label}</Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => router.push("/(main)/categories")}
        style={styles.tabGrid}
        accessibilityLabel="All categories"
      >
        <View style={styles.gridDots}>
          {[0, 1, 2, 3].map((k) => (
            <View key={k} style={styles.gridDot} />
          ))}
        </View>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Category icon row                                                     */
/* -------------------------------------------------------------------- */

function matchesDept(c: Category, dept: Dept): boolean {
  if (dept === "all") return true;
  const g = String(c.gender ?? "").toLowerCase();
  if (g === dept || (dept !== "kids" && g === "unisex")) return true;
  const s = `${c.slug} ${c.name}`.toLowerCase();
  return dept === "men" ? /\bmen|\bmens|\bman\b/.test(s) && !/women/.test(s) : s.includes(dept);
}

function CategoryIcons({ categories, dept }: { categories: Category[]; dept: Dept }) {
  const router = useRouter();
  const list = useMemo(() => {
    // Men / Women / Kids: show that root's own categories (the live tree).
    if (dept !== "all") {
      const root = categories.find((c) => c.slug === dept && !c.parent_id);
      const own = root
        ? categories
            .filter((c) => c.parent_id === root.id && c.is_active !== false)
            // Photo tiles first, then the admin's position order.
            .sort(
              (a, b) =>
                Number(!a.image_url) - Number(!b.image_url) || (a.position ?? 0) - (b.position ?? 0),
            )
        : [];
      // Kids has repeat names ("Tshirts", "Dresses", "Clothing Sets") across
      // sub-trees: keep the first of each so the row has no twin tiles.
      const seen = new Set<string>();
      const unique = own.filter((c) => {
        const k = c.name.trim().toLowerCase().replace(/[^a-z]/g, "");
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (unique.length > 0) return unique.slice(0, 16);
    }
    const ordered = [
      ...categories.filter((c) => !c.parent_id),
      ...categories.filter((c) => c.parent_id),
    ];
    const filtered = ordered.filter((c) => matchesDept(c, dept));
    return (filtered.length >= 3 ? filtered : ordered).slice(0, 14);
  }, [categories, dept]);

  if (!list.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.catScroll}
    >
      {POSTS_ENABLED ? <RunwayTile /> : null}
      {list.map((c, i) => (
        <Pressable
          key={c.id}
          onPress={() => router.push(`/(main)/products?category=${c.slug}` as never)}
          style={({ pressed }) => [styles.catItem, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <View style={[styles.catImgWrap, i === 0 && { borderColor: DEPT_THEMES[dept].line }]}>
            {c.image_url ? (
              <Image source={{ uri: c.image_url }} style={styles.catImg} contentFit="cover" transition={200} />
            ) : (
              <LinearGradient colors={["#fde7f3", "#e9d5ff"]} style={[styles.catImg, styles.center]}>
                <Text style={styles.catInitial}>{c.name.charAt(0)}</Text>
              </LinearGradient>
            )}
          </View>
          <Text numberOfLines={1} style={[styles.catLabel, i === 0 && [styles.catLabelFirst, { color: DEPT_THEMES[dept].line }]]}>
            {c.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * Story-style entry to the Runway (shoppable videos from boutiques): a
 * gradient ring around the latest video's cover, or a dark tile with a play
 * mark when there's no video yet. Each layer is rounded on its own (Android).
 */
function RunwayTile() {
  const router = useRouter();
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    publicPostsApi.feed({ limit: 1 })
      .then((d) => {
        const m = d.items[0]?.media[0];
        if (alive) setCover((m?.type === "video" ? m.poster_url : m?.url) ?? null);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return (
    <Pressable
      onPress={() => router.push("/reels" as never)}
      accessibilityRole="button"
      accessibilityLabel="Runway — shoppable videos from boutiques"
      style={({ pressed }) => [styles.catItem, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <LinearGradient colors={["#f9a826", "#ee2a7b", "#6228d7"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.runwayRing}>
        <View style={styles.runwayGap}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.runwayInner} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={["#2a1747", "#120b1f"]} style={styles.runwayInner} />
          )}
          <View style={[styles.runwayInner, styles.runwayShade]} />
          <View style={styles.runwayPlay}>
            <Ionicons name="play" size={13} color="#fff" style={{ marginLeft: 2 }} />
          </View>
        </View>
      </LinearGradient>
      <Text numberOfLines={1} style={[styles.catLabel, styles.runwayLabel]}>Runway</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* Sale carousel                                                         */
/* -------------------------------------------------------------------- */

/** Rotating frame colours for the image cards (maroon, marigold, royal, emerald). */
const FRAME_COLORS = ["#8a1538", "#f0a020", "#1546d8", "#00876b"];

type Slide = { key: string; source: ImageSourcePropType; link: string; frame: string; label: string };

/**
 * Where a CMS banner opens. Product-listing links get the banner id appended,
 * so the listing shows the admin-tagged products first and related products
 * after them; any filters already in the link still apply. Other links
 * (e.g. a store page) are left as they are.
 */
function bannerLanding(b: Banner): string {
  const link = b.link || "/(main)/products";
  const isListing = /^\/?(\(main\)\/)?products(\?|$)/.test(link);
  if (!b.id || !isListing) return link;
  // Plain string handling: RN's URLSearchParams polyfill lacks set()/has().
  const [path, query = ""] = link.split("?");
  const parts = query
    .split("&")
    .filter((p) => p && !p.startsWith("banner="));
  parts.push(`banner=${encodeURIComponent(String(b.id))}`);
  if (b.title && !parts.some((p) => p.startsWith("title="))) {
    parts.push(`title=${encodeURIComponent(b.title)}`);
  }
  return `${path}?${parts.join("&")}`;
}

/**
 * CMS banners (admin → Banners, position `home_hero`) are the source of truth.
 * Bundled HERO_BANNERS are only a fallback when the CMS list is empty.
 */
function useSlides(banners: Banner[]): Slide[] {
  return useMemo(() => {
    const cms = banners.filter((b) => !!b.image_url);
    if (cms.length > 0) {
      return cms.map((b, i) => ({
        key: String(b.id ?? i),
        source: { uri: b.image_url as string },
        link: bannerLanding(b),
        frame: b.accent_color || b.bg_color || FRAME_COLORS[i % FRAME_COLORS.length],
        label: b.title || `Banner ${i + 1}`,
      }));
    }
    return HERO_BANNERS.map((b, i) => ({
      key: `local-${i}`,
      source: typeof b.image === "string" ? { uri: b.image } : b.image,
      link: b.link || "/(main)/products",
      frame: b.frame || FRAME_COLORS[i % FRAME_COLORS.length],
      label: b.label || `Banner ${i + 1}`,
    }));
  }, [banners]);
}

/**
 * Peek carousel: portrait (3:4) image cards with a coloured frame, the next
 * card peeking in from the right. Snaps card-by-card and auto-advances every
 * 5s while the user is not dragging.
 */
function SaleCarousel({ banners }: { banners: Banner[] }) {
  const slides = useSlides(banners);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.round(width * 0.74);
  const cardH = Math.round(cardW * (4 / 3));
  const step = cardW + CARD_GAP;
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
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

  if (n === 0) return null;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.min(n - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
    setDragging(false);
  };

  return (
    <View style={styles.heroWrap}>
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
        accessibilityLabel="Sale campaigns"
      >
        {slides.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => router.push(s.link as never)}
            accessibilityRole="link"
            accessibilityLabel={s.label}
            style={({ pressed }) => [
              styles.heroCard,
              { width: cardW, height: cardH, borderColor: s.frame, transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
          >
            {/* Radius on the image itself — overflow:hidden + radius can leave
                children unpainted on some Android devices. */}
            <Image
              source={s.source}
              style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS - CARD_BORDER }]}
              contentFit="cover"
              transition={250}
            />
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

const CARD_GAP = 12;
const CARD_SIDE = 16;
const CARD_RADIUS = 20;
const CARD_BORDER = 3;

/* -------------------------------------------------------------------- */
/* Offer strip                                                           */
/* -------------------------------------------------------------------- */

/** VESTARA Rewards 2× promo — artwork carries all copy. Source artwork is 1500×300. */
const REWARDS_ART = require("@/assets/home-banners/vestara-rewards-2x.webp");
const REWARDS_RATIO = 5;

function OfferStrip() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(main)/account/loyalty" as never)}
      style={({ pressed }) => [styles.offer, pressed && { opacity: 0.9 }]}
      accessibilityRole="link"
      accessibilityLabel="VESTARA Rewards. Earn 2x rewards on every order this week. View loyalty"
    >
      <Image source={REWARDS_ART} style={styles.offerImg} contentFit="cover" transition={200} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* Free delivery banner                                                  */
/* -------------------------------------------------------------------- */

/** Free island-wide delivery promo — artwork carries all copy and the CTA. */
const FREE_DELIVERY_ART = require("@/assets/home-banners/free-delivery.webp");
/** Source artwork is 1440×480. */
const FREE_DELIVERY_RATIO = 3;

function FreeDeliveryBanner() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(main)/products" as never)}
      style={({ pressed }) => [styles.fd, pressed && { opacity: 0.9 }]}
      accessibilityRole="link"
      accessibilityLabel="Good style, on the house. Free island-wide delivery on orders above LKR 10,000. Explore now"
    >
      <Image source={FREE_DELIVERY_ART} style={styles.fdImg} contentFit="cover" transition={200} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */

const styles = StyleSheet.create({
  // Full-bleed: edge to edge, no side margin or rounding.
  fd: {
    marginTop: 12,
    width: "100%",
    aspectRatio: FREE_DELIVERY_RATIO,
    backgroundColor: "#efeee6",
  },
  fdImg: {
    width: "100%",
    height: "100%",
  },

  topSparkles: {
    ...StyleSheet.absoluteFillObject,
    height: 230,
  },
  sparkDot: {
    position: "absolute",
    backgroundColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  offer: {
    marginTop: 12,
    width: "100%",
    aspectRatio: REWARDS_RATIO,
    backgroundColor: "#1b1040",
  },
  offerImg: {
    width: "100%",
    height: "100%",
  },
  root: {
    paddingBottom: 6,
  },
  center: { alignItems: "center", justifyContent: "center" },

  /* Tabs */
  tabsRow: {
    height: TAB_H,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 12,
    marginTop: 4,
  },
  tabsSvg: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  tab: {
    flex: 1,
    height: TAB_H,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    letterSpacing: 2,
    color: TAB_INK,
  },
  tabTextActive: {
    fontFamily: fontFamilies.sans.bold,
  },
  tabGrid: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: TAB_INK,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginBottom: 6,
  },
  gridDots: {
    width: 15,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  gridDot: {
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },

  /* Categories */
  catScroll: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  catItem: {
    width: 66,
    alignItems: "center",
  },
  catImgWrap: {
    width: CAT_SIZE,
    height: CAT_SIZE,
    borderRadius: CAT_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  catImg: {
    position: "absolute",
    left: 2,
    top: 2,
    right: 2,
    bottom: 2,
    borderRadius: CAT_SIZE / 2,
  },
  runwayRing: {
    width: CAT_SIZE,
    height: CAT_SIZE,
    borderRadius: CAT_SIZE / 2,
    padding: 2,
  },
  runwayGap: {
    flex: 1,
    borderRadius: CAT_SIZE / 2,
    backgroundColor: "#ffffff",
    padding: 2,
  },
  runwayInner: {
    position: "absolute",
    left: 2,
    top: 2,
    right: 2,
    bottom: 2,
    borderRadius: CAT_SIZE / 2,
  },
  runwayShade: {
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  runwayPlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  runwayLabel: {
    fontFamily: fontFamilies.sans.bold,
    color: "#be185d",
  },
  catImgWrapFirst: {
    borderColor: "#7c3aed",
  },
  catInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#6d28d9",
  },
  catLabel: {
    marginTop: 5,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: "#1f1235",
  },
  catLabelFirst: {
    fontFamily: fontFamilies.sans.bold,
    color: "#6d28d9",
  },

  /* Carousel */
  glowBlob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.28,
  },
  light: {
    position: "absolute",
    top: 0,
    alignItems: "center",
  },
  lightWire: {
    flex: 1,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  lightBulb: {
    width: 9,
    height: 9,
    borderRadius: 5,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  arch: {
    position: "absolute",
    bottom: 0,
    borderWidth: 3,
    borderBottomWidth: 0,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  archInner: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  lockup: {
    position: "absolute",
    alignItems: "center",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#ffffff",
  },
  saleTitle: {
    marginTop: 12,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -0.5,
    textAlign: "center",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  ribbon: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    transform: [{ skewX: "-8deg" }],
  },
  ribbonText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textAlign: "center",
  },
  shopBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: "#fff3c4",
  },
  shopBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
  },
  shopBtnIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  seal: {
    position: "absolute",
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderStyle: "dashed",
    transform: [{ rotate: "-10deg" }],
  },
  sealSmall: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8,
    letterSpacing: 1.4,
  },
  sealBig: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    lineHeight: 24,
  },
  heroWrap: {
    marginTop: 4,
  },
  heroCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: CARD_BORDER,
    backgroundColor: "#f3ece4",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(30,11,58,0.25)",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#1e0b3a",
  },
});
