/**
 * FestiveHero — marketplace-style sale cover for the home screen.
 *
 * Top to bottom:
 *   1. Department tabs (All / Men / Women / Kids) with a folder-style active tab.
 *   2. Category icon row — filtered by the active department.
 *   3. Full-bleed sale carousel: each slide is a saturated festive scene
 *      (royal blue, magenta, sunset, emerald) with sparkles, hanging lights,
 *      an arched photograph, a gold sale lockup, offer seal and Shop Now pill.
 *      Pages by swipe, auto-advances every 5s (paused while the user drags).
 *   4. Pager dots.
 *   5. "Powered by" board — featured brands as white wordmark cards with a
 *      gold frame on a purple sale board.
 *
 * CMS `bg_color` on a banner overrides its scene colour.
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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Banner, Brand, Category } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

const SLIDE_MS = 5000;

export type Dept = "all" | "men" | "women" | "kids";
const DEPTS: { key: Dept; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "men", label: "MEN" },
  { key: "women", label: "WOMEN" },
  { key: "kids", label: "KIDS" },
];

type Theme = {
  bg: [string, string, string];
  accent: string;
  ink: string;
  glow: string;
};

const THEMES: Theme[] = [
  { bg: ["#05124f", "#1546d8", "#0a2a8f"], accent: "#ffd66b", ink: "#0a1f73", glow: "#6fb6ff" },
  { bg: ["#ff5fa2", "#a3157a", "#2a0b63"], accent: "#ffd25e", ink: "#4a0d6b", glow: "#ff9bd2" },
  { bg: ["#ff8a00", "#ff4d4d", "#b3125f"], accent: "#fff1b8", ink: "#7a0b3a", glow: "#ffd08a" },
  { bg: ["#003b34", "#00876b", "#14b8a6"], accent: "#ffe08a", ink: "#003d33", glow: "#7cf5d9" },
];

function themeFor(b: Banner, i: number): Theme {
  const t = THEMES[i % THEMES.length];
  if (!b.bg_color) return t;
  return { ...t, bg: [b.bg_color, b.bg_color, "#000000"], accent: b.accent_color || t.accent };
}

function discountOf(b: Banner): number | null {
  const m = /(\d{1,2})\s*%/.exec(`${b.title} ${b.subtitle ?? ""}`);
  return m ? Number(m[1]) : null;
}

/** Sparkle positions as fractions of the slide. */
const SPARKLES: [number, number, number][] = [
  [0.06, 0.08, 14], [0.3, 0.05, 10], [0.55, 0.12, 16], [0.9, 0.06, 12],
  [0.78, 0.3, 9], [0.95, 0.5, 13], [0.62, 0.62, 10], [0.08, 0.92, 12],
  [0.45, 0.9, 9], [0.88, 0.88, 14],
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
      {brands.length > 0 && <PoweredBy brands={brands} />}
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
  all: { line: "#6b0f4f", bg: ["#f7a6cf", "#efb3e3", "#e9bdf2"] },
  men: { line: "#0b3d91", bg: ["#9ec2ff", "#b4d0ff", "#cfe0ff"] },
  women: { line: "#a3124f", bg: ["#ff9fbd", "#ffb8cf", "#ffd0e0"] },
  kids: { line: "#8a4b00", bg: ["#ffd36b", "#ffe08f", "#ffedb8"] },
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
      {list.map((c, i) => (
        <Pressable
          key={c.id}
          onPress={() => router.push(`/(main)/products?category=${c.slug}` as never)}
          style={({ pressed }) => [styles.catItem, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <View style={[styles.catImgWrap, i === 0 && { borderColor: DEPT_THEMES[dept].line }]}>
            {c.image_url ? (
              <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
              <LinearGradient colors={["#fde7f3", "#e9d5ff"]} style={[StyleSheet.absoluteFill, styles.center]}>
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

/* -------------------------------------------------------------------- */
/* Sale carousel                                                         */
/* -------------------------------------------------------------------- */

function SaleCarousel({ banners }: { banners: Banner[] }) {
  const { width } = useWindowDimensions();
  const height = Math.round(width * 0.78);
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const n = banners.length;

  const goTo = useCallback(
    (i: number) => {
      ref.current?.scrollTo({ x: i * width, animated: true });
      setIdx(i);
    },
    [width],
  );

  useEffect(() => {
    if (n < 2 || dragging) return;
    const t = setTimeout(() => goTo((idx + 1) % n), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, n, dragging, goTo]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.round(e.nativeEvent.contentOffset.x / width));
    setDragging(false);
  };

  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={onMomentumEnd}
        accessibilityLabel="Sale campaigns"
      >
        {banners.map((b, i) => (
          <SaleSlide key={b.id ?? i} banner={b} index={i} width={width} height={height} />
        ))}
      </ScrollView>

      {n > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <Pressable key={b.id ?? i} onPress={() => goTo(i)} hitSlop={6} accessibilityLabel={`Campaign ${i + 1}`}>
              <View style={[styles.dot, i === idx && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function SaleSlide({
  banner,
  index,
  width,
  height,
}: {
  banner: Banner;
  index: number;
  width: number;
  height: number;
}) {
  const router = useRouter();
  const t = themeFor(banner, index);
  const off = discountOf(banner);
  const title = (banner.title || "The Big Sale").replace(/[.,!]$/, "").toUpperCase();
  const subtitle = banner.subtitle?.replace(/[.,!]$/, "");
  const archW = width * 0.54;
  const archH = height * 0.8;
  // Size the title so its longest word fits on one line (no mid-word breaks).
  const lockupW = width * 0.43;
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length), 1);
  const titleSize = Math.min(36, Math.floor(lockupW / (longest * 0.72)));

  const open = () => router.push((banner.link || "/(main)/products") as never);

  return (
    <Pressable onPress={open} style={{ width, height }} accessibilityRole="link" accessibilityLabel={banner.title}>
      <LinearGradient colors={t.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Glows */}
      <View style={[styles.glowBlob, { backgroundColor: t.glow, left: -width * 0.25, top: height * 0.25, width: width * 0.8, height: width * 0.8 }]} />
      <View style={[styles.glowBlob, { backgroundColor: t.accent, right: -width * 0.2, bottom: -width * 0.3, width: width * 0.9, height: width * 0.9, opacity: 0.18 }]} />

      {/* Hanging lights */}
      {[0, 1, 2, 3, 4].map((k) => (
        <View key={k} style={[styles.light, { left: width * (0.1 + k * 0.2), height: [18, 34, 14, 28, 22][k] }]}>
          <View style={styles.lightWire} />
          <View style={[styles.lightBulb, { backgroundColor: t.accent, shadowColor: t.accent }]} />
        </View>
      ))}

      {/* Sparkles */}
      {SPARKLES.map(([x, y, s], k) => (
        <Ionicons
          key={k}
          name="sparkles"
          size={s}
          color={k % 3 === 0 ? t.accent : "#ffffff"}
          style={{ position: "absolute", left: x * width, top: y * height, opacity: 0.85 }}
        />
      ))}

      {/* Arched photograph — bottom left */}
      <View
        style={[
          styles.arch,
          { width: archW, height: archH, left: width * 0.02, borderTopLeftRadius: archW / 2, borderTopRightRadius: archW / 2, borderColor: t.accent, shadowColor: t.accent },
        ]}
      >
        <View style={[styles.archInner, { borderTopLeftRadius: archW / 2, borderTopRightRadius: archW / 2 }]}>
          {banner.image_url ? (
            <Image source={{ uri: banner.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={250} />
          ) : null}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.35)"]} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
        </View>
      </View>

      {/* Sale lockup — right */}
      <View style={[styles.lockup, { left: width * 0.56, width: lockupW, top: height * 0.1 }]}>
        <View style={styles.livePill}>
          <View style={[styles.liveDot, { backgroundColor: t.accent }]} />
          <Text style={styles.liveText}>VESTARA · LIVE NOW</Text>
        </View>
        <Text
          numberOfLines={3}
          style={[
            styles.saleTitle,
            { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.02), color: t.accent, textShadowColor: "rgba(0,0,0,0.45)" },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <View style={[styles.ribbon, { backgroundColor: t.accent }]}>
            <Text numberOfLines={2} style={[styles.ribbonText, { color: t.ink }]}>
              {subtitle.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <View style={[styles.shopBtn, { borderColor: t.accent }]}>
          <Text style={[styles.shopBtnText, { color: t.ink }]}>{banner.cta_text || "Shop Now"}</Text>
          <View style={[styles.shopBtnIcon, { backgroundColor: t.ink }]}>
            <Ionicons name="chevron-forward" size={12} color="#fff" />
          </View>
        </View>
      </View>

      {/* Offer seal */}
      {off !== null && (
        <View style={[styles.seal, { left: width * 0.42, top: height * 0.2, borderColor: t.ink }]}>
          <LinearGradient colors={["#ffffff", "#fff3c4", t.accent]} style={[StyleSheet.absoluteFill, { borderRadius: 999 }]} />
          <Text style={[styles.sealSmall, { color: t.ink }]}>UP TO</Text>
          <Text style={[styles.sealBig, { color: t.ink }]}>{off}%</Text>
          <Text style={[styles.sealSmall, { color: t.ink }]}>OFF</Text>
        </View>
      )}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* Powered-by board                                                      */
/* -------------------------------------------------------------------- */

const WORDMARK_STYLES = [
  { fontFamily: fontFamilies.display.semibold, fontStyle: "italic" as const, fontSize: 19, letterSpacing: -0.3 },
  { fontFamily: fontFamilies.sans.bold, fontSize: 12, letterSpacing: 3.2 },
  { fontFamily: fontFamilies.display.semibold, fontSize: 17, letterSpacing: 0.2 },
  { fontFamily: fontFamilies.sans.regular, fontSize: 12, letterSpacing: 4.5 },
];

function PoweredBy({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const list = brands.slice(0, 4);

  const card = (b: Brand, i: number) => (
    <Pressable
      key={b.id}
      onPress={() => router.push(`/(main)/products?brand=${b.slug}` as never)}
      style={({ pressed }) => [styles.brandCard, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <View style={styles.brandCardInner}>
        {b.logo_url ? (
          <Image source={{ uri: b.logo_url }} style={styles.brandLogo} contentFit="contain" />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[styles.brandName, WORDMARK_STYLES[i % WORDMARK_STYLES.length]]}
          >
            {i % 2 === 1 ? b.name.toUpperCase() : b.name}
          </Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <LinearGradient colors={["#c4b5fd", "#a78bfa", "#c4b5fd"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.board}>
      <View style={styles.boardRow}>
        <LinearGradient colors={["#7c3aed", "#4c1d95"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ribbonTag}>
          <Text style={styles.ribbonTagText}>POWERED BY</Text>
        </LinearGradient>
        {list.slice(0, 2).map((b, i) => card(b, i))}
      </View>
      {list.length > 2 && (
        <View style={styles.boardRow}>
          {list.slice(2, 4).map((b, i) => card(b, i + 2))}
          <LinearGradient colors={["#7c3aed", "#4c1d95"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.ribbonTag, styles.ribbonTagRight]}>
            <Text style={styles.ribbonTagText}>CO-POWERED BY</Text>
          </LinearGradient>
        </View>
      )}
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------- */
/* Offer strip                                                           */
/* -------------------------------------------------------------------- */

function OfferStrip() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(main)/account/loyalty" as never)}
      style={({ pressed }) => [styles.offer, pressed && { opacity: 0.85 }]}
      accessibilityRole="link"
      accessibilityLabel="Members earn 2x rewards this week"
    >
      <View style={styles.offerIcons}>
        <LinearGradient colors={["#f6b821", "#f0a224"]} style={styles.offerChip}>
          <Ionicons name="gift" size={15} color="#fff" />
        </LinearGradient>
        <LinearGradient colors={["#7c3aed", "#4c1d95"]} style={[styles.offerChip, { marginLeft: -6 }]}>
          <Text style={styles.offerChipText}>2×</Text>
        </LinearGradient>
      </View>
      <View style={styles.offerDivider} />
      <View style={{ flex: 1 }}>
        <Text style={styles.offerTitle}>
          Earn 2× Rewards <Text style={styles.offerStar}>*</Text>
        </Text>
        <Text numberOfLines={1} style={styles.offerSub}>On every order this week · VESTARA Rewards</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#6d28d9" />
      <Text style={styles.offerTc}>*T&C Apply</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* Free delivery banner                                                  */
/* -------------------------------------------------------------------- */

/** Order value above which the banner promises free delivery. */
const FREE_DELIVERY_MIN = 10000;

/** Bokeh circles: x%, y%, size, opacity. */
const BOKEH: [number, number, number, number][] = [
  [2, 10, 70, 0.18], [18, 70, 50, 0.12], [34, 0, 90, 0.1], [52, 75, 60, 0.14],
  [66, 5, 80, 0.1], [80, 60, 70, 0.14], [94, 15, 60, 0.16],
];

function FreeDeliveryBanner({ min = FREE_DELIVERY_MIN }: { min?: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(main)/products" as never)}
      style={({ pressed }) => [styles.fd, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="link"
      accessibilityLabel={`Free delivery on orders above ${formatPrice(min)}`}
    >
      <LinearGradient
        colors={["#c8162a", "#8a0d18", "#5c0812"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {BOKEH.map(([x, y, sz, o], k) => (
        <View
          key={k}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: sz,
            height: sz,
            borderRadius: sz / 2,
            backgroundColor: "#ff6b7a",
            opacity: o,
          }}
        />
      ))}

      {/* Illustration: truck badge, FREE stamp, parcel, road */}
      <View style={styles.fdArt}>
        <View style={styles.fdRoad} />
        <View style={styles.fdParcel}>
          <View style={styles.fdParcelTape} />
          <Ionicons name="cube-outline" size={14} color="#7a4a1a" />
        </View>
        <View style={styles.fdSpeed}>
          <View style={[styles.fdSpeedLine, { width: 14 }]} />
          <View style={[styles.fdSpeedLine, { width: 9, marginLeft: 5 }]} />
          <View style={[styles.fdSpeedLine, { width: 12 }]} />
        </View>
        <LinearGradient colors={["#ffffff", "#ffe4e6"]} style={styles.fdTruck}>
          <MaterialCommunityIcons name="truck-fast" size={32} color="#a50f1c" />
        </LinearGradient>
        <LinearGradient colors={["#fff6d8", "#ffd66b", "#f0a224"]} style={styles.fdStamp}>
          <Text style={styles.fdStampText}>FREE</Text>
        </LinearGradient>
      </View>

      <View style={styles.fdDivider} />

      <View style={styles.fdCopy}>
        <Text style={styles.fdTitle}>
          FREE DELIVERY<Text style={styles.fdStar}>*</Text>
        </Text>
        <Text style={styles.fdSub}>On orders above {formatPrice(min)}</Text>
        <Text style={styles.fdNote}>Island-wide · Tracked end to end</Text>
        <Text style={styles.fdCta}>SHOP NOW ›</Text>
      </View>

      <Text style={styles.fdTc}>*T&C APPLY</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */

const styles = StyleSheet.create({
  fd: {
    marginTop: 12,
    marginHorizontal: 10,
    minHeight: 124,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: "#78000f",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  fdArt: {
    width: 112,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  fdRoad: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  fdParcel: {
    position: "absolute",
    left: 4,
    bottom: 13,
    width: 26,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#d9a35f",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  fdParcelTape: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 10,
    height: 3,
    backgroundColor: "#f6dcae",
  },
  fdSpeed: {
    position: "absolute",
    left: 24,
    top: 34,
    gap: 4,
  },
  fdSpeedLine: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  fdTruck: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    marginLeft: 18,
  },
  fdStamp: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "12deg" }],
  },
  fdStampText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: "#7a0b14",
  },
  fdDivider: {
    width: 1.5,
    alignSelf: "stretch",
    marginVertical: 8,
    marginHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  fdCopy: {
    flex: 1,
    alignItems: "center",
  },
  fdTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 21,
    letterSpacing: -0.3,
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  fdStar: { fontSize: 13 },
  fdSub: {
    marginTop: 3,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: "#ffffff",
  },
  fdNote: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
  },
  fdCta: {
    marginTop: 7,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: "#ffffff",
    textDecorationLine: "underline",
  },
  fdTc: {
    position: "absolute",
    right: 10,
    bottom: 5,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 7,
    color: "rgba(255,255,255,0.6)",
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
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    shadowColor: "#4c1d95",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  offerIcons: { flexDirection: "row", alignItems: "center" },
  offerChip: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  offerChipText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: "#ffffff",
  },
  offerDivider: { width: 1.5, height: 30, backgroundColor: "#1f1235", opacity: 0.6 },
  offerTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    color: "#111111",
  },
  offerStar: { fontSize: 12 },
  offerSub: {
    marginTop: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: "#4b4458",
  },
  offerTc: {
    position: "absolute",
    right: 10,
    bottom: 4,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 7,
    color: "#8a8296",
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
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  catItem: {
    width: 74,
    alignItems: "center",
  },
  catImgWrap: {
    width: 70,
    height: 70,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#7c3aed",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  catImgWrapFirst: {
    borderColor: "#7c3aed",
  },
  catInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    color: "#6d28d9",
  },
  catLabel: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
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

  /* Powered by */
  board: {
    marginHorizontal: 10,
    borderRadius: 16,
    padding: 8,
    gap: 8,
  },
  boardRow: {
    flexDirection: "row",
    gap: 8,
  },
  ribbonTag: {
    width: 104,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 8,
  },
  ribbonTagRight: {
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  ribbonTagText: {
    textAlign: "center",
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: "#ffffff",
  },
  brandCard: {
    flex: 1,
    height: 54,
    borderRadius: 10,
    padding: 2,
    backgroundColor: "#f5c451",
    shadowColor: "#4c1d95",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  brandCardInner: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  brandLogo: { width: "80%", height: "60%" },
  brandName: {
    color: "#111111",
  },
});
