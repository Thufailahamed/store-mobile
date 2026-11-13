/**
 * OrderPlacedHero — "saved into the pocket" celebration on the order-success
 * screen, choreographed beat-for-beat on the reference motion study.
 *
 * Beats (one UI-thread clock `t` in ms drives every layer):
 *   0.00s   the ordered pieces stream down from the top edge as one touching
 *           column and slide behind the dark pocket, which swells slightly
 *           at the mouth while it swallows them (subtitle types meanwhile)
 *   1.15s   column gone → the pocket wobbles once and rests
 *   1.40s   anticipation: it shrinks to ~60%
 *   1.75s   it pops to ~150% with a 3D tilt (rotateZ + rotateY) and hangs
 *   2.33s   it snaps down small and, at the same moment, two thin orbit
 *           rings open and eight chips spring out from behind it to their
 *           fixed orbit slots (staggered, overshooting); everything then rests
 *   2.70s   the subtitle clears and types its second line
 *
 * Tap the stage to replay. Reduce Motion jumps straight to the final frame.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";

/* ---------- timeline (ms) ---------- */
export const HERO_T = {
  streamEnd: 1150,
  crouchStart: 1400,
  crouchEnd: 1750,
  popEnd: 2050,
  holdEnd: 2330,
  shrinkEnd: 2650,
  chipsStart: 2350,
  /** subtitle phase 1 starts / phase 2 starts */
  type1: 80,
  type2: 2700,
  /** when the rest of the page may rise in */
  settle: 2950,
  total: 3300,
} as const;

/* ---------- worklet easing helpers ---------- */
function clamp01(x: number) {
  "worklet";
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function seg(t: number, a: number, b: number) {
  "worklet";
  return clamp01((t - a) / (b - a));
}
function inOutCubic(x: number) {
  "worklet";
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function outCubic(x: number) {
  "worklet";
  return 1 - Math.pow(1 - x, 3);
}
function outBack(x: number, s = 1.70158) {
  "worklet";
  const c3 = s + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
}
/** Damped spring impulse: 0 at d=0, quick peak, decaying wobble. */
function jiggle(dMs: number) {
  "worklet";
  if (dMs <= 0) return 0;
  const x = dMs / 1000;
  return Math.sin(x * 26) * Math.exp(-x * 9);
}

/* ---------- geometry ---------- */
const POCKET_W = 104;
const POCKET_H = 118;
const NOTCH = 24;
const CARD_W = 82;
const CARD_H = 110;
const CARD_GAP = 6;
const MIN_CARDS = 5;
/** cards are clipped this far down the pocket, so they vanish inside it */
const CLIP_INTO = POCKET_H * 0.55;

const POCKET_PATH = `M16 0 H${POCKET_W - 16} Q${POCKET_W} 0 ${POCKET_W} 16 V${POCKET_H - 8} Q${POCKET_W} ${POCKET_H + 1} ${POCKET_W - 8} ${POCKET_H - 3} L${POCKET_W / 2} ${POCKET_H - NOTCH} L8 ${POCKET_H - 3} Q0 ${POCKET_H + 1} 0 ${POCKET_H - 8} V16 Q0 0 16 0 Z`;

/* ---------- orbit chips (slots measured off the reference's final frame) ---------- */
type Chip =
  | { kind: "photo"; ring: 0 | 1; angle: number; photoIdx: number; fallback: IonIconName }
  | { kind: "badge"; ring: 0 | 1; angle: number; icon: IonIconName; from: string; to: string }
  | { kind: "icon"; ring: 0 | 1; angle: number; icon: IonIconName; tint: string };

const CHIPS: Chip[] = [
  { kind: "icon", ring: 1, angle: -139, icon: "receipt", tint: "#a259e6" },
  { kind: "photo", ring: 0, angle: -130, photoIdx: 0, fallback: "shirt" },
  { kind: "photo", ring: 1, angle: -54, photoIdx: 1, fallback: "diamond" },
  { kind: "icon", ring: 0, angle: -39, icon: "navigate", tint: "#2f80ed" },
  { kind: "badge", ring: 0, angle: 19, icon: "cube", from: "#5ac8fa", to: "#1f6fe5" },
  { kind: "icon", ring: 1, angle: 34, icon: "car", tint: "#34c759" },
  { kind: "icon", ring: 1, angle: 146, icon: "gift", tint: "#ff3b30" },
  { kind: "icon", ring: 0, angle: 165, icon: "sparkles", tint: "#f5b400" },
];

const FALLBACK_CARD_ICONS: IonIconName[] = ["shirt-outline", "diamond-outline", "glasses-outline", "watch-outline", "bag-outline"];

export interface OrderPlacedHeroProps {
  /** Product image URLs from the order. */
  images: string[];
}

export function OrderPlacedHero({ images }: OrderPlacedHeroProps) {
  const { width: winW } = useWindowDimensions();
  const stageW = Math.min(winW - 32, 420);
  const stageH = 360;
  const cx = stageW / 2;
  const cy = stageH / 2;
  const k = Math.min(1, (stageW - 40) / 330);
  const R = [100 * k, 166 * k];

  const cards = useMemo(() => {
    const n = Math.max(MIN_CARDS, Math.min(8, images.length));
    return Array.from({ length: n }, (_, i) => ({
      uri: images.length ? images[i % images.length] : null,
      icon: FALLBACK_CARD_ICONS[i % FALLBACK_CARD_ICONS.length],
    }));
  }, [images]);

  // Card column: card 0 leads. Column offset Y = top of card 0 (stage coords).
  const pocketTop = cy - POCKET_H / 2;
  const clipBottom = pocketTop + CLIP_INTO;
  const colStart = -CARD_H * 0.55; // first card already peeking in at the top edge
  const colEnd = clipBottom + (cards.length - 1) * (CARD_H + CARD_GAP) + 4;

  const t = useSharedValue(0);
  const [reduced, setReduced] = useState(false);

  const play = useCallback(
    (instant: boolean) => {
      cancelAnimation(t);
      if (instant) {
        t.value = HERO_T.total;
        return;
      }
      t.value = 0;
      t.value = withTiming(HERO_T.total, { duration: HERO_T.total, easing: Easing.linear });
    },
    [t],
  );

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        if (!alive) return;
        setReduced(r);
        play(r);
      })
      .catch(() => play(false));
    return () => {
      alive = false;
      cancelAnimation(t);
    };
  }, [play, t]);

  /* ---------- the pocket ---------- */
  const pocketStyle = useAnimatedStyle(() => {
    const v = t.value;
    // mouth swells while it swallows the column, then one wobble
    const pressure = seg(v, 0, 160) * (1 - seg(v, HERO_T.streamEnd - 120, HERO_T.streamEnd + 80));
    const j = jiggle(v - HERO_T.streamEnd + 40);
    const c = inOutCubic(seg(v, HERO_T.crouchStart, HERO_T.crouchEnd));
    const p = outBack(seg(v, HERO_T.crouchEnd, HERO_T.popEnd), 1.25);
    const h = seg(v, HERO_T.popEnd, HERO_T.holdEnd);
    const s = outCubic(seg(v, HERO_T.holdEnd, HERO_T.shrinkEnd));
    // 1 → 0.6 → 1.5 → 1.44 → 0.62
    const scale = 1 - 0.4 * c + 0.9 * p - 0.06 * h - 0.82 * s;
    const rotZ = -15 * p - 1.5 * h + 2.5 * s;
    const rotY = 22 * p - 9 * s;
    const sx = 1 + 0.05 * pressure + 0.05 * j;
    const sy = 1 - 0.025 * pressure - 0.05 * j;
    return {
      transform: [
        { perspective: 700 },
        { rotateZ: `${rotZ}deg` },
        { rotateY: `${rotY}deg` },
        { scale },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  const innerRing = useAnimatedStyle(() => {
    const p = outCubic(seg(t.value, HERO_T.chipsStart, HERO_T.chipsStart + 420));
    return { opacity: p, transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  const outerRing = useAnimatedStyle(() => {
    const p = outCubic(seg(t.value, HERO_T.chipsStart + 40, HERO_T.chipsStart + 500));
    return { opacity: p, transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  const ringStyles = [innerRing, outerRing];

  return (
    <Pressable
      onPress={() => play(reduced)}
      accessibilityRole="image"
      accessibilityLabel="Your order has been placed"
      style={{ width: stageW, height: stageH }}
    >
      {/* orbit rings */}
      {R.map((r, i) => (
        <Animated.View
          key={`ring${i}`}
          pointerEvents="none"
          style={[
            styles.ring,
            { width: r * 2, height: r * 2, borderRadius: r, left: cx - r, top: cy - r },
            ringStyles[i],
          ]}
        />
      ))}

      {/* orbit chips — spring out from behind the pocket */}
      {CHIPS.map((chip, i) => (
        <OrbitChip
          key={i}
          chip={chip}
          t={t}
          cx={cx}
          cy={cy}
          radius={R[chip.ring]}
          start={HERO_T.chipsStart + i * 28}
          images={images}
        />
      ))}

      {/* the card column, clipped so pieces vanish inside the pocket */}
      <View
        pointerEvents="none"
        style={[styles.clip, { left: cx - CARD_W / 2 - 4, width: CARD_W + 8, top: -600, height: 600 + clipBottom }]}
      >
        {cards.map((c, i) => (
          <StreamCard
            key={i}
            card={c}
            index={i}
            t={t}
            colStart={colStart + 600}
            colEnd={colEnd + 600}
          />
        ))}
      </View>

      {/* the pocket */}
      <Animated.View
        pointerEvents="none"
        style={[styles.pocket, { left: cx - POCKET_W / 2, top: pocketTop }, pocketStyle]}
      >
        <Svg width={POCKET_W} height={POCKET_H}>
          <Defs>
            <SvgGradient id="pocketFill" x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor="#4a4a4c" />
              <Stop offset="0.45" stopColor="#1c1c1e" />
              <Stop offset="1" stopColor="#050506" />
            </SvgGradient>
          </Defs>
          <Path d={POCKET_PATH} fill="url(#pocketFill)" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

/* ---------- one card in the streaming column ---------- */
function StreamCard({
  card,
  index,
  t,
  colStart,
  colEnd,
}: {
  card: { uri: string | null; icon: IonIconName };
  index: number;
  t: SharedValue<number>;
  colStart: number;
  colEnd: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = seg(t.value, 0, HERO_T.streamEnd);
    // already moving when it appears; eases only at the very end
    const e = p * 0.55 + 0.45 * (1 - Math.pow(1 - p, 2));
    const y = colStart + (colEnd - colStart) * e - index * (CARD_H + CARD_GAP);
    return {
      opacity: p >= 1 ? 0 : 1,
      transform: [{ translateY: y }],
    };
  });
  return (
    <Animated.View style={[styles.card, style]}>
      {card.uri ? (
        <Image source={{ uri: card.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      ) : (
        <View style={styles.cardFallback}>
          <Ionicons name={card.icon} size={30} color={colors.olive[700]} />
        </View>
      )}
    </Animated.View>
  );
}

/* ---------- a chip springing onto its orbit slot ---------- */
function OrbitChip({
  chip,
  t,
  cx,
  cy,
  radius,
  start,
  images,
}: {
  chip: Chip;
  t: SharedValue<number>;
  cx: number;
  cy: number;
  radius: number;
  start: number;
  images: string[];
}) {
  const size = chip.kind === "icon" ? 34 : chip.kind === "badge" ? 50 : 52;
  const a = (chip.angle * Math.PI) / 180;
  const dx = Math.cos(a) * radius;
  const dy = Math.sin(a) * radius;

  const style = useAnimatedStyle(() => {
    const p = seg(t.value, start, start + 520);
    const out = outBack(p, 1.6);
    return {
      opacity: clamp01(p * 5),
      transform: [{ translateX: dx * out }, { translateY: dy * out }, { scale: 0.2 + 0.8 * out }],
    };
  });

  const uri = chip.kind === "photo" && images.length ? images[chip.photoIdx % images.length] : undefined;

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size }, style]}
    >
      {chip.kind === "photo" ? (
        <View style={[styles.photoChip, { width: size, height: size }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.photoFallback]}>
              <Ionicons name={chip.fallback} size={24} color="#fff" />
            </View>
          )}
        </View>
      ) : chip.kind === "badge" ? (
        <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGradient id="badgeFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={chip.from} />
                <Stop offset="1" stopColor={chip.to} />
              </SvgGradient>
            </Defs>
            <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1.5} fill="url(#badgeFill)" stroke="#ffffff" strokeWidth={2.5} />
          </Svg>
          <Ionicons name={chip.icon} size={22} color="#fff" />
        </View>
      ) : (
        <View style={[styles.iconChip, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${chip.tint}1f` }]}>
          <Ionicons name={chip.icon} size={16} color={chip.tint} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  clip: {
    position: "absolute",
    overflow: "hidden",
  },
  card: {
    position: "absolute",
    left: 4,
    top: 0,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
  },
  cardFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pocket: {
    position: "absolute",
    width: POCKET_W,
    height: POCKET_H,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  photoChip: {
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "#111",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  photoFallback: {
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1f6fe5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  iconChip: {
    alignItems: "center",
    justifyContent: "center",
  },
});

/* ---------- two-phase typewriter (types, clears, types again) ---------- */
export function useTypeSequence(
  phases: { text: string; at: number; msPerChar: number }[],
  enabled = true,
) {
  const finalText = phases[phases.length - 1]?.text ?? "";
  const [typed, setTyped] = useState(enabled ? "" : finalText);
  const [typing, setTyping] = useState(enabled);
  const [cursorOn, setCursorOn] = useState(true);
  const key = phases.map((p) => `${p.at}:${p.text}`).join("|");

  useEffect(() => {
    if (!enabled) {
      setTyped(finalText);
      setTyping(false);
      return;
    }
    setTyped("");
    setTyping(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    phases.forEach((ph, pi) => {
      for (let i = 0; i <= ph.text.length; i++) {
        timers.push(setTimeout(() => setTyped(ph.text.slice(0, i)), ph.at + i * ph.msPerChar));
      }
      if (pi === phases.length - 1) {
        timers.push(setTimeout(() => setTyping(false), ph.at + ph.text.length * ph.msPerChar + 1500));
      }
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    if (!typing) return;
    const id = setInterval(() => setCursorOn((c) => !c), 400);
    return () => clearInterval(id);
  }, [typing]);

  return { typed, cursorVisible: typing && cursorOn, typing };
}
