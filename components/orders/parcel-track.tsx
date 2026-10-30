/**
 * Shared "parcel" tracking pieces for the buyer order list + detail:
 * LUXE palette, status ribbons, the four-node dotted rail, ETA estimate
 * and the cardboard-parcel corner art.
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { LUX } from "@/components/orders/luxe-order";
import type { Order, OrderStatus } from "@/lib/types";

/* LUXE system palette (olive · lime · gold on paper) — mirrors LUX in luxe-order. */
export const C = {
  accent: colors.olive[600],
  accentSoft: colors.olive[50],
  ink: LUX.ink,
  lime: LUX.lime,
  gold: LUX.gold,
  goldSoft: LUX.goldSoft,
  cream: LUX.cream,
  paper: "#f8f7f2",
  glow: "#ebe5cc",
  glowSoft: "#f3efe0",
  text: colors.light.foreground,
  muted: colors.light.mutedForeground,
  faint: "#cfccbc",
  line: "rgba(22,23,15,0.07)",
  card: "#FFFFFF",
  rust: LUX.rust,
} as const;

export const TRANSIT: OrderStatus[] = ["shipped", "out_for_delivery", "failed_attempt"];
export const PROCESS: OrderStatus[] = ["pending", "confirmed", "processing"];
export const CLOSED: OrderStatus[] = ["cancelled", "returned", "refunded"];

export const RIBBON: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "PROCESS", bg: LUX.ink, fg: LUX.goldSoft },
  confirmed: { label: "PROCESS", bg: LUX.ink, fg: LUX.goldSoft },
  processing: { label: "PROCESS", bg: LUX.ink, fg: LUX.goldSoft },
  shipped: { label: "TRANSIT", bg: colors.olive[700], fg: LUX.lime },
  out_for_delivery: { label: "ON ROUTE", bg: colors.olive[700], fg: LUX.lime },
  failed_attempt: { label: "RETRY", bg: LUX.rust, fg: LUX.cream },
  delivered: { label: "DELIVERED", bg: LUX.lime, fg: LUX.ink },
  cancelled: { label: "CANCELLED", bg: LUX.rust, fg: LUX.cream },
  returned: { label: "RETURNED", bg: LUX.gold, fg: LUX.ink },
  refunded: { label: "REFUNDED", bg: LUX.gold, fg: LUX.ink },
};

/* Four-node rail: Placed → Packing → Transit → Delivered. */
export const STAGES = 4;
export function stageOf(status: OrderStatus): number {
  if (status === "pending") return 0;
  if (status === "confirmed" || status === "processing") return 1;
  if (TRANSIT.includes(status)) return 2;
  if (status === "delivered") return 3;
  return 1;
}

/** Typical lead time used for the estimate until couriers report a real ETA. */
export const LEAD_DAYS = 5;
/** Days still ahead from each rail stage — keeps late orders' ETA rolling forward. */
export const DAYS_LEFT = [4, 3, 1, 0];
export const DAY = 86_400_000;

export function shortDate(iso: string | number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  return `${day} ${mon} ${String(d.getFullYear()).slice(2)}`;
}

export function etaFor(o: Order) {
  const placed = new Date(o.placed_at).getTime();
  const eta =
    o.status === "out_for_delivery"
      ? Date.now()
      : Math.max(placed + LEAD_DAYS * DAY, Date.now() + DAYS_LEFT[stageOf(o.status)] * DAY);
  return { eta, left: eta - Date.now() };
}

export function awayLabel(o: Order): string | null {
  if (CLOSED.includes(o.status) || o.status === "delivered") return null;
  if (o.status === "out_for_delivery") return "Today";
  if (o.status === "failed_attempt") return "Rescheduling";
  const { left } = etaFor(o);
  if (left <= 0) return "Arriving soon";
  const hrs = Math.ceil(left / 3_600_000);
  if (hrs < 24) return `${hrs}h Away`;
  return `${Math.ceil(left / DAY)}d Away`;
}

type McIcon = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const ORDER_ICONS: McIcon[] = ["clipboard-check-outline", "package-variant-closed", "truck-fast", "home-variant-outline"];

export function TrackRail({ order: o }: { order: Order }) {
  const closed = CLOSED.includes(o.status);
  return (
    <DottedRail
      stage={stageOf(o.status)}
      icons={ORDER_ICONS}
      finished={o.status === "delivered"}
      closed={closed}
      failed={o.status === "failed_attempt"}
      label={closed ? RIBBON[o.status].label.toLowerCase() : awayLabel(o)}
    />
  );
}

/**
 * Generic dotted progress rail: done ticks, a pulsing current node with a
 * stage icon, muted todo ticks. `closed` swaps the current node for a rust ✕.
 */
export function DottedRail({
  stage,
  icons,
  finished = false,
  closed = false,
  failed = false,
  label,
}: {
  stage: number;
  icons: McIcon[];
  finished?: boolean;
  closed?: boolean;
  failed?: boolean;
  label: string | null;
}) {
  const count = icons.length;
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    let kind: NodeKind;
    if (closed) kind = i === stage ? "closed" : i < stage ? "doneMuted" : "todo";
    else if (finished || i < stage) kind = "done";
    else if (i === stage) kind = "current";
    else kind = "todo";

    nodes.push(
      <RailNode
        key={`n${i}`}
        kind={kind}
        icon={icons[i]}
        failed={failed}
        label={kind === "current" || kind === "closed" ? label : null}
      />,
    );
    if (i < count - 1) {
      const lit = !closed && (finished || i < stage);
      nodes.push(<Dots key={`d${i}`} color={lit ? C.accent : C.faint} />);
    }
  }

  return <View style={styles.rail}>{nodes}</View>;
}

export type NodeKind = "done" | "doneMuted" | "current" | "todo" | "closed";

export function RailNode({
  kind,
  icon,
  failed,
  label,
}: {
  kind: NodeKind;
  icon: McIcon;
  failed: boolean;
  label: string | null;
}) {
  return (
    <View style={styles.nodeSlot}>
      {label ? (
        <Text
          style={[styles.nodeLabel, kind === "closed" && { color: C.rust, textTransform: "capitalize" }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
      {kind === "current" ? (
        <CurrentNode icon={icon} failed={failed} />
      ) : kind === "closed" ? (
        <View style={[styles.nodeSm, { backgroundColor: C.rust }]}>
          <Ionicons name="close" size={13} color={C.cream} />
        </View>
      ) : kind === "done" || kind === "doneMuted" ? (
        <View style={[styles.nodeSm, { backgroundColor: kind === "done" ? C.accent : C.faint }]}>
          <Ionicons name="checkmark" size={13} color={kind === "done" ? C.lime : "#fff"} />
        </View>
      ) : (
        <View style={[styles.nodeSm, styles.nodeTodo]}>
          <Ionicons name="checkmark" size={11} color={C.faint} />
        </View>
      )}
    </View>
  );
}

export function CurrentNode({ icon, failed }: { icon: McIcon; failed: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }));
  const tint = failed ? C.rust : C.lime;
  return (
    <View style={styles.nodeLgWrap}>
      <Animated.View style={[styles.nodePulse, { backgroundColor: failed ? C.rust : C.accent }, ring]} />
      <View style={[styles.nodeLg, { borderColor: failed ? C.rust : C.gold }]}>
        <MaterialCommunityIcons name={icon} size={17} color={tint} />
      </View>
    </View>
  );
}

export function Dots({ color }: { color: string }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** Two stacked cardboard parcels drawn with views — the card's corner motif. */
export function ParcelArt() {
  return (
    <View pointerEvents="none" style={styles.art}>
      <Box w={54} h={40} style={{ right: 2, bottom: 40 }} />
      <Box w={68} h={48} style={{ right: -12, bottom: -6 }} label />
      <Box w={42} h={32} style={{ right: 50, bottom: -8 }} />
    </View>
  );
}

export function Box({ w, h, style, label }: { w: number; h: number; style: object; label?: boolean }) {
  const lid = Math.round(h * 0.26);
  return (
    <View style={[{ position: "absolute", width: w, height: h + lid }, style]}>
      <LinearGradient
        colors={["#f1e2b4", "#e3c784"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.boxLid, { height: lid, width: w, transform: [{ skewX: "-38deg" }], left: lid * 0.39 }]}
      />
      <LinearGradient
        colors={["#d8b468", "#ac8636"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.boxFront, { top: lid, width: w, height: h }]}
      >
        <View style={[styles.boxTape, { left: w / 2 - 6 }]} />
        {label ? (
          <View style={styles.boxLabel}>
            <View style={[styles.boxLabelLine, { width: 18 }]} />
            <View style={[styles.boxLabelLine, { width: 12 }]} />
            <View style={styles.boxBarcode} />
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    marginRight: 78,
    height: 44,
  },
  nodeSlot: { width: 34, alignItems: "center", justifyContent: "center" },
  nodeLabel: {
    position: "absolute",
    top: -20,
    width: 96,
    textAlign: "center",
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: C.text,
  },
  nodeSm: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nodeTodo: { borderWidth: 1.5, borderColor: C.faint, backgroundColor: "#FFFFFF" },
  nodeLgWrap: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  nodePulse: { position: "absolute", width: 38, height: 38, borderRadius: 19 },
  nodeLg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  dot: { width: 3.5, height: 3.5, borderRadius: 1.75 },

  art: { position: "absolute", right: 0, bottom: 0, width: 120, height: 110 },
  boxLid: { position: "absolute", top: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  boxFront: { position: "absolute", left: 0, borderRadius: 4, overflow: "hidden" },
  boxTape: { position: "absolute", top: 0, width: 12, height: 14, backgroundColor: "rgba(122,92,20,0.32)" },
  boxLabel: {
    position: "absolute",
    right: 16,
    bottom: 9,
    width: 20,
    height: 22,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.88)",
    padding: 3,
    gap: 2,
  },
  boxLabelLine: { height: 2, borderRadius: 1, backgroundColor: "rgba(26,26,26,0.45)" },
  boxBarcode: { marginTop: 2, flex: 1, borderRadius: 1, backgroundColor: "rgba(26,26,26,0.7)" },
});

/** FROM / TO style columns shared by the list card and the detail booking card. */
export const routeStyles = StyleSheet.create({
  route: { flexDirection: "row", gap: 14, marginTop: 18, paddingRight: 62 },
  routeCol: { flex: 1, minWidth: 0 },
  routeLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.muted,
  },
  routeValue: {
    marginTop: 4,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: C.text,
  },
  routeSub: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted },
});
