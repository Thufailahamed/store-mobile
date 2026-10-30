/**
 * Shared "luxe" visual language for the buyer order screens
 * (list, detail, live tracking): one status palette, the dark hero shell
 * and the six-step progress rail — mirrors the web tracking redesign.
 */
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import type { OrderStatus } from "@/lib/types";

export const LUX = {
  ink: "#15160f",
  ink2: "#20240f",
  olive: "#2c3119",
  olive2: "#353c1f",
  lime: "#c8e08a",
  gold: "#c8a44a",
  goldSoft: "#e8c88a",
  goldInk: "#7a5c14",
  cream: "#faf8f1",
  rose: "#f2a7a0",
  rust: "#b85c3a",
} as const;

type Tone = {
  /** Short human label used on chips. */
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Accent used on dark surfaces. */
  accent: string;
  /** Chip colours on light surfaces. */
  chipBg: string;
  chipFg: string;
  /** Serif headline split: plain lead + italic accent. */
  lead: string;
  italic: string;
  copy: string;
};

export const ORDER_TONE: Record<OrderStatus, Tone> = {
  pending: {
    label: "Awaiting confirmation",
    icon: "hourglass-outline",
    accent: LUX.goldSoft,
    chipBg: "rgba(200,164,74,0.14)",
    chipFg: LUX.goldInk,
    lead: "Order",
    italic: "received.",
    copy: "The atelier is confirming your pieces and running a quality check.",
  },
  confirmed: {
    label: "Confirmed",
    icon: "checkmark-circle-outline",
    accent: LUX.lime,
    chipBg: "rgba(83,94,44,0.10)",
    chipFg: "#353c1f",
    lead: "Order",
    italic: "confirmed.",
    copy: "Your order is confirmed and queued for preparation.",
  },
  processing: {
    label: "Being prepared",
    icon: "cube-outline",
    accent: LUX.lime,
    chipBg: "rgba(83,94,44,0.10)",
    chipFg: "#353c1f",
    lead: "Being",
    italic: "prepared.",
    copy: "Your pieces are being authenticated and packed for dispatch.",
  },
  shipped: {
    label: "In transit",
    icon: "paper-plane-outline",
    accent: LUX.lime,
    chipBg: LUX.ink,
    chipFg: LUX.lime,
    lead: "On its",
    italic: "way.",
    copy: "Your parcel is moving through our courier network.",
  },
  out_for_delivery: {
    label: "Out for delivery",
    icon: "bicycle-outline",
    accent: LUX.lime,
    chipBg: LUX.ink,
    chipFg: LUX.lime,
    lead: "Arriving",
    italic: "today.",
    copy: "Your rider is on the way — keep your delivery code handy.",
  },
  delivered: {
    label: "Delivered",
    icon: "sparkles-outline",
    accent: LUX.lime,
    chipBg: "rgba(83,94,44,0.10)",
    chipFg: "#353c1f",
    lead: "Delivered,",
    italic: "enjoy.",
    copy: "Your parcel has arrived. We'd love to hear what you think.",
  },
  cancelled: {
    label: "Cancelled",
    icon: "close-circle-outline",
    accent: LUX.rose,
    chipBg: "rgba(184,92,58,0.10)",
    chipFg: LUX.rust,
    lead: "Order",
    italic: "cancelled.",
    copy: "This order was cancelled. Any pre-authorised charge has been released.",
  },
  returned: {
    label: "Returned",
    icon: "return-down-back-outline",
    accent: LUX.goldSoft,
    chipBg: "rgba(200,164,74,0.14)",
    chipFg: LUX.goldInk,
    lead: "Pieces",
    italic: "returned.",
    copy: "Your returned pieces were received and inspected.",
  },
  refunded: {
    label: "Refunded",
    icon: "cash-outline",
    accent: LUX.goldSoft,
    chipBg: "rgba(200,164,74,0.14)",
    chipFg: LUX.goldInk,
    lead: "Refund",
    italic: "issued.",
    copy: "Your refund has been sent to the original payment method.",
  },
  failed_attempt: {
    label: "Delivery rescheduled",
    icon: "alert-circle-outline",
    accent: LUX.rose,
    chipBg: "rgba(184,92,58,0.10)",
    chipFg: LUX.rust,
    lead: "Delivery",
    italic: "rescheduled.",
    copy: "The courier couldn't complete delivery. A new attempt is queued.",
  },
};

export const RAIL_STEPS: { key: OrderStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "pending", label: "Placed", icon: "receipt-outline" },
  { key: "confirmed", label: "Confirmed", icon: "checkmark-outline" },
  { key: "processing", label: "Packing", icon: "cube-outline" },
  { key: "shipped", label: "Shipped", icon: "paper-plane-outline" },
  { key: "out_for_delivery", label: "On route", icon: "bicycle-outline" },
  { key: "delivered", label: "Delivered", icon: "home-outline" },
];

/** Index on the six-step rail, or -1 for off-path statuses (cancelled etc.). */
export function railIndex(status: OrderStatus): number {
  if (status === "failed_attempt") return 4;
  return RAIL_STEPS.findIndex((s) => s.key === status);
}

export const IN_FLIGHT: OrderStatus[] = ["confirmed", "processing", "shipped", "out_for_delivery", "failed_attempt"];

/** Dark olive→ink hero surface with gold rings + a lime hairline. */
export function LuxeHero({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.hero, style]}>
      <LinearGradient
        colors={[LUX.olive2, LUX.olive, LUX.ink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={s.ringLg} />
      <View pointerEvents="none" style={s.ringSm} />
      <View pointerEvents="none" style={s.glow} />
      <View pointerEvents="none" style={s.hairline} />
      {children}
    </View>
  );
}

/** Pill with a status dot, for dark surfaces. */
export function HeroStatusPill({ status, live }: { status: OrderStatus; live?: boolean }) {
  const t = ORDER_TONE[status] ?? ORDER_TONE.pending;
  return (
    <View style={s.heroPill}>
      <View style={[s.heroPillDot, { backgroundColor: t.accent }]} />
      <Text style={[s.heroPillText, { color: t.accent }]}>{live ? "Live tracking" : t.label}</Text>
    </View>
  );
}

/** Serif "lead *italic*" headline used across the order heroes. */
export function HeroHeadline({ status, size = 34 }: { status: OrderStatus; size?: number }) {
  const t = ORDER_TONE[status] ?? ORDER_TONE.pending;
  return (
    <Text style={[s.headline, { fontSize: size, lineHeight: size * 1.08 }]} accessibilityRole="header">
      {t.lead} <Text style={[s.headlineItalic, { color: t.accent }]}>{t.italic}</Text>
    </Text>
  );
}

/** Six-node progress rail for dark surfaces. */
export function StepRail({ status, live }: { status: OrderStatus; live?: boolean }) {
  const idx = railIndex(status);
  if (idx < 0) return null;
  const pct = idx <= 0 ? 0 : (idx / (RAIL_STEPS.length - 1)) * 100;
  return (
    <View>
      <View style={s.railWrap}>
        <View style={s.railTrack}>
          <LinearGradient
            colors={["#869149", LUX.lime, LUX.goldSoft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[s.railFill, { width: `${pct}%` }]}
          />
        </View>
        <View style={s.railNodes}>
          {RAIL_STEPS.map((step, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <View key={step.key} style={s.railNodeCol}>
                <View
                  style={[
                    s.railNode,
                    done && s.railNodeDone,
                    current && s.railNodeCurrent,
                    current && live && s.railNodeLive,
                  ]}
                >
                  <Ionicons
                    name={done ? "checkmark" : step.icon}
                    size={done ? 13 : 12}
                    color={current ? LUX.ink : done ? LUX.lime : "rgba(250,248,241,0.3)"}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[s.railLabel, done && s.railLabelDone, current && s.railLabelCurrent]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Thin 6-segment bar for light surfaces (order cards). */
export function MiniRail({ status }: { status: OrderStatus }) {
  const idx = railIndex(status);
  if (idx < 0) return null;
  return (
    <View style={s.miniRow}>
      {RAIL_STEPS.map((step, i) => (
        <View
          key={step.key}
          style={[
            s.miniSeg,
            i < idx && { backgroundColor: "#869149" },
            i === idx && { backgroundColor: LUX.gold },
          ]}
        />
      ))}
    </View>
  );
}

/** Section heading used inside light cards: mono index + eyebrow, serif title. */
export function CardHeading({
  index,
  eyebrow,
  title,
  italic,
  trailing,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  italic?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={s.cardHead}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.cardEyebrowRow}>
          {index ? <Text style={s.cardIndex}>{index}</Text> : null}
          {index ? <View style={s.cardEyebrowRule} /> : null}
          <Text style={s.cardEyebrow}>{eyebrow}</Text>
        </View>
        <Text style={s.cardTitle}>
          {title}
          {italic ? <Text style={s.cardTitleItalic}> {italic}</Text> : null}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: LUX.ink,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
    shadowColor: LUX.ink,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 10,
  },
  ringLg: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    right: -110,
    top: -140,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.28)",
  },
  ringSm: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -66,
    top: -96,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.14)",
  },
  glow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    left: -110,
    bottom: -150,
    backgroundColor: "rgba(200,224,138,0.08)",
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: "rgba(200,224,138,0.45)",
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(250,248,241,0.07)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.12)",
  },
  heroPillDot: { width: 6, height: 6, borderRadius: 3 },
  heroPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: fontFamilies.display.semibold,
    color: LUX.cream,
    letterSpacing: -0.8,
  },
  headlineItalic: { fontFamily: fontFamilies.display.italic },

  railWrap: { position: "relative" },
  railTrack: {
    position: "absolute",
    left: "8.33%",
    right: "8.33%",
    top: 15,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(250,248,241,0.1)",
    overflow: "hidden",
  },
  railFill: { height: 2, borderRadius: 1 },
  railNodes: { flexDirection: "row" },
  railNodeCol: { flex: 1, alignItems: "center", gap: 8 },
  railNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LUX.ink,
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.16)",
  },
  railNodeDone: { backgroundColor: LUX.olive, borderColor: "rgba(200,224,138,0.4)" },
  railNodeCurrent: { backgroundColor: LUX.lime, borderColor: LUX.lime },
  railNodeLive: {
    shadowColor: LUX.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  railLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9.5,
    color: "rgba(250,248,241,0.35)",
  },
  railLabelDone: { color: "rgba(250,248,241,0.7)" },
  railLabelCurrent: { color: LUX.cream, fontFamily: fontFamilies.sans.semibold },

  miniRow: { flexDirection: "row", gap: 3 },
  miniSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(22,23,15,0.08)" },

  cardHead: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 16 },
  cardEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  cardIndex: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, color: "#535e2c", letterSpacing: 1 },
  cardEyebrowRule: { width: 18, height: 1, backgroundColor: "rgba(22,23,15,0.15)" },
  cardEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(22,23,15,0.45)",
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 23,
    letterSpacing: -0.5,
    color: LUX.ink,
  },
  cardTitleItalic: { fontFamily: fontFamilies.display.italic, color: "#535e2c" },
});
