/**
 * CascadeLaunch — "save it all" launch sequence shown once per cold start.
 *
 * Beats (one shared UI-thread clock drives every layer, ≈6s):
 *   0.08s  cream canvas, Vestara app icon centred — the camera dives into it
 *          and its ink floods the screen dark olive
 *   0.38s  the first look pops in at the top; its save badge pulses
 *   1.15s  more looks land one after another, cascading down the screen;
 *          older ones recede into depth (shrink, drift up, dim)
 *   2.80s  the white stitched-V mark pops in at the bottom
 *   3.25s  warp: the front look drops into the mark, then neon light-streaks
 *          fan out and the pile + a stream of further looks rush down
 *          straight radial lines into it — shrinking with perspective,
 *          smeared by blurred trailing copies; the mark swells with each catch
 *   5.45s  the mark glides up to centre and rests
 *   exit   once the app is `ready`, the overlay dissolves into the app
 *
 * Photos are bundled (assets/launch, Unsplash, ~20 KB each) so the sequence
 * plays offline with no network at cold start.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { V_ASPECT, V_PATH, V_STITCHES, V_VIEWBOX } from "@/components/brand/BrandMark";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

/** Cream the screen starts on — matches the native splash background. */
export const LAUNCH_BG = "#fff7f1";
// Dark olive (web olive-950): the app icon's ink floods into this night, so they must match.
const INK = "#161a0a";

/* ─── Photos (require + average colour for the streak trails) ───────────── */
/* src = sharp, soft = gaussian-blurred (in flight), smear = baked vertical
 * motion blur (rotated onto each radial trail). */
const LOOKS: { src: number; soft: number; smear: number; tint: string }[] = [
  {
    src: require("@/assets/launch/look-01.jpg"),
    soft: require("@/assets/launch/look-01-soft.jpg"),
    smear: require("@/assets/launch/look-01-smear.jpg"),
    tint: "#b1935f",
  },
  {
    src: require("@/assets/launch/look-02.jpg"),
    soft: require("@/assets/launch/look-02-soft.jpg"),
    smear: require("@/assets/launch/look-02-smear.jpg"),
    tint: "#bbb1a7",
  },
  {
    src: require("@/assets/launch/look-03.jpg"),
    soft: require("@/assets/launch/look-03-soft.jpg"),
    smear: require("@/assets/launch/look-03-smear.jpg"),
    tint: "#188475",
  },
  {
    src: require("@/assets/launch/look-04.jpg"),
    soft: require("@/assets/launch/look-04-soft.jpg"),
    smear: require("@/assets/launch/look-04-smear.jpg"),
    tint: "#a5837d",
  },
  {
    src: require("@/assets/launch/look-05.jpg"),
    soft: require("@/assets/launch/look-05-soft.jpg"),
    smear: require("@/assets/launch/look-05-smear.jpg"),
    tint: "#7d6d4a",
  },
  {
    src: require("@/assets/launch/look-06.jpg"),
    soft: require("@/assets/launch/look-06-soft.jpg"),
    smear: require("@/assets/launch/look-06-smear.jpg"),
    tint: "#b4a777",
  },
  {
    src: require("@/assets/launch/look-07.jpg"),
    soft: require("@/assets/launch/look-07-soft.jpg"),
    smear: require("@/assets/launch/look-07-smear.jpg"),
    tint: "#9ec7da",
  },
  {
    src: require("@/assets/launch/look-08.jpg"),
    soft: require("@/assets/launch/look-08-soft.jpg"),
    smear: require("@/assets/launch/look-08-smear.jpg"),
    tint: "#b88c65",
  },
  {
    src: require("@/assets/launch/look-09.jpg"),
    soft: require("@/assets/launch/look-09-soft.jpg"),
    smear: require("@/assets/launch/look-09-smear.jpg"),
    tint: "#9a8a83",
  },
  {
    src: require("@/assets/launch/look-10.jpg"),
    soft: require("@/assets/launch/look-10-soft.jpg"),
    smear: require("@/assets/launch/look-10-smear.jpg"),
    tint: "#ba6743",
  },
  {
    src: require("@/assets/launch/look-11.jpg"),
    soft: require("@/assets/launch/look-11-soft.jpg"),
    smear: require("@/assets/launch/look-11-smear.jpg"),
    tint: "#b57765",
  },
  {
    src: require("@/assets/launch/look-12.jpg"),
    soft: require("@/assets/launch/look-12-soft.jpg"),
    smear: require("@/assets/launch/look-12-smear.jpg"),
    tint: "#d0c8bb",
  },
  {
    src: require("@/assets/launch/look-13.jpg"),
    soft: require("@/assets/launch/look-13-soft.jpg"),
    smear: require("@/assets/launch/look-13-smear.jpg"),
    tint: "#bfb3a9",
  },
  {
    src: require("@/assets/launch/look-14.jpg"),
    soft: require("@/assets/launch/look-14-soft.jpg"),
    smear: require("@/assets/launch/look-14-smear.jpg"),
    tint: "#9d9b9b",
  },
  {
    src: require("@/assets/launch/look-15.jpg"),
    soft: require("@/assets/launch/look-15-soft.jpg"),
    smear: require("@/assets/launch/look-15-smear.jpg"),
    tint: "#b5b0b3",
  },
  {
    src: require("@/assets/launch/look-16.jpg"),
    soft: require("@/assets/launch/look-16-soft.jpg"),
    smear: require("@/assets/launch/look-16-smear.jpg"),
    tint: "#6c7771",
  },
  {
    src: require("@/assets/launch/look-17.jpg"),
    soft: require("@/assets/launch/look-17-soft.jpg"),
    smear: require("@/assets/launch/look-17-smear.jpg"),
    tint: "#afa59a",
  },
  {
    src: require("@/assets/launch/look-18.jpg"),
    soft: require("@/assets/launch/look-18-soft.jpg"),
    smear: require("@/assets/launch/look-18-smear.jpg"),
    tint: "#6d737b",
  },
  {
    src: require("@/assets/launch/look-20.jpg"),
    soft: require("@/assets/launch/look-20-soft.jpg"),
    smear: require("@/assets/launch/look-20-smear.jpg"),
    tint: "#938d8a",
  },
  {
    src: require("@/assets/launch/look-21.jpg"),
    soft: require("@/assets/launch/look-21-soft.jpg"),
    smear: require("@/assets/launch/look-21-smear.jpg"),
    tint: "#836b6d",
  },
  {
    src: require("@/assets/launch/look-22.jpg"),
    soft: require("@/assets/launch/look-22-soft.jpg"),
    smear: require("@/assets/launch/look-22-smear.jpg"),
    tint: "#969592",
  },
  {
    src: require("@/assets/launch/look-23.jpg"),
    soft: require("@/assets/launch/look-23-soft.jpg"),
    smear: require("@/assets/launch/look-23-smear.jpg"),
    tint: "#9e8c7d",
  },
  {
    src: require("@/assets/launch/look-24.jpg"),
    soft: require("@/assets/launch/look-24-soft.jpg"),
    smear: require("@/assets/launch/look-24-smear.jpg"),
    tint: "#585146",
  },
  {
    src: require("@/assets/launch/look-25.jpg"),
    soft: require("@/assets/launch/look-25-soft.jpg"),
    smear: require("@/assets/launch/look-25-smear.jpg"),
    tint: "#9f898d",
  },
  {
    src: require("@/assets/launch/look-26.jpg"),
    soft: require("@/assets/launch/look-26-soft.jpg"),
    smear: require("@/assets/launch/look-26-smear.jpg"),
    tint: "#69655e",
  },
  {
    src: require("@/assets/launch/look-27.jpg"),
    soft: require("@/assets/launch/look-27-soft.jpg"),
    smear: require("@/assets/launch/look-27-smear.jpg"),
    tint: "#50596f",
  },
  {
    src: require("@/assets/launch/look-28.jpg"),
    soft: require("@/assets/launch/look-28-soft.jpg"),
    smear: require("@/assets/launch/look-28-smear.jpg"),
    tint: "#d1b79d",
  },
  {
    src: require("@/assets/launch/look-29.jpg"),
    soft: require("@/assets/launch/look-29-soft.jpg"),
    smear: require("@/assets/launch/look-29-smear.jpg"),
    tint: "#e5cdc4",
  },
];

/* The cascading pile: centre (x, y) and width as fractions of the screen,
 * a = height / width. Order = order of arrival. */
const STACK = [
  { img: 0, x: 0.4, y: 0.13, w: 0.3, a: 1.05 },
  { img: 1, x: 0.56, y: 0.25, w: 0.36, a: 0.75 },
  { img: 2, x: 0.27, y: 0.39, w: 0.38, a: 0.95 },
  { img: 3, x: 0.43, y: 0.46, w: 0.26, a: 1.35 },
  { img: 4, x: 0.7, y: 0.36, w: 0.44, a: 0.62 },
  { img: 5, x: 0.71, y: 0.52, w: 0.42, a: 1.05 },
  { img: 6, x: 0.46, y: 0.62, w: 0.44, a: 0.8 },
  { img: 7, x: 0.24, y: 0.56, w: 0.38, a: 1.0 },
  { img: 8, x: 0.55, y: 0.52, w: 0.4, a: 1.05 },
  { img: 9, x: 0.73, y: 0.63, w: 0.4, a: 0.82 },
  { img: 10, x: 0.5, y: 0.76, w: 0.3, a: 0.88 },
] as const;
const N_STACK = STACK.length;
const N_EXTRA = 34;
const N_RAYS = 40;
const extraLook = (k: number) => LOOKS[N_STACK + (k % (LOOKS.length - N_STACK))];

/* ─── Timeline (ms) ─────────────────────────────────────────────────────── */
const T = {
  dive: [80, 320] as const,
  first: [380, 560] as const,
  badge: [940, 380] as const,
  cardStart: 1150,
  cardStep: 140,
  cardDur: 440,
  logoPop: [2800, 340] as const,
  pullStart: 3250,
  pullStep: 115,
  streamStart: 3550,
  streamEnd: 5150,
  glide: [5450, 560] as const,
  minShow: 6100,
  exit: 420,
};
const TOTAL = T.minShow;

const CARD_START: number[] = STACK.map((_, i) => (i === 0 ? T.first[0] : T.cardStart + (i - 1) * T.cardStep));
const CARD_DUR: number[] = STACK.map((_, i) => (i === 0 ? T.first[1] : T.cardDur));

/* Stitched-V mark, shared with BrandMark (viewBox V_VIEWBOX, aspect V_ASPECT) */
const MARK = V_PATH;

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/* ─── Worklet helpers ───────────────────────────────────────────────────── */
function seg(t: number, start: number, dur: number) {
  "worklet";
  const p = (t - start) / dur;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}
function easeOutCubic(p: number) {
  "worklet";
  return 1 - (1 - p) * (1 - p) * (1 - p);
}
function easeInOutCubic(p: number) {
  "worklet";
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
function easeOutBack(p: number) {
  "worklet";
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
/** Gentle start, hard finish — the "sucked in" curve. */
function warp(p: number) {
  "worklet";
  return p * p * (1.6 - 0.6 * p);
}

/** How many newer cards have landed on top of card `i` (fractional). */
function depthOf(t: number, i: number) {
  "worklet";
  let d = 0;
  for (let j = i + 1; j < N_STACK; j++) d += easeOutCubic(seg(t, CARD_START[j], CARD_DUR[j]));
  return d;
}

const HIDDEN = { opacity: 0, transform: [{ translateX: -9999 }, { translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }] };

/* ─── Warp: flights down radial lines into the mark ─────────────────────── */
type Flight = {
  at: number;
  dur: number;
  x0: number; // take-off centre
  y0: number;
  w: number; // on-screen size at take-off
  h: number;
  fadeIn: boolean;
  ux: number; // unit vector from the mark out toward the take-off point
  uy: number;
};
type Geometry = { width: number; height: number; logoX: number; logoY: number };

/** A light streak: a thin neon line rushing along a radial toward the mark. */
type Ray = { at: number; dur: number; angle: number; r0: number; len: number; thick: number; color: string };
const RAY_COLORS = ["#ff6a2b", "#ff2f8e", "#b44dff", "#ffb21c", "#ff4d4d", "#ff8fd0", "#7a5cff"];

function unit(dx: number, dy: number) {
  const l = Math.hypot(dx, dy) || 1;
  return { ux: dx / l, uy: dy / l };
}

function buildFlights(g: Geometry) {
  const stack: Flight[] = STACK.map((s, i) => {
    const d = N_STACK - 1 - i;
    const k = Math.max(0.62, 1 - 0.035 * d);
    const order = N_STACK - 1 - i; // front card leaves first
    return {
      at: T.pullStart + (order === 0 ? 0 : 220 + (order - 1) * T.pullStep + rand(i + 7) * 50),
      dur: order === 0 ? 380 : 620 + rand(i + 19) * 140,
      x0: s.x * g.width,
      y0: s.y * g.height - d * 0.006 * g.height,
      w: s.w * g.width * k,
      h: s.w * g.width * s.a * k,
      fadeIn: false,
      ...unit(s.x * g.width - g.logoX, s.y * g.height - d * 0.006 * g.height - g.logoY),
    };
  });

  // Further looks pour in from a funnel that opens upward from the mark.
  const extra: Flight[] = [];
  const span = T.streamEnd - T.streamStart;
  const reach = Math.hypot(g.width / 2, g.logoY) * 1.02;
  for (let k = 0; k < N_EXTRA; k++) {
    const r1 = rand(k + 41);
    const r2 = rand(k + 83);
    const r3 = rand(k + 127);
    // Alternate sides so the funnel fills evenly; bias toward the steep middle.
    const side = k % 2 === 0 ? -1 : 1;
    const spreadDeg = 4 + Math.pow(r1, 0.85) * 34; // 4°..38° off vertical
    const angle = ((-90 + side * spreadDeg) * Math.PI) / 180;
    const r0 = reach * (0.55 + r2 * 0.45);
    const w = g.width * (0.2 + r3 * 0.2);
    extra.push({
      at: T.streamStart + (k / N_EXTRA) * span + (r2 - 0.5) * 80,
      dur: 640 + r3 * 260,
      x0: g.logoX + Math.cos(angle) * r0,
      y0: g.logoY + Math.sin(angle) * r0,
      w,
      h: w * (0.8 + rand(k + 211) * 0.45),
      fadeIn: true,
      ux: Math.cos(angle),
      uy: Math.sin(angle),
    });
  }

  const rays: Ray[] = [];
  const rayStart = T.pullStart + 280;
  const raySpan = T.streamEnd + 250 - rayStart;
  for (let k = 0; k < N_RAYS; k++) {
    const r1 = rand(k + 501);
    const r2 = rand(k + 607);
    const side = k % 2 === 0 ? -1 : 1;
    const spreadDeg = 3 + r1 * 44;
    rays.push({
      at: rayStart + (k / N_RAYS) * raySpan + (r2 - 0.5) * 120,
      dur: 380 + r2 * 220,
      angle: ((-90 + side * spreadDeg) * Math.PI) / 180,
      r0: reach * (0.75 + r2 * 0.35),
      len: g.height * (0.14 + r1 * 0.2),
      thick: 2.5 + r2 * 3,
      color: RAY_COLORS[k % RAY_COLORS.length],
    });
  }
  return { stack, extra, rays };
}

/**
 * Pose of a flight at time t for a box of size (bw, bh). Straight line into
 * the mark, accelerating, scale proportional to remaining distance (a
 * perspective funnel). Images stay upright.
 */
function flightPose(t: number, f: Flight, g: Geometry, lag: number, bw: number, bh: number, grow: number) {
  "worklet";
  const p = seg(t - lag, f.at, f.dur);
  if (p <= 0 || p >= 1) return HIDDEN;
  const q = Math.pow(p, 2.1);
  const x = f.x0 + (g.logoX - f.x0) * q;
  const y = f.y0 + (g.logoY - f.y0) * q;
  const s = Math.pow(1 - q, 0.9) * grow;
  let o = 1;
  if (f.fadeIn) o = Math.min(1, p * 6);
  if (q > 0.9) o *= (1 - q) / 0.1;
  const k = f.w / bw;
  return {
    opacity: o,
    transform: [{ translateX: x - bw / 2 }, { translateY: y - bh / 2 }, { scaleX: k * s }, { scaleY: k * s }],
  };
}

/* ─── Pieces ────────────────────────────────────────────────────────────── */
function StackCard({ i, clock, g, flight }: { i: number; clock: SharedValue<number>; g: Geometry; flight: Flight }) {
  const s = STACK[i];
  const w = s.w * g.width;
  const h = w * s.a;
  const start = CARD_START[i];
  const dur = CARD_DUR[i];

  const style = useAnimatedStyle(() => {
    const t = clock.value;
    if (t >= flight.at) return flightPose(t, flight, g, 0, w, h, 1);
    const p = seg(t, start, dur);
    if (p <= 0) return HIDDEN;
    const d = depthOf(t, i);
    const k = Math.max(0.62, 1 - 0.035 * d);
    const pop = i === 0 ? 0.25 + 0.75 * easeOutBack(p) : 0.6 + 0.4 * easeOutBack(p);
    const lift = (1 - easeOutCubic(p)) * (i === 0 ? -10 : 18);
    const sc = k * pop;
    return {
      opacity: Math.min(1, p * 3),
      transform: [
        { translateX: s.x * g.width - w / 2 },
        { translateY: s.y * g.height - h / 2 - d * 0.006 * g.height + lift },
        { scaleX: sc },
        { scaleY: sc },
      ],
    };
  });
  const dim = useAnimatedStyle(() => ({ opacity: Math.min(0.62, depthOf(clock.value, i) * 0.075) }));
  // Loses focus as it starts to move — the reference blurs the pile in flight.
  const soften = useAnimatedStyle(() => ({ opacity: Math.min(1, seg(clock.value, flight.at, flight.dur) * 4) }));

  return (
    <Animated.View style={[styles.card, { width: w, height: h, borderRadius: Math.min(w, h) * 0.1 }, style]}>
      <Image source={LOOKS[s.img].src} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      <Animated.View style={[StyleSheet.absoluteFill, soften]}>
        <Image source={LOOKS[s.img].soft} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: INK }, dim]} />
      {i === 0 ? <SaveBadge clock={clock} /> : null}
    </Animated.View>
  );
}

function SaveBadge({ clock }: { clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = seg(clock.value, T.badge[0], T.badge[1]);
    return { transform: [{ scale: 1 + Math.sin(p * Math.PI) * 0.45 }] };
  });
  const fill = useAnimatedStyle(() => ({ opacity: seg(clock.value, T.badge[0] + 80, 160) }));
  return (
    <Animated.View style={[styles.badge, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.badgeFill, fill]} />
      <Svg width={14} height={14 * V_ASPECT} viewBox={V_VIEWBOX}>
        <Path d={MARK} fill="#ffffff" />
      </Svg>
    </Animated.View>
  );
}

function ExtraCard({ k, clock, g, flight }: { k: number; clock: SharedValue<number>; g: Geometry; flight: Flight }) {
  const style = useAnimatedStyle(() => flightPose(clock.value, flight, g, 0, flight.w, flight.h, 1));
  return (
    <Animated.View style={[styles.card, { width: flight.w, height: flight.h, borderRadius: flight.w * 0.1 }, style]}>
      <Image source={extraLook(k).soft} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

/**
 * Motion blur: a smear of the photo (pre-baked vertical motion blur) laid
 * along the radial line behind the look, its length = the distance travelled
 * over the last `lag` ms, fading to black at the tail.
 */
function Trail({ clock, g, flight, smear }: { clock: SharedValue<number>; g: Geometry; flight: Flight; smear: number }) {
  const rotate = `${(Math.atan2(flight.uy, flight.ux) * 180) / Math.PI + 90}deg`;
  const BW = 100;
  const BH = 100;
  const style = useAnimatedStyle(() => {
    const t = clock.value;
    const p = seg(t, flight.at, flight.dur);
    if (p <= 0 || p >= 1) return { opacity: 0, transform: [{ translateX: -9999 }, { translateY: 0 }, { rotate }, { scaleX: 1 }, { scaleY: 1 }] };
    const q = Math.pow(p, 2.1);
    const ql = Math.pow(seg(t - 90, flight.at, flight.dur), 2.1);
    const dx = g.logoX - flight.x0;
    const dy = g.logoY - flight.y0;
    const dist = Math.hypot(dx, dy);
    const s = Math.pow(1 - q, 0.9);
    const cw = flight.w * s; // look's current on-screen width
    const ch = flight.h * s;
    const len = (q - ql) * dist; // distance covered in the last 90ms
    const total = ch * 0.6 + len * 1.4;
    // Box starts at the look's centre and runs back up the radial line.
    const cx = flight.x0 + dx * q + flight.ux * (total / 2);
    const cy = flight.y0 + dy * q + flight.uy * (total / 2);
    let o = Math.min(1, len / 18) * 0.85;
    if (flight.fadeIn) o *= Math.min(1, p * 5);
    if (q > 0.9) o *= (1 - q) / 0.1;
    return {
      opacity: o,
      transform: [
        { translateX: cx - BW / 2 },
        { translateY: cy - BH / 2 },
        { rotate },
        { scaleX: (cw * 0.92) / BW },
        { scaleY: total / BH },
      ],
    };
  });
  return (
    <Animated.View style={[styles.card, styles.ghost, { width: BW, height: BH, borderRadius: 0 }, style]}>
      <Image source={smear} style={StyleSheet.absoluteFill} contentFit="fill" transition={0} />
      {/* tail (top, away from the mark) fades into the night */}
      <LinearGradient colors={[INK, "rgba(5,3,7,0)"]} locations={[0, 0.85]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** Neon light streak rushing down a radial line into the mark. */
function LightRay({ clock, g, ray }: { clock: SharedValue<number>; g: Geometry; ray: Ray }) {
  const rotate = `${(ray.angle * 180) / Math.PI + 90}deg`;
  const style = useAnimatedStyle(() => {
    const p = seg(clock.value, ray.at, ray.dur);
    if (p <= 0 || p >= 1) return { opacity: 0, transform: [{ translateX: -9999 }, { translateY: 0 }, { rotate }, { scaleY: 1 }] };
    const q = Math.pow(p, 1.6);
    const r = ray.r0 * (1 - q);
    // Head position; the line trails behind it (away from the mark).
    const hx = g.logoX + Math.cos(ray.angle) * r;
    const hy = g.logoY + Math.sin(ray.angle) * r;
    const len = ray.len * (0.35 + 0.65 * Math.sin(p * Math.PI)) * (0.4 + 0.6 * (r / ray.r0));
    const cx = hx + Math.cos(ray.angle) * (len / 2);
    const cy = hy + Math.sin(ray.angle) * (len / 2);
    return {
      opacity: Math.sin(p * Math.PI) * 0.95,
      transform: [
        { translateX: cx - ray.thick * 2 },
        { translateY: cy - ray.len / 2 },
        { rotate },
        { scaleY: len / ray.len },
      ],
    };
  });
  return (
    <Animated.View style={[styles.ray, { width: ray.thick * 4, height: ray.len }, style]}>
      {/* soft glow */}
      <LinearGradient
        colors={["transparent", ray.color]}
        style={[StyleSheet.absoluteFill, { opacity: 0.28, borderRadius: ray.thick * 2 }]}
      />
      <LinearGradient
        colors={["transparent", ray.color, "#ffffff"]}
        locations={[0, 0.85, 1]}
        style={{ position: "absolute", top: 0, bottom: 0, left: ray.thick * 1.5, width: ray.thick, borderRadius: ray.thick }}
      />
    </Animated.View>
  );
}

/* ─── Root ──────────────────────────────────────────────────────────────── */
export function CascadeLaunch({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { width, height } = useWindowDimensions();
  const [introDone, setIntroDone] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const exiting = useRef(false);

  const clock = useSharedValue(0);
  const exit = useSharedValue(0);

  const g: Geometry = useMemo(() => ({ width, height, logoX: width / 2, logoY: height * 0.87 }), [width, height]);
  const flights = useMemo(() => buildFlights(g), [g]);
  const arrivals = useMemo(
    () => [...flights.stack, ...flights.extra].map((f) => f.at + f.dur * 0.9),
    [flights],
  );

  const iconSize = Math.round(width * 0.27);
  const markW = 44;
  const markH = markW * V_ASPECT;
  const restY = height * 0.47;

  useEffect(() => {
    let cancelled = false;
    clock.value = withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => {
        if (cancelled || !rm) return;
        setReduceMotion(true);
        clock.value = withTiming(TOTAL, { duration: 200 });
      })
      .catch(() => {});
    const done = setTimeout(() => setIntroDone(true), TOTAL);
    return () => {
      cancelled = true;
      clearTimeout(done);
    };
  }, [clock]);

  useEffect(() => {
    if (!introDone || !ready || exiting.current) return;
    exiting.current = true;
    exit.value = withDelay(
      80,
      withTiming(1, { duration: reduceMotion ? 200 : T.exit, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
  }, [introDone, ready, reduceMotion, onFinish, exit]);

  /* Opening dive into the app icon */
  const coverScale = (Math.sqrt(width * width + height * height) / iconSize) * 1.25;
  const creamStyle = useAnimatedStyle(() => ({ opacity: clock.value < T.dive[0] + T.dive[1] ? 1 : 0 }));
  const iconStyle = useAnimatedStyle(() => {
    const p = seg(clock.value, T.dive[0], T.dive[1]);
    return { transform: [{ scale: 1 + (coverScale - 1) * p * p * p }] };
  });
  const iconMarkStyle = useAnimatedStyle(() => ({ opacity: 1 - seg(clock.value, T.dive[0], T.dive[1] * 0.35) }));

  /* The mark: pop at the bottom → swell while catching → glide to centre */
  const markStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const pop = seg(t, T.logoPop[0], T.logoPop[1]);
    if (pop <= 0) return { opacity: 0, transform: [{ translateY: 0 }, { scale: 0 }] };
    const grow = seg(t, T.pullStart, T.streamEnd + 700 - T.pullStart);
    let bump = 0;
    for (let i = 0; i < arrivals.length; i++) {
      const dt = t - arrivals[i];
      if (dt > 0 && dt < 260) bump += Math.exp(-dt / 70);
    }
    const glide = easeInOutCubic(seg(t, T.glide[0], T.glide[1]));
    const y = g.logoY + (restY - g.logoY) * glide;
    const s = easeOutBack(pop) * (1 + 0.38 * easeOutCubic(grow) + 0.32 * glide) * (1 + Math.min(0.22, bump * 0.1));
    return { opacity: 1, transform: [{ translateY: y - markH / 2 }, { scale: s * (1 + exit.value * 0.5) }] };
  });
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Vestara is loading"
    >
      <StatusBar style="light" />

      {!reduceMotion ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {flights.rays.map((r, k) => (
            <LightRay key={`r${k}`} clock={clock} g={g} ray={r} />
          ))}
          {flights.extra.map((f, k) => (
            <React.Fragment key={`e${k}`}>
              <Trail clock={clock} g={g} flight={f} smear={extraLook(k).smear} />
              <ExtraCard k={k} clock={clock} g={g} flight={f} />
            </React.Fragment>
          ))}
          {flights.stack.map((f, i) => (
            <Trail key={`st${i}`} clock={clock} g={g} flight={f} smear={LOOKS[STACK[i].img].smear} />
          ))}
          {STACK.map((_, i) => (
            <StackCard key={`s${i}`} i={i} clock={clock} g={g} flight={flights.stack[i]} />
          ))}
        </View>
      ) : null}

      {/* The mark sits above everything so the stream vanishes into it */}
      <Animated.View pointerEvents="none" style={[styles.mark, { left: width / 2 - markW / 2, width: markW, height: markH }, markStyle]}>
        <Svg width={markW} height={markH} viewBox={V_VIEWBOX}>
          <Path d={MARK} fill="#ffffff" />
          {V_STITCHES.map((d) => (
            <Path key={d} d={d} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      </Animated.View>

      {/* Opening: cream canvas + app icon the camera dives into */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cream, creamStyle]}>
        <Animated.View style={[styles.icon, { width: iconSize, height: iconSize, borderRadius: iconSize * 0.23 }, iconStyle]}>
          <Animated.View style={iconMarkStyle}>
            <Svg width={iconSize * 0.5} height={iconSize * 0.5 * V_ASPECT} viewBox={V_VIEWBOX}>
              <Path d={MARK} fill="#ffffff" />
              {V_STITCHES.map((d) => (
                <Path key={d} d={d} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: INK,
    overflow: "hidden",
  },
  card: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  ray: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    right: 7,
    bottom: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  badgeFill: {
    backgroundColor: "#b8327f",
    borderRadius: 11,
  },
  mark: {
    position: "absolute",
    top: 0,
    zIndex: 200,
  },
  cream: {
    backgroundColor: LAUNCH_BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
  },
  icon: {
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
});
