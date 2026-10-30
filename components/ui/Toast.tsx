import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";

/**
 * In-app notifications as a Dynamic Island. The pill is pure black so on
 * iPhones with an island it grows straight out of it: island → compact pill
 * (emblem left of the island, status glyph right of it) → expanded card whose
 * content hangs below the island → back into the island. Like a real Live
 * Activity the status bar hides while it's up, since the hardware island and
 * the clock draw over app content. Phones without an island get the same
 * morph from a small pill at the top. A new toast while one is showing swaps
 * the content in place.
 */

export type ToastType = "success" | "error" | "info";

type IconName = keyof typeof Ionicons.glyphMap;

export interface ToastOptions {
  title?: string;
  subtitle?: string;
  duration?: number;
  /** Product thumbnail shown in place of the status icon. */
  image?: string;
  /** Ionicons glyph for the emblem; inferred from the message when omitted. */
  icon?: IconName;
  /** Optional inline action, e.g. "View bag". Tapping it also dismisses the toast. */
  action?: { label: string; onPress: () => void };
}

interface ToastItemData {
  id: string;
  title: string;
  subtitle?: string;
  type: ToastType;
  duration: number;
  image?: string;
  icon: IconName;
  /** Short word for the compact pill, e.g. "Basket". */
  label: string;
  /** Glyph on the right of the pill. */
  status: IconName;
  action?: ToastOptions["action"];
}

interface ToastContextValue {
  toast: {
    (message: string, type?: ToastType, options?: ToastOptions): void;
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
  };
}

const ToastContext = createContext<ToastContextValue>({
  toast: Object.assign(() => {}, {
    success: () => {},
    error: () => {},
    info: () => {},
  }),
});

const ACCENT: Record<ToastType, string> = {
  success: "#c8e08a", // LUXE lime
  error: "#ff9d8c",
  info: "#ebe5cc",
};
const CREAM = "#faf8f1";

// Island geometry (points) for iPhone 14 Pro and later.
const ISLAND_W = 126;
const ISLAND_H = 37;
/** Leading/trailing slots either side of the hardware island. */
const COMPACT_SIDE = 46;
const COMPACT_W_PLAIN = 212;

const SPRING_GROW = { damping: 16, stiffness: 210, mass: 0.9 };
const SPRING_FULL = { damping: 18, stiffness: 175, mass: 1 };
const SPRING_BACK = { damping: 22, stiffness: 260, mass: 0.9 };
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Pick an emblem, compact label and status glyph from the message. */
function describe(
  text: string,
  type: ToastType,
): Pick<ToastItemData, "icon" | "label" | "status"> {
  const removed = /\bremov|\bdelet|\bcleared/i.test(text);
  if (/wishlist/i.test(text)) {
    return {
      icon: removed ? "heart-dislike" : "heart",
      label: "Wishlist",
      status: removed ? "remove" : "heart",
    };
  }
  if (/basket|\bbag\b|shopping bag/i.test(text)) {
    return {
      icon: "bag-handle",
      label: "Basket",
      status: removed ? "remove" : "checkmark",
    };
  }
  if (type === "error")
    return { icon: "alert", label: "LUXE", status: "close" };
  if (type === "info")
    return { icon: "sparkles", label: "LUXE", status: "information" };
  return { icon: "checkmark", label: "LUXE", status: "checkmark" };
}

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastItemData | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = "info", options?: ToastOptions) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 5);
      const title = options?.title ?? message;
      const subtitle = options?.title ? message : options?.subtitle;
      const meta = describe(`${title} ${subtitle ?? ""}`, type);
      setCurrent({
        id,
        title,
        subtitle,
        type,
        duration: options?.duration ?? 3200,
        image: options?.image,
        icon: options?.icon ?? meta.icon,
        label: meta.label,
        status: meta.status,
        action: options?.action,
      });
    },
    [],
  );

  const toastFn = useCallback(
    Object.assign(
      (message: string, type: ToastType = "info", options?: ToastOptions) =>
        show(message, type, options),
      {
        success: (message: string, options?: ToastOptions) =>
          show(message, "success", options),
        error: (message: string, options?: ToastOptions) =>
          show(message, "error", options),
        info: (message: string, options?: ToastOptions) =>
          show(message, "info", options),
      },
    ),
    [show],
  );

  const handleDone = useCallback((id: string) => {
    setCurrent((c) => (c?.id === id ? null : c));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: toastFn }}>
      {children}
      {current ? <Island toast={current} onDone={handleDone} /> : null}
    </ToastContext.Provider>
  );
}

type Stage = "grow" | "compact" | "full" | "collapse";

function Island({
  toast,
  onDone,
}: {
  toast: ToastItemData;
  onDone: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const hasIsland = Platform.OS === "ios" && insets.top >= 51;
  // The island sits ~48pt above the safe-area top on every island iPhone.
  const top = hasIsland ? insets.top - 48 : Math.max(insets.top, 8) + 6;
  const fullW = Math.min(screenW - 18, 420);
  const compactW = hasIsland ? ISLAND_W + COMPACT_SIDE * 2 : COMPACT_W_PLAIN;
  // On island phones the expanded content sits below the island itself.
  const insetTop = hasIsland ? ISLAND_H + 2 : 0;
  const rowH = (t: ToastItemData) => (t.subtitle || t.action ? 70 : 60);
  const fullHFor = (t: ToastItemData) =>
    insetTop + rowH(t) + (hasIsland ? 4 : 0);

  const [stage, setStage] = useState<Stage>("grow");
  const [shown, setShown] = useState(toast);

  const w = useSharedValue(ISLAND_W);
  const h = useSharedValue(ISLAND_H);
  const op = useSharedValue(hasIsland ? 1 : 0);
  const bump = useSharedValue(1);
  const drag = useSharedValue(0);
  const shadow = useSharedValue(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) =>
    timers.current.push(setTimeout(fn, ms));
  const stageRef = useRef<Stage>("grow");
  const setPhase = (s: Stage) => {
    stageRef.current = s;
    setStage(s);
  };

  const finish = useCallback(() => onDone(toast.id), [onDone, toast.id]);

  const collapse = useCallback(() => {
    if (stageRef.current === "collapse") return;
    clearTimers();
    setPhase("collapse");
    shadow.value = withTiming(0, { duration: 200 });
    drag.value = withSpring(0, SPRING_BACK);
    later(130, () => {
      w.value = withSpring(ISLAND_W, SPRING_BACK);
      h.value = withSpring(ISLAND_H, SPRING_BACK);
    });
    later(520, () => {
      // Same black as the island, so this fade is invisible where one exists.
      op.value = withTiming(0, { duration: hasIsland ? 120 : 220 }, (done) => {
        if (done) runOnJS(finish)();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, hasIsland]);

  const expandFull = (t: ToastItemData = toast) => {
    setPhase("full");
    w.value = withSpring(fullW, SPRING_FULL);
    h.value = withSpring(fullHFor(t), SPRING_FULL);
    shadow.value = withTiming(1, { duration: 400 });
  };

  // First appearance: island → compact pill → full notification.
  useEffect(() => {
    op.value = withTiming(1, { duration: 160 });
    w.value = withSpring(compactW, SPRING_GROW);
    later(60, () => setPhase("compact"));
    later(820, () => expandFull());
    later(820 + toast.duration, collapse);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new toast while this one is up: swap content in place and restart the clock.
  useEffect(() => {
    if (toast.id === shown.id) return;
    setShown(toast);
    clearTimers();
    op.value = withTiming(1, { duration: 120 });
    bump.value = withSequence(
      withTiming(1.035, { duration: 140, easing: EASE_OUT }),
      withSpring(1, { damping: 10, stiffness: 240 }),
    );
    expandFull(toast);
    later(toast.duration, collapse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        drag.value = g.dy < 0 ? g.dy : g.dy * 0.12;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24 || g.vy < -0.5) collapse();
        else drag.value = withSpring(0, SPRING_BACK);
      },
      onPanResponderTerminate: () => {
        drag.value = withSpring(0, SPRING_BACK);
      },
    }),
  ).current;

  const pillStyle = useAnimatedStyle(() => ({
    width: w.value,
    height: h.value,
    borderRadius: Math.min(h.value / 2, 36),
    opacity: op.value,
    shadowOpacity: 0.32 * shadow.value,
    transform: [
      { translateY: Math.min(0, drag.value) * 0.9 + Math.max(0, drag.value) },
      { scale: bump.value },
    ],
  }));

  const accent = ACCENT[shown.type];

  return (
    <View pointerEvents="box-none" style={[styles.host, { top }]}>
      {hasIsland && <StatusBar hidden={stage !== "collapse"} animated />}
      <Animated.View {...swipe.panHandlers} style={[styles.pill, pillStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={collapse}
          accessibilityRole="alert"
          accessibilityLabel={
            shown.subtitle ? `${shown.title}. ${shown.subtitle}` : shown.title
          }
        >
          {stage === "compact" && (
            <CompactContent
              key="compact"
              toast={shown}
              accent={accent}
              split={hasIsland}
            />
          )}
          {stage === "full" && (
            <FullContent
              key={`full-${shown.id}`}
              toast={shown}
              accent={accent}
              onAction={collapse}
              insetTop={insetTop}
              rowH={rowH(shown)}
            />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* --------------------------------------------------------------- content */

function Emblem({
  toast,
  accent,
  size,
}: {
  toast: ToastItemData;
  accent: string;
  size: number;
}) {
  const pop = useSharedValue(0.4);
  useEffect(() => {
    pop.value = withDelay(
      80,
      withSpring(1, { damping: 9, stiffness: 220, mass: 0.7 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const r = size / 2;
  if (toast.image) {
    return (
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Image
          source={{ uri: toast.image }}
          style={{
            width: size,
            height: size,
            borderRadius: r,
            backgroundColor: "#2a2c1f",
          }}
          contentFit="cover"
          transition={150}
        />
        <View
          style={[
            styles.badge,
            { backgroundColor: accent, right: -2, bottom: -2 },
          ]}
        >
          <Ionicons
            name={toast.icon}
            size={size > 30 ? 10 : 8}
            color="#14150e"
          />
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: r, backgroundColor: accent },
        styles.center,
        style,
      ]}
    >
      <Ionicons
        name={toast.icon}
        size={Math.round(size * 0.48)}
        color="#14150e"
      />
    </Animated.View>
  );
}

/** Animated status glyph — the check lands, the heart beats. */
function StatusGlyph({
  name,
  accent,
  size,
  delay,
}: {
  name: IconName;
  accent: string;
  size: number;
  delay: number;
}) {
  const s = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(delay, withTiming(1, { duration: 160 }));
    s.value =
      name === "heart"
        ? withDelay(
            delay,
            withSequence(
              withSpring(1.25, { damping: 6, stiffness: 300 }),
              withTiming(0.92, { duration: 140 }),
              withSpring(1.12, { damping: 6, stiffness: 300 }),
              withSpring(1, { damping: 10, stiffness: 200 }),
            ),
          )
        : withDelay(
            delay,
            withSpring(1, { damping: 8, stiffness: 260, mass: 0.6 }),
          );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: s.value }],
  }));
  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={size} color={accent} />
    </Animated.View>
  );
}

function CompactContent({
  toast,
  accent,
  split,
}: {
  toast: ToastItemData;
  accent: string;
  split: boolean;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(220).delay(90)}
      exiting={FadeOut.duration(140)}
      style={styles.compact}
    >
      <View style={styles.compactLeft}>
        <Emblem toast={toast} accent={accent} size={27} />
        {/* With a hardware island the middle is covered, so no label. */}
        {!split && (
          <Text style={styles.compactLabel} numberOfLines={1}>
            {toast.label}
          </Text>
        )}
      </View>
      <StatusGlyph name={toast.status} accent={accent} size={18} delay={260} />
    </Animated.View>
  );
}

function FullContent({
  toast,
  accent,
  onAction,
  insetTop,
  rowH,
}: {
  toast: ToastItemData;
  accent: string;
  onAction: () => void;
  insetTop: number;
  rowH: number;
}) {
  return (
    <>
      {/* Header either side of the hardware island, like a Live Activity. */}
      {insetTop > 0 && (
        <Animated.View
          entering={FadeIn.duration(300).delay(200)}
          style={[styles.islandHeader, { height: insetTop }]}
        >
          <View style={styles.brand}>
            <View style={[styles.brandDot, { backgroundColor: accent }]} />
            <Text style={styles.brandText}>LUXE</Text>
          </View>
          <Text style={[styles.kindText, { color: accent }]}>
            {toast.label === "LUXE" ? "NOW" : toast.label.toUpperCase()}
          </Text>
        </Animated.View>
      )}
      <View style={[styles.full, { marginTop: insetTop, height: rowH }]}>
        <Animated.View entering={FadeIn.duration(260).delay(120)}>
          <Emblem
            toast={toast}
            accent={accent}
            size={toast.subtitle || toast.action ? 48 : 40}
          />
        </Animated.View>
        <View style={styles.textCol}>
          <Animated.Text
            entering={FadeInDown.duration(380).delay(170)}
            style={styles.title}
            numberOfLines={1}
          >
            {toast.title}
          </Animated.Text>
          {toast.subtitle ? (
            <Animated.Text
              entering={FadeInDown.duration(380).delay(230)}
              style={styles.subtitle}
              numberOfLines={1}
            >
              {toast.subtitle}
            </Animated.Text>
          ) : null}
        </View>
        <Animated.View entering={FadeIn.duration(260).delay(260)}>
          {toast.action ? (
            <Pressable
              onPress={() => {
                toast.action?.onPress();
                onAction();
              }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: accent },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
            >
              <Text style={styles.actionText}>{toast.action.label}</Text>
            </Pressable>
          ) : (
            <View style={[styles.statusRing, { borderColor: `${accent}55` }]}>
              <StatusGlyph
                name={toast.status}
                accent={accent}
                size={16}
                delay={320}
              />
            </View>
          )}
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999999,
    elevation: 999,
  },
  pill: {
    backgroundColor: "#000",
    overflow: "hidden",
    shadowColor: "#000",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  center: { alignItems: "center", justifyContent: "center" },
  compact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 5,
    paddingRight: 12,
  },
  compactLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  compactLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: CREAM,
    letterSpacing: 0.1,
  },
  full: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 13,
    paddingRight: 16,
    gap: 12,
  },
  textCol: { flex: 1, gap: 2 },
  islandHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandDot: { width: 5, height: 5, borderRadius: 3 },
  brandText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 13,
    letterSpacing: 2.4,
    color: "rgba(250,248,241,0.82)",
  },
  kindText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.8,
  },
  title: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: CREAM,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(250,248,241,0.58)",
  },
  badge: {
    position: "absolute",
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  statusRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: "#14150e",
    letterSpacing: 0.2,
  },
});
