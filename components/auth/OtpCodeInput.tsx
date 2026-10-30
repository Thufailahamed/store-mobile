import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
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
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

/**
 * Glowing one-time-code field. One hidden TextInput drives N display cells,
 * so paste, SMS autofill and backspace all behave like a normal field.
 *
 *   idle      → active cell glows olive with a blinking caret
 *   verifying → light sweeps along the cell tops, cells glow olive in a wave
 *   error     → row shakes, cells flush rust
 *   success   → cells slide together, the merged cell morphs into a round
 *               olive seal, light bursts outward and a check draws on it
 */

export type OtpStatus = "idle" | "verifying" | "error" | "success";

export type OtpCodeInputHandle = { focus: () => void; blur: () => void };

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const GAP = 10;
const OLIVE = colors.olive[600];
const OLIVE_HOT = colors.olive[500];
const OLIVE_GLOW = colors.olive[400];
const RUST = colors.accent2.rust;
const INK = colors.light.foreground;
const CELL_EMPTY = "#efede4";
const CELL_FILLED = "#FFFFFF";
const BORDER_IDLE = "rgba(22,23,15,0.08)";
const BORDER_FILLED = "rgba(22,23,15,0.16)";

export const OtpCodeInput = forwardRef<
  OtpCodeInputHandle,
  {
    value: string;
    onChange: (code: string) => void;
    length?: number;
    status: OtpStatus;
    autoFocus?: boolean;
  }
>(function OtpCodeInput({ value, onChange, length = 6, status, autoFocus }, ref) {
  const reduce = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [rowW, setRowW] = useState(0);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const cellW = rowW ? Math.min(54, (rowW - GAP * (length - 1)) / length) : 48;
  const cellH = Math.round(cellW * 1.22);
  const editable = status === "idle" || status === "error";

  // Row shake on a wrong code.
  const shake = useSharedValue(0);
  useEffect(() => {
    if (status !== "error" || reduce) return;
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(9, { duration: 60 }),
      withTiming(-7, { duration: 60 }),
      withTiming(5, { duration: 60 }),
      withTiming(-2, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reduce]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const onLayout = (e: LayoutChangeEvent) => setRowW(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <AmbientGlow status={status} focused={focused} width={rowW} height={cellH} reduce={reduce} />

      <Pressable onPress={() => editable && inputRef.current?.focus()} accessible={false}>
        <Animated.View style={[styles.row, { height: cellH }, rowStyle]}>
          {Array.from({ length }, (_, i) => (
            <Cell
              key={i}
              index={i}
              digit={value[i] ?? ""}
              active={focused && editable && i === Math.min(value.length, length - 1)}
              status={status}
              w={cellW}
              h={cellH}
              // How far this cell travels to reach the row's centre on success.
              dx={((length - 1) / 2 - i) * (cellW + GAP)}
              reduce={reduce}
            />
          ))}
          {status === "success" && <Seal cellW={cellW} cellH={cellH} reduce={reduce} />}
        </Animated.View>
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        contextMenuHidden={false}
        style={[styles.hiddenInput, { height: cellH }]}
        accessibilityLabel={`${length}-digit verification code`}
      />
    </View>
  );
});

/* ------------------------------------------------------------------ cell */

function Cell({
  index,
  digit,
  active,
  status,
  w,
  h,
  dx,
  reduce,
}: {
  index: number;
  digit: string;
  active: boolean;
  status: OtpStatus;
  w: number;
  h: number;
  dx: number;
  reduce: boolean;
}) {
  const filled = useSharedValue(digit ? 1 : 0);
  const focus = useSharedValue(0);
  const heat = useSharedValue(0);
  const err = useSharedValue(0);
  const pop = useSharedValue(1);
  const shine = useSharedValue(-1);
  const merge = useSharedValue(0);
  const fade = useSharedValue(1);

  // Digit pops in as it's typed.
  useEffect(() => {
    filled.value = withTiming(digit ? 1 : 0, { duration: 180 });
    if (digit && !reduce) {
      pop.value = 0.55;
      pop.value = withSpring(1, { damping: 12, stiffness: 260, mass: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit, reduce]);

  useEffect(() => {
    focus.value = withTiming(active ? 1 : 0, { duration: 220, easing: EASE_OUT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const stagger = index * 90;
    if (status === "verifying") {
      err.value = withTiming(0, { duration: 150 });
      heat.value = reduce
        ? withTiming(0.8, { duration: 300 })
        : withDelay(
            stagger,
            withRepeat(
              withSequence(
                withTiming(1, { duration: 380, easing: EASE_OUT }),
                withTiming(0.45, { duration: 520, easing: Easing.inOut(Easing.sin) }),
              ),
              -1,
              true,
            ),
          );
      if (!reduce) {
        shine.value = -1;
        shine.value = withDelay(
          stagger,
          withRepeat(withTiming(1, { duration: 900, easing: EASE_IN_OUT }), -1, false),
        );
      }
    } else if (status === "success") {
      heat.value = withTiming(1, { duration: 200 });
      shine.value = withTiming(-1, { duration: 0 });
      merge.value = withTiming(1, { duration: reduce ? 0 : 460, easing: EASE_IN_OUT });
      fade.value = withDelay(reduce ? 0 : 300, withTiming(0, { duration: 200 }));
    } else if (status === "error") {
      heat.value = withTiming(0, { duration: 150 });
      shine.value = withTiming(-1, { duration: 0 });
      err.value = withSequence(withTiming(1, { duration: 120 }), withDelay(450, withTiming(0, { duration: 400 })));
    } else {
      heat.value = withTiming(0, { duration: 250 });
      shine.value = withTiming(-1, { duration: 0 });
      merge.value = withTiming(0, { duration: 0 });
      fade.value = withTiming(1, { duration: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reduce]);

  const boxStyle = useAnimatedStyle(() => {
    const restBorder = interpolateColor(filled.value, [0, 1], [BORDER_IDLE, BORDER_FILLED]);
    const focusBorder = interpolateColor(focus.value, [0, 1], [restBorder, OLIVE]);
    const hotBorder = interpolateColor(heat.value, [0, 1], [focusBorder, OLIVE_HOT]);
    const bg = interpolateColor(Math.max(filled.value, focus.value), [0, 1], [CELL_EMPTY, CELL_FILLED]);
    return {
      width: w,
      height: h,
      backgroundColor: interpolateColor(err.value, [0, 1], [bg, "#fbefe9"]),
      borderColor: interpolateColor(err.value, [0, 1], [hotBorder, RUST]),
      borderWidth: 1.5,
      shadowColor: err.value > 0.01 ? RUST : heat.value > 0.01 ? OLIVE_GLOW : OLIVE,
      shadowOpacity: Math.min(0.75, 0.32 * focus.value + 0.7 * heat.value + 0.4 * err.value),
      shadowRadius: 8 + 10 * heat.value,
      opacity: fade.value,
      transform: [
        { translateX: dx * merge.value },
        { scale: 1 - 0.08 * merge.value },
        { translateY: -3 * focus.value },
      ],
    };
  });

  const digitStyle = useAnimatedStyle(() => ({
    opacity: 1 - merge.value,
    transform: [{ scale: pop.value }],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.value > -1 ? 1 : 0,
    transform: [{ translateX: shine.value * w }],
  }));

  return (
    <Animated.View style={[styles.cell, boxStyle]}>
      {/* Top-edge light sweep while verifying. */}
      <View style={styles.shineTrack} pointerEvents="none">
        <Animated.View style={[styles.shine, { width: w }, shineStyle]}>
          <LinearGradient
            colors={["rgba(134,145,73,0)", "rgba(168,176,107,1)", "rgba(134,145,73,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      {digit ? (
        <Animated.Text style={[styles.digit, { fontSize: Math.round(w * 0.54) }, digitStyle]}>{digit}</Animated.Text>
      ) : active ? (
        <Caret height={Math.round(h * 0.38)} reduce={reduce} />
      ) : null}
    </Animated.View>
  );
}

function Caret({ height, reduce }: { height: number; reduce: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(
      withSequence(withDelay(420, withTiming(0, { duration: 120 })), withDelay(380, withTiming(1, { duration: 120 }))),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.caret, { height }, style]} />;
}

/* ---------------------------------------------------------------- glow */

function AmbientGlow({
  status,
  focused,
  width,
  height,
  reduce,
}: {
  status: OtpStatus;
  focused: boolean;
  width: number;
  height: number;
  reduce: boolean;
}) {
  const o = useSharedValue(0);
  const s = useSharedValue(0.9);
  useEffect(() => {
    if (status === "verifying") {
      o.value = reduce
        ? withTiming(0.85, { duration: 300 })
        : withRepeat(
            withSequence(withTiming(1, { duration: 500 }), withTiming(0.6, { duration: 700, easing: Easing.inOut(Easing.sin) })),
            -1,
            true,
          );
      s.value = withTiming(1.05, { duration: 600, easing: EASE_OUT });
    } else if (status === "success") {
      o.value = withSequence(withTiming(1, { duration: 250 }), withDelay(500, withTiming(0.55, { duration: 900 })));
      s.value = withTiming(0.75, { duration: 600, easing: EASE_OUT });
    } else if (status === "error") {
      o.value = withTiming(0, { duration: 200 });
    } else {
      o.value = withTiming(focused ? 0.38 : 0.16, { duration: 400 });
      s.value = withTiming(0.9, { duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, focused, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  if (!width) return null;
  const gw = width * 1.25;
  const gh = height * 3.4;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: (width - gw) / 2, top: (height - gh) / 2, width: gw, height: gh }, style]}
    >
      <Svg width={gw} height={gh}>
        <Defs>
          <RadialGradient id="otp-ambient" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={colors.olive[300]} stopOpacity={0.5} />
            <Stop offset="0.45" stopColor={colors.olive[200]} stopOpacity={0.24} />
            <Stop offset="0.75" stopColor={colors.olive[100]} stopOpacity={0.1} />
            <Stop offset="1" stopColor={colors.olive[100]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={gw / 2} cy={gh / 2} rx={gw / 2} ry={gh / 2} fill="url(#otp-ambient)" />
      </Svg>
    </Animated.View>
  );
}

/* ---------------------------------------------------------------- seal */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SEAL = 84;
const CHECK_LEN = 40;
const HALO_R = SEAL / 2 + 9;
const HALO_LEN = 2 * Math.PI * HALO_R;

/**
 * The merged cell. It starts as a white code cell where the six came
 * together, morphs into a round olive seal, then a fine halo ring traces
 * around it, motes of light burst outward and a check draws on.
 */
function Seal({ cellW, cellH, reduce }: { cellW: number; cellH: number; reduce: boolean }) {
  const show = useSharedValue(reduce ? 1 : 0);
  const morph = useSharedValue(reduce ? 1 : 0);
  const halo = useSharedValue(reduce ? 1 : 0);
  const tick = useSharedValue(reduce ? 1 : 0);
  const pop = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    show.value = withDelay(320, withTiming(1, { duration: 140 }));
    morph.value = withDelay(400, withSpring(1, { damping: 14, stiffness: 120, mass: 0.9 }));
    glow.value = withDelay(480, withTiming(1, { duration: 900, easing: EASE_OUT }));
    halo.value = withDelay(620, withTiming(1, { duration: 700, easing: EASE_IN_OUT }));
    tick.value = withDelay(820, withTiming(1, { duration: 420, easing: Easing.bezier(0.33, 0, 0.2, 1) }));
    pop.value = withDelay(
      1180,
      withSequence(withTiming(1.06, { duration: 140, easing: EASE_OUT }), withSpring(1, { damping: 9, stiffness: 220 })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shellStyle = useAnimatedStyle(() => {
    const m = morph.value;
    return {
      opacity: show.value,
      width: cellW + (SEAL - cellW) * m,
      height: cellH + (SEAL - cellH) * m,
      borderRadius: 16 + (SEAL / 2 - 16) * Math.min(1, m),
      shadowOpacity: 0.32 * Math.min(1, m),
      transform: [{ scale: pop.value }],
    };
  });
  const fillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, morph.value * 1.4),
    borderRadius: 16 + (SEAL / 2 - 16) * Math.min(1, morph.value),
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.9 * glow.value,
    transform: [{ scale: 0.5 + 0.5 * glow.value }],
  }));
  const haloProps = useAnimatedProps(() => ({
    strokeDashoffset: HALO_LEN * (1 - halo.value),
    opacity: halo.value > 0 ? 1 : 0,
  }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - tick.value) }));

  const haloBox = SEAL + 30;

  return (
    <View style={styles.sealWrap} pointerEvents="none">
      {/* Soft olive light pooling under the seal */}
      <Animated.View style={[styles.sealGlow, glowStyle]}>
        <Svg width={260} height={260}>
          <Defs>
            <RadialGradient id="otp-seal-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.olive[300]} stopOpacity={0.55} />
              <Stop offset="0.45" stopColor={colors.olive[200]} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.olive[100]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={130} cy={130} r={130} fill="url(#otp-seal-glow)" />
        </Svg>
      </Animated.View>

      {!reduce && <Motes />}
      {!reduce && [0, 1].map((n) => <EchoRing key={n} delay={700 + n * 320} />)}

      {/* Fine halo ring traced around the seal */}
      <Svg width={haloBox} height={haloBox} style={styles.halo}>
        <AnimatedCircle
          cx={haloBox / 2}
          cy={haloBox / 2}
          r={HALO_R}
          fill="none"
          stroke={colors.olive[400]}
          strokeOpacity={0.55}
          strokeWidth={1}
          strokeLinecap="round"
          strokeDasharray={`${HALO_LEN} ${HALO_LEN}`}
          transform={`rotate(-90 ${haloBox / 2} ${haloBox / 2})`}
          animatedProps={haloProps}
        />
      </Svg>

      <Animated.View style={[styles.sealShell, shellStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.sealClip, fillStyle]}>
          <LinearGradient
            colors={[colors.olive[400], OLIVE, colors.olive[800]]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Glassy top sheen + inner hairline for depth */}
          <LinearGradient
            colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sealInner} />
        </Animated.View>
        <Svg width={48} height={48} viewBox="0 0 40 40">
          <AnimatedPath
            d="M11.5 20.5 L17.5 26.5 L29 14"
            fill="none"
            stroke={colors.paper.cream}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
            animatedProps={tickProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const MOTES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 2 ? 0.12 : -0.08);
  return {
    angle,
    dist: 62 + (i % 4) * 9,
    size: i % 3 === 0 ? 5 : i % 3 === 1 ? 3.5 : 2.5,
    color: [colors.olive[600], colors.olive[400], colors.olive[300], colors.olive[500]][i % 4],
    delay: (i % 4) * 30,
  };
});

/** Small olive motes bursting out from the seal as it lands. */
function Motes() {
  return (
    <>
      {MOTES.map((m, i) => (
        <Mote key={i} {...m} />
      ))}
    </>
  );
}

function Mote({ angle, dist, size, color, delay }: { angle: number; dist: number; size: number; color: string; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(600 + delay, withTiming(1, { duration: 900, easing: EASE_OUT }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.12 ? p.value / 0.12 : Math.max(0, 1 - (p.value - 0.12) / 0.88),
    transform: [
      { translateX: Math.cos(angle) * (28 + dist * p.value) },
      { translateY: Math.sin(angle) * (28 + dist * p.value) },
      { scale: 1 - 0.55 * p.value },
    ],
  }));
  return (
    <Animated.View
      style={[{ position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color }, style]}
    />
  );
}

function EchoRing({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 1400, easing: EASE_OUT }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 0.4 * (1 - p.value),
    transform: [{ scale: 1 + 1.1 * p.value }],
  }));
  return <Animated.View style={[styles.echo, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: GAP,
  },
  cell: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
  },
  shineTrack: {
    position: "absolute",
    top: -1.5,
    left: 8,
    right: 8,
    height: 2,
    overflow: "hidden",
    borderRadius: 1,
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  digit: {
    fontFamily: fontFamilies.display.regular,
    color: INK,
    includeFontPadding: false,
    letterSpacing: -0.5,
  },
  caret: {
    width: 2,
    borderRadius: 1,
    backgroundColor: OLIVE,
  },
  hiddenInput: {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: 0.015,
    color: "transparent",
  },
  sealWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  sealGlow: {
    position: "absolute",
    width: 260,
    height: 260,
  },
  halo: {
    position: "absolute",
  },
  echo: {
    position: "absolute",
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    borderWidth: 1,
    borderColor: colors.olive[500],
  },
  sealShell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CELL_FILLED,
    borderWidth: 1.5,
    borderColor: OLIVE_HOT,
    shadowColor: colors.olive[800],
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sealClip: {
    overflow: "hidden",
  },
  sealInner: {
    position: "absolute",
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: SEAL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.35)",
  },
});
