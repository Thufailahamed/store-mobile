/**
 * VestaraLaunch — animated launch screen shown once per cold start.
 *
 * Sequence (≈2.8s): soft cream → plum/rose gradient sweeps in → the hanger
 * mark draws itself stroke by stroke → "Vestara" fades up → the lockup lifts,
 * the tagline types out and a progress line fills → the whole overlay fades
 * away once both the intro has played and the app reports `ready`.
 */
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { fontFamilies } from "@/lib/theme/fonts";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const BRAND = "Vestara";
const TAGLINE = "Sri Lanka's finest boutiques, in your pocket";

/** Cream the screen starts on — matches the native splash background. */
export const LAUNCH_BG = "#fff7f1";
const GRADIENT = ["#2a0b3d", "#6e1663", "#b8327f", "#f4bfd8", LAUNCH_BG] as const;
const GRADIENT_STOPS = [0, 0.3, 0.52, 0.78, 1] as const;
const INK = "#2b1630";

/*
 * Hanger mark, drawn on a 120 × 100 grid. Lengths are slightly generous
 * estimates of each stroke so the dash reveal always starts fully hidden.
 */
const HOOK = "M51.5 20.5 A9 9 0 1 1 66 26 C62.5 28 60 29.5 60 33 V38";
const BODY =
  "M60 38 L15.5 61.5 C7 66 5.5 70 7.5 73.5 C9 76.2 12.5 77 18 77 H102 C107.5 77 111 76.2 112.5 73.5 C114.5 70 113 66 104.5 61.5 Z";
const HEART =
  "M60 77 V70.5 C53 64.5 47.5 60 47.5 54.5 C47.5 50.6 50.4 48 53.8 48 C56.6 48 58.6 49.8 60 52.4 C61.4 49.8 63.4 48 66.2 48 C69.6 48 72.5 50.6 72.5 54.5 C72.5 60 67 64.5 60 70.5";
const LEN = { hook: 72, body: 270, heart: 96 } as const;

const T = {
  bgIn: 450,
  hook: [320, 420],
  body: [560, 720],
  heart: [1000, 520],
  brand: 1300,
  lift: 1700,
  typeStart: 1900,
  typeStep: 26,
  minShow: 2900,
  exit: 380,
} as const;

function StrokeReveal({
  d,
  length,
  delay,
  duration,
  width,
}: {
  d: string;
  length: number;
  delay: number;
  duration: number;
  width: number;
}) {
  const offset = useSharedValue(length);
  useEffect(() => {
    offset.value = withDelay(delay, withTiming(0, { duration, easing: Easing.inOut(Easing.cubic) }));
  }, [offset, delay, duration]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <AnimatedPath
      d={d}
      stroke="#ffffff"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={[length, length]}
      animatedProps={props}
    />
  );
}

export function VestaraLaunch({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [typed, setTyped] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const exiting = useRef(false);

  const bg = useSharedValue(0);
  const brand = useSharedValue(0);
  const lift = useSharedValue(0);
  const progress = useSharedValue(0);
  const overlay = useSharedValue(1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    bg.value = withTiming(1, { duration: T.bgIn, easing: ease });
    brand.value = withDelay(T.brand, withTiming(1, { duration: 520, easing: ease }));
    lift.value = withDelay(T.lift, withTiming(1, { duration: 520, easing: Easing.inOut(Easing.cubic) }));
    progress.value = withDelay(T.lift, withTiming(0.86, { duration: T.minShow - T.lift, easing: ease }));

    let typer: ReturnType<typeof setInterval> | undefined;
    const typeStart = setTimeout(() => {
      typer = setInterval(() => {
        setTyped((n) => {
          if (n >= TAGLINE.length) {
            if (typer) clearInterval(typer);
            return n;
          }
          return n + 1;
        });
      }, T.typeStep);
    }, T.typeStart);
    const done = setTimeout(() => setIntroDone(true), T.minShow);
    return () => {
      clearTimeout(typeStart);
      clearTimeout(done);
      if (typer) clearInterval(typer);
    };
  }, [bg, brand, lift, progress]);

  // Leave once the intro has played and the app is ready underneath.
  useEffect(() => {
    if (!introDone || !ready || exiting.current) return;
    exiting.current = true;
    progress.value = withTiming(1, { duration: 220 });
    overlay.value = withDelay(
      200,
      withTiming(0, { duration: reduceMotion ? 1 : T.exit, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
  }, [introDone, ready, reduceMotion, onFinish, overlay, progress]);

  const markSize = Math.min(width * 0.36, 150);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
    transform: [{ scale: 1 + (1 - overlay.value) * 0.06 }],
  }));
  const lockupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * height * 0.07 }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brand.value,
    transform: [{ translateY: (1 - brand.value) * 14 }],
    letterSpacing: 6 - brand.value * 4.5,
  }));
  const footStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ translateY: (1 - lift.value) * 16 }],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Vestara is loading"
    >
      <StatusBar style="light" />
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <LinearGradient colors={GRADIENT} locations={GRADIENT_STOPS} style={StyleSheet.absoluteFill} />
        {/* Soft glow behind the mark */}
        <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="vestaraGlow" cx="50%" cy="40%" rx="70%" ry="38%">
              <Stop offset="0" stopColor="#ffd1ea" stopOpacity={0.32} />
              <Stop offset="0.6" stopColor="#ffd1ea" stopOpacity={0.08} />
              <Stop offset="1" stopColor="#ffd1ea" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#vestaraGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.lockup, { top: height * 0.34 }, lockupStyle]}>
        <Svg width={markSize} height={markSize * (100 / 120)} viewBox="0 0 120 100">
          <StrokeReveal d={HOOK} length={LEN.hook} delay={T.hook[0]} duration={T.hook[1]} width={4.2} />
          <StrokeReveal d={BODY} length={LEN.body} delay={T.body[0]} duration={T.body[1]} width={4.2} />
          <StrokeReveal d={HEART} length={LEN.heart} delay={T.heart[0]} duration={T.heart[1]} width={4.2} />
        </Svg>
        <Animated.Text style={[styles.brand, brandStyle]} accessibilityRole="header">
          {BRAND}
        </Animated.Text>
        <Text style={styles.tagline} numberOfLines={2}>
          {TAGLINE.slice(0, typed)}
          {typed > 0 && typed < TAGLINE.length ? <Text style={styles.caret}>|</Text> : null}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.foot, footStyle]}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
        <Text style={styles.footText}>Curating your edit…</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: LAUNCH_BG,
  },
  lockup: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  brand: {
    marginTop: 14,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 46,
    lineHeight: 54,
    color: "#ffffff",
    textShadowColor: "rgba(40,6,40,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  tagline: {
    marginTop: 56,
    minHeight: 48,
    maxWidth: 280,
    textAlign: "center",
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
    lineHeight: 23,
    color: INK,
  },
  caret: {
    color: "#b8327f",
    fontFamily: fontFamilies.sans.regular,
  },
  foot: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 64,
    alignItems: "center",
  },
  track: {
    alignSelf: "stretch",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(43,22,48,0.1)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#b8327f",
  },
  footText: {
    marginTop: 12,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "rgba(43,22,48,0.55)",
  },
});
