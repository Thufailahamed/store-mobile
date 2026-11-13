/**
 * CancelOrderSheet — floating bottom sheet that turns the cancel action into
 * one continuous motion, timed frame-by-frame on the reference
 * "Finish → Preparing → All set" study:
 *
 *   form     white sheet: order summary, reason rows, CANCEL ORDER button
 *   press    the label vanishes at once; the button grows upward until it is
 *            the sheet (a thin white rim survives a beat, then closes), while
 *            the sheet itself stretches a little taller. "Cancelling" rides
 *            in on the fill's top edge, fading up as the fill climbs.
 *   working  ~0.5s later a dashed ghost card rises from below, tilted, and
 *            straightens into a slow sway + breathe. A STOP pill fades in.
 *            The request is deferred until STOP_WINDOW_MS so STOP is a real
 *            undo.
 *   reveal   a tiny white dot opens on the ghost and accelerates into a soft
 *            white bloom; the real order card is already there at the ghost's
 *            size. The sheet then grows taller (everything rides up), the card
 *            scales to full size, DONE slides up from the bottom edge and the
 *            two back cards spring out from behind it last.
 *   error    the sheet collapses back to the form and the parent toasts.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/lib/types";

/* ---------- palette ---------- */
const FILL = "#cf5b3e"; // the sheet's working colour (rust, brightened for a full-bleed surface)
const FILL_TINT = "rgba(207,91,62,0.10)";
const CARD = "#b34a30"; // the order card: one step deeper than the fill
const CARD_BACK = "#963b25";
const SURFACE = "#ffffff";
const ROW_BG = "#f4f2ee";
const TEXT = "#1d1d1b";
const MUTED = "#8a877f";

/* ---------- timing (ms) ---------- */
const MORPH_MS = 340;
const RIM_DELAY = 360;
const GHOST_DELAY = 480;
const GHOST_MS = 560;
const STOP_DELAY = 1150;
const STOP_WINDOW_MS = 1900;
const MIN_WORKING_MS = 2700;
const BLOOM_MS = 340;
const GROW_DELAY = 220;
const GROW_MS = 440;
const FAN_DELAY = 640;

/* ---------- geometry ---------- */
const H_FORM = 474;
const H_WORK = 492;
const H_DONE = 526;
const GHOST_W = 138;
const GHOST_H = 178;
const CARD_W = 206;
const CARD_H = 266;
/** ghost + card share one centre, measured from the sheet's top edge */
const CARD_CY = 282;

export const CANCEL_REASONS = [
  { key: "changed_mind", label: "Changed my mind" },
  { key: "ordered_by_mistake", label: "Ordered by mistake" },
  { key: "found_cheaper", label: "Found an alternative" },
  { key: "other", label: "Something else" },
] as const;

type Phase = "form" | "working" | "done";

export interface CancelOrderSheetProps {
  open: boolean;
  order: Pick<Order, "order_number" | "total" | "currency" | "payment_status" | "items">;
  /** Runs the actual cancellation. Resolve `{ ok: false, error }` to roll back. */
  submit: (reason: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Fires the moment the cancellation succeeds (before the user taps DONE). */
  onCancelled: () => void;
  onError: (message: string) => void;
  onClose: () => void;
  bottomInset: number;
}

export function CancelOrderSheet({
  open,
  order,
  submit,
  onCancelled,
  onError,
  onClose,
  bottomInset,
}: CancelOrderSheetProps) {
  const { width: winW } = useWindowDimensions();
  const sheetW = winW - 20;

  const [visible, setVisible] = useState(open);
  const [phase, setPhase] = useState<Phase>("form");
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0].key);
  const [btn, setBtn] = useState<LayoutRectangle | null>(null);
  const [reduced, setReduced] = useState(false);

  const enter = useSharedValue(0); // sheet slide-in + backdrop
  const sheetH = useSharedValue(H_FORM);
  const label = useSharedValue(1); // button label
  const morph = useSharedValue(0); // button → full sheet
  const rim = useSharedValue(0); // white rim closes
  const ghost = useSharedValue(0); // ghost card rise
  const stopIn = useSharedValue(0); // STOP pill
  const sway = useSharedValue(0); // idle float clock
  const bloom = useSharedValue(0); // white reveal
  const grow = useSharedValue(0); // done layout settle
  const fan = useSharedValue(0); // back cards

  const startedAt = useRef(0);
  const stopped = useRef(false);
  const fired = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
  }, []);

  /* ---------- open / close ---------- */
  useEffect(() => {
    if (open) {
      setVisible(true);
      setPhase("form");
      setReason(CANCEL_REASONS[0].key);
      sheetH.value = H_FORM;
      label.value = 1;
      morph.value = 0;
      rim.value = 0;
      ghost.value = 0;
      stopIn.value = 0;
      bloom.value = 0;
      grow.value = 0;
      fan.value = 0;
      enter.value = 0;
      enter.value = withSpring(1, { damping: 22, stiffness: 210, mass: 0.9 });
    } else if (visible) {
      clearTimers();
      enter.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }, (f) => {
        if (f) runOnJS(setVisible)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => clearTimers(), []);

  /* ---------- flow ---------- */
  const collapseToForm = useCallback(() => {
    cancelAnimation(sway);
    stopIn.value = withTiming(0, { duration: 160 });
    ghost.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) });
    rim.value = withTiming(0, { duration: 160 });
    sheetH.value = withDelay(120, withTiming(H_FORM, { duration: MORPH_MS, easing: Easing.inOut(Easing.cubic) }));
    label.value = withDelay(120 + MORPH_MS, withTiming(1, { duration: 180 }));
    morph.value = withDelay(
      120,
      withTiming(0, { duration: MORPH_MS + 60, easing: Easing.inOut(Easing.cubic) }, (f) => {
        if (f) runOnJS(setPhase)("form");
      }),
    );
  }, [ghost, label, morph, rim, sheetH, stopIn, sway]);

  const showDone = useCallback(() => {
    setPhase("done");
    stopIn.value = withTiming(0, { duration: 120 });
    bloom.value = withTiming(1, { duration: BLOOM_MS, easing: Easing.in(Easing.quad) });
    sheetH.value = withDelay(GROW_DELAY, withTiming(H_DONE, { duration: GROW_MS, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }));
    grow.value = withDelay(GROW_DELAY, withTiming(1, { duration: GROW_MS, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }));
    fan.value = withDelay(FAN_DELAY, withSpring(1, { damping: 12, stiffness: 140, mass: 0.85 }));
  }, [bloom, fan, grow, sheetH, stopIn]);

  const fire = useCallback(async () => {
    if (stopped.current || fired.current) return;
    fired.current = true;
    stopIn.value = withTiming(0, { duration: 220 });
    const res = await submit(reason);
    if (stopped.current) return;
    if (!res.ok) {
      onError(res.error);
      collapseToForm();
      return;
    }
    onCancelled();
    const wait = Math.max(0, MIN_WORKING_MS - (Date.now() - startedAt.current));
    timers.current.push(setTimeout(showDone, wait));
  }, [collapseToForm, onCancelled, onError, reason, showDone, stopIn, submit]);

  const start = () => {
    if (phase !== "form" || !btn) return;
    stopped.current = false;
    fired.current = false;
    startedAt.current = Date.now();
    setPhase("working");
    label.value = withTiming(0, { duration: 70 });
    morph.value = withTiming(1, { duration: MORPH_MS, easing: Easing.bezier(0.45, 0, 0.2, 1) });
    sheetH.value = withTiming(H_WORK, { duration: MORPH_MS + 80, easing: Easing.out(Easing.cubic) });
    rim.value = withDelay(RIM_DELAY, withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    ghost.value = withDelay(GHOST_DELAY, withTiming(1, { duration: GHOST_MS, easing: Easing.out(Easing.cubic) }));
    stopIn.value = withDelay(STOP_DELAY, withTiming(1, { duration: 320 }));
    sway.value = 0;
    if (!reduced) {
      sway.value = withDelay(
        GHOST_DELAY + GHOST_MS - 120,
        withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false),
      );
    }
    timers.current.push(setTimeout(fire, STOP_WINDOW_MS));
  };

  const stop = () => {
    if (fired.current) return;
    stopped.current = true;
    clearTimers();
    collapseToForm();
  };

  /* ---------- styles ---------- */
  const backdropStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetH.value,
    transform: [{ translateY: (1 - enter.value) * (H_DONE + 40) }],
  }));

  // Form content is pinned to the sheet's bottom so the stretch reads as the
  // sheet growing upward, exactly like the reference.
  const formStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, morph.value * 1.3) }));

  const fillStyle = useAnimatedStyle(() => {
    const b = btn ?? { x: 16, y: H_FORM - 68, width: sheetW - 32, height: 52 };
    const m = morph.value;
    const inset = 3 * (1 - rim.value) * m;
    // the button's distance from the sheet bottom stays put while it grows up
    const fromBottom = H_FORM - (b.y + b.height);
    const startTop = sheetH.value - fromBottom - b.height;
    const top = startTop * (1 - m) + inset * m;
    const left = b.x * (1 - m) + inset * m;
    const bottomGap = fromBottom * (1 - m) + inset * m;
    return {
      left,
      top,
      width: b.width + (sheetW - 2 * inset - b.width) * m,
      height: sheetH.value - top - bottomGap,
      borderRadius: 15 + (26 - 15) * m,
    };
  });
  const btnLabelStyle = useAnimatedStyle(() => ({ opacity: label.value }));
  // rides on the fill's top edge, fades up as the fill climbs
  const workingHeadStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (morph.value - 0.3) / 0.6));
    return {
      opacity: p * (1 - Math.min(1, bloom.value * 1.6)),
      transform: [{ translateY: (1 - p) * 6 }],
    };
  });

  const ghostStyle = useAnimatedStyle(() => {
    const g = ghost.value;
    const a = sway.value * Math.PI * 2;
    return {
      opacity: Math.min(1, g * 3) * (1 - Math.min(1, bloom.value * 2.5)),
      transform: [
        { translateY: (1 - g) * 300 + Math.sin(a * 2) * 4 * g },
        { rotate: `${(1 - g) * 7 + Math.sin(a) * 3.6 * g}deg` },
        { scale: 1 + Math.sin(a * 2 + 0.8) * 0.016 * g },
      ],
    };
  });
  const stopStyle = useAnimatedStyle(() => ({
    opacity: stopIn.value,
    transform: [{ translateY: (1 - stopIn.value) * 6 }],
  }));

  const cover = (Math.sqrt(sheetW * sheetW + H_DONE * H_DONE) * 2.4) / 200;
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.value > 0 ? 1 : 0,
    transform: [{ scale: 0.07 + bloom.value * cover }],
  }));
  // done layer appears through the bloom
  const doneLayerStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, (bloom.value - 0.25) / 0.45)) }));
  const doneHeadStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (bloom.value - 0.45) / 0.55));
    return { opacity: p, transform: [{ scale: 0.94 + 0.06 * p }] };
  });
  const doneSubStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (bloom.value - 0.6) / 0.4));
    return { opacity: 0.4 + 0.6 * grow.value * p };
  });
  const doneBtnStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (bloom.value - 0.7) / 0.3));
    return {
      opacity: p * (0.45 + 0.55 * grow.value),
      transform: [{ translateY: (1 - grow.value) * 64 }],
    };
  });

  if (!visible) return null;

  const items = order.items ?? [];
  const pieces = items.reduce((n, i) => n + (i.quantity || 0), 0);
  const total = formatPrice(order.total, order.currency);
  const paid = order.payment_status === "paid";
  const ghostTop = CARD_CY - GHOST_H / 2;

  return (
    <Modal visible transparent animationType="none" onRequestClose={phase === "working" ? stop : onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={phase === "form" ? onClose : undefined} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { width: sheetW, bottom: Math.max(bottomInset, 10) + 4 }, sheetStyle]}>
        {/* ---------- form ---------- */}
        <Animated.View
          style={[styles.formBody, { height: H_FORM }, formStyle]}
          pointerEvents={phase === "form" ? "auto" : "none"}
        >
          <View style={styles.header}>
            <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={FILL} />
            </Pressable>
            <Text style={styles.headerTitle}>Cancel order</Text>
            <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={FILL} />
            </Pressable>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Order #{order.order_number} · {pieces} {pieces === 1 ? "piece" : "pieces"} · {total}.{" "}
              {paid ? "We'll refund you to your original payment method." : "Nothing has been charged yet."}
            </Text>
          </View>

          <Text style={styles.rowsLabel}>Why are you cancelling?</Text>
          {CANCEL_REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={[styles.row, on && styles.rowOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.rowText, on && { color: FILL }]}>{r.label}</Text>
                <View style={[styles.radio, on && styles.radioOn]}>
                  {on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          })}

          <View style={{ flex: 1 }} />
          <View style={styles.btnSlot} onLayout={(e) => setBtn(e.nativeEvent.layout)} />
        </Animated.View>

        {/* ---------- the button that becomes the sheet ---------- */}
        <Animated.View style={[styles.fill, fillStyle]} pointerEvents={phase === "form" ? "auto" : "none"}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={start}
            disabled={phase !== "form"}
            accessibilityRole="button"
            accessibilityLabel="Cancel order"
          >
            <Animated.View style={[styles.btnLabelWrap, btnLabelStyle]}>
              <Text style={styles.btnLabel}>CANCEL ORDER</Text>
            </Animated.View>
          </Pressable>
          {/* title rides on the fill's top edge */}
          <Animated.View style={[styles.workingHead, workingHeadStyle]} pointerEvents="none">
            <Text style={styles.workingTitle}>Cancelling</Text>
            <Text style={styles.workingSub}>Releasing your pieces back to the atelier</Text>
          </Animated.View>
        </Animated.View>

        {/* ---------- working ---------- */}
        {phase !== "form" ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View
              pointerEvents="none"
              style={[styles.ghost, { left: (sheetW - GHOST_W) / 2, top: ghostTop }, ghostStyle]}
            >
              <DashedRect w={GHOST_W} h={GHOST_H} />
            </Animated.View>

            <Animated.View
              style={[styles.stopWrap, { top: ghostTop + GHOST_H + 20 }, stopStyle]}
              pointerEvents={phase === "working" ? "auto" : "none"}
            >
              <Pressable onPress={stop} hitSlop={14} style={styles.stopPill} accessibilityRole="button" accessibilityLabel="Stop, keep my order">
                <Ionicons name="stop-circle-outline" size={15} color="#fff" />
                <Text style={styles.stopText}>STOP</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}

        {/* ---------- reveal ---------- */}
        {phase === "done" ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[styles.bloom, { left: sheetW / 2 - 100, top: CARD_CY - 100 }, bloomStyle]}
            >
              <Svg width={200} height={200}>
                <Defs>
                  <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#fff" stopOpacity={1} />
                    <Stop offset="0.62" stopColor="#fff" stopOpacity={1} />
                    <Stop offset="0.85" stopColor="#fff" stopOpacity={0.55} />
                    <Stop offset="1" stopColor="#fff" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={100} cy={100} r={100} fill="url(#bloom)" />
              </Svg>
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, doneLayerStyle]} pointerEvents="box-none">
              <View style={styles.doneHead} pointerEvents="none">
                <Animated.Text style={[styles.doneTitle, doneHeadStyle]}>CANCELLED</Animated.Text>
                <Animated.Text style={[styles.doneSub, doneSubStyle]}>
                  {paid
                    ? `Your refund of ${total} is on its way to your original payment method.`
                    : "Nothing was charged. Your pieces are back with the atelier."}
                </Animated.Text>
              </View>

              <CardStack
                fan={fan}
                grow={grow}
                left={(sheetW - CARD_W) / 2}
                top={CARD_CY - CARD_H / 2}
                orderNumber={order.order_number}
                lines={items.slice(0, 4).map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.product_name}`)}
                more={Math.max(0, items.length - 4)}
                total={total}
                paid={paid}
              />

              <Animated.View style={[styles.doneBtnWrap, doneBtnStyle]}>
                <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
                  <Text style={styles.btnLabel}>DONE</Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

/* ---------- dashed ghost card ---------- */
function DashedRect({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h}>
      <Rect x={1.5} y={1.5} width={w - 3} height={h - 3} rx={20} fill="rgba(255,255,255,0.13)" />
      <Rect
        x={1.5}
        y={1.5}
        width={w - 3}
        height={h - 3}
        rx={20}
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={1.6}
        strokeDasharray="6 5"
      />
    </Svg>
  );
}

/* ---------- the real order card + two fanned behind ---------- */
function CardStack({
  fan,
  grow,
  left,
  top,
  orderNumber,
  lines,
  more,
  total,
  paid,
}: {
  fan: SharedValue<number>;
  grow: SharedValue<number>;
  left: number;
  top: number;
  orderNumber: string;
  lines: string[];
  more: number;
  total: string;
  paid: boolean;
}) {
  const backL = useAnimatedStyle(() => ({
    opacity: Math.min(1, fan.value * 2),
    transform: [
      { translateX: -14 * fan.value },
      { translateY: 10 * fan.value },
      { rotate: `${-7 * fan.value}deg` },
      { scale: 0.92 + 0.02 * fan.value },
    ],
  }));
  const backR = useAnimatedStyle(() => ({
    opacity: Math.min(1, fan.value * 2),
    transform: [
      { translateX: 14 * fan.value },
      { translateY: 10 * fan.value },
      { rotate: `${7 * fan.value}deg` },
      { scale: 0.92 + 0.02 * fan.value },
    ],
  }));
  // starts at the ghost's footprint, settles to full size with the sheet
  const k0 = GHOST_W / CARD_W;
  const front = useAnimatedStyle(() => ({
    transform: [{ scale: k0 + (1 - k0) * grow.value }],
  }));

  return (
    <View pointerEvents="none" style={{ position: "absolute", left, top, width: CARD_W, height: CARD_H }}>
      <Animated.View style={[styles.card, styles.cardBack, backL]} />
      <Animated.View style={[styles.card, styles.cardBack, backR]} />
      <Animated.View style={[styles.card, front]}>
        <Text style={styles.cardTitle}>Order #{orderNumber}</Text>
        <Text style={styles.cardDesc}>
          {paid ? "Cancelled · refund on its way" : "Cancelled · nothing charged"}
        </Text>
        <View style={styles.cardRule} />
        {lines.map((l, i) => (
          <Text key={i} style={styles.cardLine} numberOfLines={1}>
            · {l}
          </Text>
        ))}
        {more > 0 ? <Text style={styles.cardLine}>· +{more} more</Text> : null}
        <View style={{ flex: 1 }} />
        <View style={styles.cardFoot}>
          <Text style={styles.cardFootLabel}>Total</Text>
          <Text style={styles.cardFootValue}>{total}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(10,10,8,0.55)" },
  sheet: {
    position: "absolute",
    left: 10,
    backgroundColor: SURFACE,
    borderRadius: 28,
    overflow: "hidden",
  },
  formBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingTop: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  headerTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, color: FILL, letterSpacing: -0.2 },
  infoBox: { backgroundColor: FILL_TINT, borderRadius: 16, padding: 14, marginBottom: 16 },
  infoText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, lineHeight: 20, color: "#a9452d" },
  rowsLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: MUTED,
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 2,
  },
  row: {
    height: 44,
    borderRadius: 12,
    backgroundColor: ROW_BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginBottom: 7,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  rowOn: { backgroundColor: FILL_TINT, borderColor: "rgba(207,91,62,0.35)" },
  rowText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: TEXT },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#cfcbc3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: FILL, borderColor: FILL },
  btnSlot: { height: 52, alignSelf: "stretch" },
  fill: { position: "absolute", backgroundColor: FILL, overflow: "hidden" },
  btnLabelWrap: { position: "absolute", left: 0, right: 0, bottom: 0, height: 52, alignItems: "center", justifyContent: "center" },
  btnLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: "#fff", letterSpacing: 0.8 },
  workingHead: { position: "absolute", top: 26, left: 0, right: 0, alignItems: "center" },
  workingTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 25, color: "#fff", letterSpacing: -0.3 },
  workingSub: { marginTop: 3, fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: "rgba(255,255,255,0.6)" },
  ghost: { position: "absolute", width: GHOST_W, height: GHOST_H },
  stopWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  stopPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  stopText: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5, color: "#fff", letterSpacing: 0.8 },
  bloom: { position: "absolute", width: 200, height: 200 },
  doneHead: { position: "absolute", top: 24, left: 28, right: 28, alignItems: "center" },
  doneTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 30, color: FILL, letterSpacing: 0.4 },
  doneSub: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: "rgba(207,91,62,0.7)",
    textAlign: "center",
  },
  card: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    backgroundColor: CARD,
    padding: 16,
    shadowColor: CARD_BACK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  cardBack: { backgroundColor: CARD_BACK, shadowOpacity: 0.12 },
  cardTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, lineHeight: 22, color: "#fff", textAlign: "center" },
  cardDesc: {
    marginTop: 4,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },
  cardRule: { height: 1, backgroundColor: "rgba(255,255,255,0.22)", marginVertical: 12 },
  cardLine: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, lineHeight: 19, color: "rgba(255,255,255,0.92)" },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cardFootLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: "rgba(255,255,255,0.7)" },
  cardFootValue: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: "#fff" },
  doneBtnWrap: { position: "absolute", left: 16, right: 16, bottom: 16 },
  doneBtn: { height: 52, borderRadius: 15, backgroundColor: FILL, alignItems: "center", justifyContent: "center" },
});
