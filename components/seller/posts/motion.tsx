/**
 * Small motion kit for the seller Posts screens: springy press, count-up
 * numbers, a slowly turning gradient ring, shimmer placeholders and a
 * gentle float. Everything runs on the UI thread through Reanimated.
 */
import { P, RUNWAY_GRADIENT as RG } from "./palette";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

/** Brand gradient for rings and create buttons (same as the Runway tile). */
export { RUNWAY_GRADIENT } from "./palette";

const APressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that sinks a little on press and springs back. */
export function SpringPress({ children, style, scaleTo = 0.97, ...rest }: PressableProps & {
  children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => { s.value = withTiming(scaleTo, { duration: 110, easing: Easing.out(Easing.quad) }); rest.onPressIn?.(e); }}
      onPressOut={(e) => { s.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }); rest.onPressOut?.(e); }}
      style={[style, a]}>
      {children}
    </APressable>
  );
}

/** Number that counts up from 0 (ease-out) whenever `value` changes. */
export function CountUp({ value, style, format = compactCount, duration = 900, delay = 0 }: {
  value: number; style?: StyleProp<TextStyle>; format?: (n: number) => string; duration?: number; delay?: number;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / duration);
        setShown(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [value, duration, delay]);
  return <Text style={style}>{format(Number.isInteger(value) ? Math.round(shown) : shown)}</Text>;
}

export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/**
 * Gradient ring that turns slowly around its content (story-ring style).
 * `size` is the outer diameter; `children` sit on a cream gap inside.
 */
export function GradientRing({ size, thickness = 3, gap = 3, spin = true, children }: {
  size: number; thickness?: number; gap?: number; spin?: boolean; children: ReactNode;
}) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (!spin) return;
    r.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(r);
  }, [spin, r]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  const inner = size - thickness * 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        <LinearGradient colors={RG} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
          style={{ width: size, height: size, borderRadius: size / 2 }} />
      </Animated.View>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: P.paper, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: inner - gap * 2, height: inner - gap * 2, borderRadius: (inner - gap * 2) / 2, overflow: "hidden" }}>
          {children}
        </View>
      </View>
    </View>
  );
}

/** Soft shimmering block used for loading tiles. */
export function Shimmer({ style, delay = 0 }: { style?: StyleProp<ViewStyle>; delay?: number }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.quad) }),
    ), -1, false));
    return () => cancelAnimation(o);
  }, [delay, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: P.warmer }, style, a]} />;
}

/** Static wrapper (kept for layout; no motion — the screens should feel calm, not bouncy). */
export function Float({ children, rotate = 0, style }: {
  children: ReactNode; distance?: number; duration?: number; delay?: number; rotate?: number; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[style, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null]}>{children}</View>;
}

/** Small dot that pulses (for "in review" / "processing"). */
export function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(p);
  }, [p]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.6 }] }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color }, halo]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}
