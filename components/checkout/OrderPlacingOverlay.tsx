import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useTheme } from "@/lib/theme";

/**
 * Full-screen "placing your order" moment. The checkout blurs back, a warm
 * glow rises from the Place order button and swirls low on the screen, and on
 * success it blooms over everything before the light settles into the app's
 * own paper theme with an olive, hand-drawn check.
 *
 *   placing    → blur + rising glow + cycling progress copy
 *   confirming → same stage, for the card-payment status poll
 *   success    → bloom fills screen → paper → check + order number
 */

export type OrderOverlayPhase = "idle" | "placing" | "confirming" | "success";

/** Keep the placing stage up at least this long so it never flickers. */
export const ORDER_OVERLAY_MIN_PLACING_MS = 1400;
/** How long the success stage holds before navigating away. */
export const ORDER_OVERLAY_SUCCESS_HOLD_MS = 2800;

type Origin = { x: number; y: number };

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** The placing stage is always night — the glow needs a dark stage to read. */
const INK = "#0e0f09";
const PAPER = colors.paper.DEFAULT;
const OCHRE = colors.accent2.ochre;

export function OrderPlacingOverlay({
  phase,
  origin,
  total,
  orderNumber,
  thumbnails = [],
  storeCount = 1,
}: {
  phase: OrderOverlayPhase;
  /** Window point the glow rises from — the centre of the Place order button. */
  origin?: Origin | null;
  total?: string;
  orderNumber?: string | null;
  thumbnails?: string[];
  storeCount?: number;
}) {
  if (phase === "idle") return null;
  return (
    <Animated.View
      exiting={FadeOut.duration(320)}
      style={styles.root}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      <OverlayBody
        phase={phase}
        origin={origin}
        total={total}
        orderNumber={orderNumber}
        thumbnails={thumbnails}
        storeCount={storeCount}
      />
    </Animated.View>
  );
}

function OverlayBody({
  phase,
  origin,
  total,
  orderNumber,
  thumbnails,
  storeCount,
}: {
  phase: Exclude<OrderOverlayPhase, "idle">;
  origin?: Origin | null;
  total?: string;
  orderNumber?: string | null;
  thumbnails: string[];
  storeCount: number;
}) {
  const reduce = useReducedMotion();
  const theme = useTheme().colors;
  const { width: w, height: h } = useWindowDimensions();
  const start = origin ?? { x: w / 2, y: h - 60 };

  // Success plays in two beats: the bloom, then the settle to paper + check.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (phase !== "success") {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), reduce ? 0 : 950);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  const blurIn = useSharedValue(0);
  const veil = useSharedValue(0);
  const toPaper = useSharedValue(0);
  const gx = useSharedValue(start.x);
  const gy = useSharedValue(start.y);
  const gs = useSharedValue(0.15);
  const go = useSharedValue(0);
  const leak = useSharedValue(0);

  useEffect(() => {
    blurIn.value = withTiming(1, { duration: 450, easing: EASE_OUT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "success" && !settled) {
      // Bloom: the glow swells over the whole screen and brightens.
      const d = reduce ? 0 : 1000;
      gx.value = withTiming(w / 2, { duration: d, easing: EASE_IN_OUT });
      gy.value = withTiming(h * 0.55, { duration: d, easing: EASE_IN_OUT });
      gs.value = withTiming(Math.max(w, h) / 165, { duration: d, easing: EASE_IN_OUT });
      go.value = withTiming(1, { duration: 300 });
      leak.value = withTiming(1, { duration: 300 });
      veil.value = withTiming(0.88, { duration: 300 });
    } else if (phase === "success" && settled) {
      // Settle: the light washes out into the app's paper background.
      const d = reduce ? 0 : 750;
      toPaper.value = withTiming(1, { duration: d, easing: EASE_OUT });
      veil.value = withTiming(1, { duration: d * 0.6, easing: EASE_OUT });
      go.value = withTiming(0, { duration: d, easing: EASE_OUT });
      gs.value = withTiming(Math.max(w, h) / 110, { duration: d, easing: EASE_OUT });
      leak.value = withTiming(0, { duration: d * 0.6 });
    } else {
      // Placing / confirming: the glow rises from the button and swirls low.
      const d = reduce ? 0 : 1400;
      gx.value = withTiming(w / 2, { duration: d, easing: EASE_OUT });
      gy.value = withTiming(h * 0.8, { duration: d, easing: EASE_OUT });
      gs.value = withTiming(1, { duration: d, easing: EASE_OUT });
      go.value = withTiming(1, { duration: 700 });
      veil.value = withTiming(0.82, { duration: 500, easing: EASE_OUT });
      leak.value = reduce
        ? withTiming(0.85, { duration: 600 })
        : withSequence(
            withTiming(1, { duration: 900, easing: EASE_OUT }),
            withRepeat(withTiming(0.6, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true),
          );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settled, w, h, reduce]);

  const bg = theme.background;
  const blurStyle = useAnimatedStyle(() => ({ opacity: blurIn.value }));
  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
    backgroundColor: interpolateColor(toPaper.value, [0, 1], [INK, bg]),
  }));
  // Position with left/top rather than translate: a translated zero-size
  // view drops its translation on Fabric and the glow pins to the corner.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: go.value,
    left: gx.value - 1,
    top: gy.value - 1,
    transform: [{ scale: gs.value }],
  }));
  const leakStyle = useAnimatedStyle(() => ({ opacity: leak.value }));

  const showCheck = phase === "success" && settled;

  return (
    <>
      <StatusBar style={showCheck ? "dark" : "light"} animated />

      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, veilStyle]} pointerEvents="none" />

      {/* Light leak — warm light spilling up from the bottom edge. */}
      <Animated.View style={[styles.leak, { height: h * 0.55 }, leakStyle]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(217,169,63,0)", "rgba(217,169,63,0.14)", "rgba(200,97,58,0.34)", "rgba(138,63,120,0.42)"]}
          locations={[0, 0.45, 0.8, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.glowField, glowStyle]} pointerEvents="none">
        <GlowCluster reduce={reduce} />
        <Core reduce={reduce} intense={phase === "success"} />
      </Animated.View>

      {!showCheck && !reduce && <Motes w={w} h={h} />}

      <View style={styles.content} pointerEvents="none">
        {phase === "placing" && (
          <PlacingContent
            key="placing"
            title="Placing your order"
            steps={[
              "Checking availability",
              "Reserving your pieces",
              storeCount > 1 ? `Confirming with ${storeCount} stores` : "Confirming with the store",
              "Securing your order",
            ]}
            total={total}
            thumbnails={thumbnails}
            reduce={reduce}
          />
        )}
        {phase === "confirming" && (
          <PlacingContent
            key="confirming"
            title="Confirming payment"
            steps={["Checking with your bank", "Almost there"]}
            total={total}
            thumbnails={thumbnails}
            reduce={reduce}
          />
        )}
        {showCheck && <SuccessContent orderNumber={orderNumber} total={total} reduce={reduce} />}
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ glow */

type BlobSpec = { color: string; size: number; dx: number; dy: number; drift: [number, number]; dur: number };

// Brand olive/ochre/rust, pushed warmer and more saturated so they read as
// light rather than paint against the dark stage.
const BLOBS: BlobSpec[] = [
  { color: "#a8b85a", size: 430, dx: -110, dy: 10, drift: [50, -40], dur: 6400 },
  { color: "#e0ad3e", size: 390, dx: 95, dy: -35, drift: [-45, 35], dur: 5400 },
  { color: "#d0613a", size: 370, dx: 60, dy: 85, drift: [-40, -30], dur: 7200 },
  { color: "#8f3f7c", size: 410, dx: -150, dy: 110, drift: [45, -25], dur: 8400 },
  { color: "#f08a62", size: 300, dx: 150, dy: 60, drift: [-30, -40], dur: 6000 },
];

function RadialDisc({
  id,
  size,
  color,
  stops = [1, 0.62, 0.16],
}: {
  id: string;
  size: number;
  color: string;
  /** Opacity at the centre, at 35% and at 70% of the radius. */
  stops?: [number, number, number];
}) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={stops[0]} />
          <Stop offset="0.35" stopColor={color} stopOpacity={stops[1]} />
          <Stop offset="0.7" stopColor={color} stopOpacity={stops[2]} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** The coloured blobs, drifting individually while the cluster slowly turns. */
function GlowCluster({ reduce }: { reduce: boolean }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    spin.value = withRepeat(withTiming(360, { duration: 26000, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  return (
    <Animated.View style={[styles.cluster, style]}>
      {BLOBS.map((b, i) => (
        <Blob key={i} id={`opo-blob-${i}`} {...b} reduce={reduce} />
      ))}
    </Animated.View>
  );
}

function Blob({ id, color, size, dx, dy, drift, dur, reduce }: BlobSpec & { id: string; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.85 + 0.15 * t.value,
    transform: [
      { translateX: dx + drift[0] * t.value },
      { translateY: dy + drift[1] * t.value },
      { scale: 0.95 + 0.2 * t.value },
    ],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: -size / 2, top: -size / 2, width: size, height: size }, style]}>
      <RadialDisc id={id} size={size} color={color} />
    </Animated.View>
  );
}

/** Warm core with a white-hot centre — breathes while placing, flares into the bloom. */
function Core({ reduce, intense }: { reduce: boolean; intense: boolean }) {
  const s = useSharedValue(0.9);
  const o = useSharedValue(0.7);
  useEffect(() => {
    if (intense) {
      s.value = withTiming(1.9, { duration: 900, easing: EASE_OUT });
      o.value = withTiming(1, { duration: 400 });
    } else if (!reduce) {
      s.value = withRepeat(withTiming(1.12, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
      o.value = withRepeat(withTiming(0.95, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intense, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: -20 }, { scale: s.value }] }));
  return (
    <Animated.View style={[styles.cluster, style]}>
      <View style={{ position: "absolute", left: -150, top: -150, width: 300, height: 300 }}>
        <RadialDisc id="opo-core" size={300} color="#fbe7bf" stops={[0.95, 0.6, 0.14]} />
      </View>
      <View style={{ position: "absolute", left: -75, top: -75, width: 150, height: 150 }}>
        <RadialDisc id="opo-hot" size={150} color="#fffaf0" stops={[0.95, 0.55, 0.1]} />
      </View>
    </Animated.View>
  );
}

/** Tiny motes of light drifting up out of the glow. */
function Motes({ w, h }: { w: number; h: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        x: w * (0.12 + ((i * 0.37) % 0.76)),
        size: 2 + (i % 3),
        delay: i * 380,
        dur: 4200 + (i % 4) * 700,
        rise: h * (0.32 + (i % 3) * 0.08),
      })),
    [w, h],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {motes.map((m, i) => (
        <Mote key={i} {...m} baseY={h * 0.9} />
      ))}
    </View>
  );
}

function Mote({ x, size, delay, dur, rise, baseY }: { x: number; size: number; delay: number; dur: number; rise: number; baseY: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.2 ? p.value * 4 : (1 - p.value) * 0.9,
    transform: [{ translateY: -rise * p.value }, { translateX: Math.sin(p.value * 6) * 8 }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          top: baseY,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: "#fff3d6",
          shadowColor: "#ffd98a",
          shadowOpacity: 0.9,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

/* --------------------------------------------------------------- placing */

function PlacingContent({
  title,
  steps,
  total,
  thumbnails,
  reduce,
}: {
  title: string;
  steps: string[];
  total?: string;
  thumbnails: string[];
  reduce: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= steps.length - 1) return;
    const t = setTimeout(() => setI((n) => n + 1), 1500);
    return () => clearTimeout(t);
  }, [i, steps.length]);

  const thumbs = thumbnails.slice(0, 3);

  return (
    <Animated.View
      entering={FadeIn.duration(500).delay(150)}
      exiting={FadeOut.duration(250)}
      style={styles.center}
    >
      {thumbs.length > 0 && (
        <View style={styles.fan}>
          {thumbs.map((uri, idx) => (
            <FanCard key={uri + idx} uri={uri} offset={idx - (thumbs.length - 1) / 2} index={idx} reduce={reduce} />
          ))}
        </View>
      )}

      <Spinner reduce={reduce} />

      <Text style={styles.title}>{title}</Text>

      <View style={styles.stepSlot}>
        <Animated.Text
          key={`${title}-${i}`}
          entering={FadeInDown.duration(420)}
          exiting={FadeOutUp.duration(300)}
          style={styles.step}
        >
          {steps[i]}…
        </Animated.Text>
      </View>

      {total ? (
        <View style={styles.totalPill}>
          <Text style={styles.totalText}>{total}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function FanCard({ uri, offset, index, reduce }: { uri: string; offset: number; index: number; reduce: boolean }) {
  const p = useSharedValue(0);
  const f = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(250 + index * 80, withTiming(1, { duration: 800, easing: EASE_OUT }));
    if (!reduce) {
      f.value = withDelay(
        index * 400,
        withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    zIndex: 10 - Math.abs(offset),
    transform: [
      { translateX: offset * 42 * p.value },
      { translateY: (1 - p.value) * 24 + Math.abs(offset) * 6 - f.value * 6 },
      { rotate: `${offset * 8 * p.value}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.fanCard, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
    </Animated.View>
  );
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

function Spinner({ reduce }: { reduce: boolean }) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    r.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View style={styles.spinner}>
      <Svg width={44} height={44} style={StyleSheet.absoluteFill}>
        <Circle cx={22} cy={22} r={19} fill="none" stroke="rgba(245,244,239,0.12)" strokeWidth={2} />
      </Svg>
      <AnimatedSvg width={44} height={44} style={[StyleSheet.absoluteFill, style]}>
        <Defs>
          <SvgLinearGradient id="opo-arc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={PAPER} />
            <Stop offset="1" stopColor={OCHRE} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={22}
          cy={22}
          r={19}
          fill="none"
          stroke="url(#opo-arc)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="72 120"
        />
      </AnimatedSvg>
    </View>
  );
}

/* --------------------------------------------------------------- success */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const RING_R = 46;
const RING_LEN = 2 * Math.PI * RING_R;
const CHECK_LEN = 56;

function SuccessContent({
  orderNumber,
  total,
  reduce,
}: {
  orderNumber?: string | null;
  total?: string;
  reduce: boolean;
}) {
  const theme = useTheme().colors;
  const ring = useSharedValue(reduce ? 1 : 0);
  const disc = useSharedValue(reduce ? 1 : 0);
  const tick = useSharedValue(reduce ? 1 : 0);
  const halo = useSharedValue(0);
  const bar = useSharedValue(0);

  useEffect(() => {
    if (!reduce) {
      ring.value = withTiming(1, { duration: 650, easing: EASE_IN_OUT });
      disc.value = withDelay(380, withSpring(1, { damping: 11, stiffness: 140, mass: 0.8 }));
      tick.value = withDelay(620, withTiming(1, { duration: 420, easing: EASE_OUT }));
    }
    halo.value = withDelay(300, withTiming(1, { duration: 900, easing: EASE_OUT }));
    bar.value = withDelay(1300, withTiming(1, { duration: 1500, easing: Easing.linear }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LEN * (1 - ring.value) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - tick.value) }));
  const discStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, disc.value * 1.5), transform: [{ scale: disc.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value, transform: [{ scale: 0.6 + 0.4 * halo.value }] }));
  const barStyle = useAnimatedStyle(() => ({ width: 160 * bar.value }));

  return (
    <View style={styles.center}>
      <View style={styles.checkWrap}>
        <Animated.View style={[styles.halo, haloStyle]}>
          <RadialDisc id="opo-halo" size={220} color={colors.olive[300]} stops={[0.5, 0.28, 0.08]} />
        </Animated.View>
        {!reduce &&
          [0, 1].map((n) => <EchoRing key={n} delay={560 + n * 340} color={theme.primary} />)}
        {/* Drawn ring */}
        <Svg width={104} height={104} viewBox="0 0 104 104" style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={52}
            cy={52}
            r={RING_R}
            fill="none"
            stroke={theme.primary}
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray={`${RING_LEN} ${RING_LEN}`}
            transform="rotate(-90 52 52)"
            animatedProps={ringProps}
          />
        </Svg>
        {/* Olive disc springs in, check draws on top */}
        <Animated.View style={[styles.disc, { backgroundColor: theme.primary }, discStyle]}>
          <Svg width={80} height={80} viewBox="8 8 80 80">
            <AnimatedPath
              d="M30 49.5 L42.5 62 L66 36"
              fill="none"
              stroke={theme.primaryForeground}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
              animatedProps={tickProps}
            />
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.successTitleRow}>
        {["Order", "placed"].map((word, idx) => (
          <Animated.Text
            key={word}
            entering={FadeInDown.duration(700).delay(720 + idx * 110)}
            style={[styles.successTitle, { color: theme.foreground }]}
          >
            {word}
          </Animated.Text>
        ))}
      </View>

      <Animated.Text
        entering={FadeInDown.duration(600).delay(1020)}
        style={[styles.successSub, { color: theme.mutedForeground }]}
      >
        {orderNumber ? (
          <>
            Order <Text style={[styles.successNumber, { color: theme.foreground }]}>#{orderNumber}</Text>
            {total ? ` · ${total}` : ""}
          </>
        ) : (
          "Thank you — we're on it."
        )}
      </Animated.Text>

      <Animated.View entering={FadeIn.duration(500).delay(1300)} style={styles.handoff}>
        <Text style={[styles.handoffLabel, { color: theme.mutedForeground }]}>OPENING YOUR CONFIRMATION</Text>
        <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
          <Animated.View style={[styles.barFill, barStyle]}>
            <LinearGradient
              colors={[colors.olive[500], theme.primary, OCHRE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: 160, height: 2 }}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

function EchoRing({ delay, color }: { delay: number; color: string }) {
  const s = useSharedValue(0.7);
  const o = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(delay, withTiming(2.3, { duration: 1600, easing: EASE_OUT }));
    o.value = withDelay(
      delay,
      withSequence(withTiming(0.45, { duration: 300 }), withTiming(0, { duration: 1300, easing: EASE_OUT })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[styles.echo, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    elevation: 60,
    overflow: "hidden",
  },
  leak: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  glowField: {
    position: "absolute",
    width: 2,
    height: 2,
  },
  cluster: {
    position: "absolute",
    left: 1,
    top: 1,
    width: 0,
    height: 0,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  center: {
    alignItems: "center",
  },
  fan: {
    width: 180,
    height: 104,
    marginBottom: 36,
    alignItems: "center",
  },
  fanCard: {
    position: "absolute",
    top: 0,
    width: 76,
    height: 102,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  spinner: {
    width: 44,
    height: 44,
  },
  title: {
    marginTop: 26,
    fontFamily: fontFamilies.display.regular,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: PAPER,
    textAlign: "center",
  },
  stepSlot: {
    marginTop: 8,
    height: 22,
    width: 280,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  step: {
    position: "absolute",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: "rgba(245,244,239,0.6)",
  },
  totalPill: {
    marginTop: 30,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  totalText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    letterSpacing: 2.4,
    color: "rgba(245,244,239,0.6)",
  },
  checkWrap: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 220,
    height: 220,
    left: -58,
    top: -58,
  },
  disc: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.olive[700],
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  echo: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
  },
  successTitleRow: {
    marginTop: 34,
    flexDirection: "row",
    gap: 10,
  },
  successTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.8,
  },
  successSub: {
    marginTop: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    textAlign: "center",
  },
  successNumber: {
    fontFamily: fontFamilies.mono.regular,
  },
  handoff: {
    marginTop: 40,
    alignItems: "center",
    gap: 12,
  },
  handoffLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    letterSpacing: 2.6,
    opacity: 0.8,
  },
  barTrack: {
    width: 160,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  barFill: {
    height: 2,
    overflow: "hidden",
  },
});
