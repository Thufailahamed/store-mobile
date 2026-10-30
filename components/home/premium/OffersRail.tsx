import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { CouponOffer } from "@/lib/api/backend";

const CARD_WIDTH = 286;
const STUB_WIDTH = 92;
const NOTCH = 16;

/** Stub palettes, cycled per card so the rail reads as a set, not a wall. */
const STUBS: Array<[string, string]> = [
  [colors.olive[800], colors.olive[950]],
  ["#c4694a", "#8f3f22"],
  ["#c8a44a", "#8a6d24"],
  ["#4b5a3a", "#232a17"],
];

function compactMoney(n: number): string {
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function describe(o: CouponOffer): { big: string; small: string; title: string } {
  const t = o.type === "percent" ? "percentage" : o.type;
  if (t === "percentage") return { big: `${Math.round(o.value)}%`, small: "OFF", title: `${Math.round(o.value)}% off` };
  if (t === "fixed") return { big: compactMoney(o.value), small: "LKR OFF", title: `${formatPrice(o.value)} off` };
  if (t === "free_shipping") return { big: "FREE", small: "SHIPPING", title: "Free shipping" };
  if (t === "bxgy") return { big: "B1G1", small: "DEAL", title: "Buy more, get more" };
  return { big: "DEAL", small: "", title: "Special offer" };
}

function whereText(o: CouponOffer): string {
  if (o.owner_name) return `at ${o.owner_name}`;
  if (o.scope === "platform" || o.scope === "global") return "on everything";
  if (o.scope === "category") return "on select categories";
  if (o.scope === "product") return "on select pieces";
  return "on select items";
}

function expiryText(expiresAt: string | null): { text: string; soon: boolean } | null {
  if (!expiresAt) return null;
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const h = ms / 3_600_000;
  if (h < 1) return { text: `Ends in ${Math.max(1, Math.round(ms / 60_000))} min`, soon: true };
  if (h < 24) return { text: `Ends in ${Math.round(h)}h`, soon: true };
  const d = Math.round(h / 24);
  if (d <= 7) return { text: `Ends in ${d} day${d === 1 ? "" : "s"}`, soon: d <= 2 };
  return {
    text: `Valid till ${new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    soon: false,
  };
}

function OfferTicket({ offer, index }: { offer: CouponOffer; index: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const d = describe(offer);
  const exp = expiryText(offer.expires_at);
  const [g0, g1] = STUBS[index % STUBS.length];

  const conditions = [
    offer.min_order_value > 0 ? `Min. spend ${formatPrice(offer.min_order_value)}` : "No minimum spend",
    offer.max_discount != null && offer.max_discount > 0 ? `up to ${formatPrice(offer.max_discount)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(offer.code);
      setCopied(true);
      toast(`Code ${offer.code} copied — apply it at checkout`, "success");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      toast("Couldn't copy the code", "error");
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={copy}
      style={styles.ticket}
      accessibilityRole="button"
      accessibilityLabel={`${d.title} ${whereText(offer)}. Code ${offer.code}. Tap to copy.`}
    >
      {/* Stub */}
      <View style={styles.stub}>
        <LinearGradient colors={[g0, g1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.stubShine} />
        <Text style={styles.stubBig} numberOfLines={1} adjustsFontSizeToFit>
          {d.big}
        </Text>
        {d.small ? <Text style={styles.stubSmall}>{d.small}</Text> : null}
      </View>

      {/* Perforation */}
      <View style={styles.perf}>
        <View style={[styles.notch, styles.notchTop]} />
        <View style={styles.perfLine} />
        <View style={[styles.notch, styles.notchBottom]} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={{ gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>
            {d.title}
          </Text>
          <Text style={styles.where} numberOfLines={1}>
            {whereText(offer)}
          </Text>
        </View>
        <Text style={styles.cond} numberOfLines={1}>
          {conditions}
        </Text>
        <View style={styles.footer}>
          <View style={[styles.codeChip, copied && styles.codeChipCopied]}>
            <Text style={[styles.code, copied && styles.codeCopied]} numberOfLines={1}>
              {offer.code}
            </Text>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={12}
              color={copied ? colors.paper.cream : colors.olive[800]}
            />
          </View>
          {exp ? (
            <Text style={[styles.expiry, exp.soon && styles.expirySoon]} numberOfLines={1}>
              {exp.text}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Live offers — redeemable-now coupons as perforated tickets. Tapping a
 * ticket copies its code; the code is then applied at checkout, where the
 * server re-validates scope, minimum spend and usage limits.
 */
export function OffersRail({ offers }: { offers: CouponOffer[] }) {
  if (!offers.length) return null;
  return (
    <View style={styles.wrap}>
      <HomeSectionHeader kicker={`${offers.length} live offer${offers.length === 1 ? "" : "s"}`} title="Offers for you" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + spacing[3]}
        snapToAlignment="start"
      >
        {offers.map((o, i) => (
          <OfferTicket key={o.id} offer={o} index={i} />
        ))}
      </ScrollView>
      <View style={styles.hintRow}>
        <Ionicons name="hand-left-outline" size={11} color={colors.light.mutedForeground} />
        <Text style={styles.hint}>Tap a ticket to copy its code</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing[2],
    marginBottom: spacing[8],
  },
  rail: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
    // Room for the ticket shadow — a horizontal ScrollView clips its
    // content box, which otherwise cuts the shadow into a hard band.
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  ticket: {
    width: CARD_WIDTH,
    height: 132,
    flexDirection: "row",
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: `${colors.olive[900]}14`,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  stub: {
    width: STUB_WIDTH,
    borderTopLeftRadius: 19,
    borderBottomLeftRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  stubShine: {
    position: "absolute",
    top: -40,
    left: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  stubBig: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.paper.cream,
  },
  stubSmall: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: "rgba(250,248,241,0.8)",
    marginTop: 2,
    textAlign: "center",
  },
  perf: {
    width: 1,
    alignItems: "center",
  },
  perfLine: {
    flex: 1,
    width: 0,
    marginVertical: NOTCH / 2 + 4,
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    borderColor: `${colors.olive[900]}2E`,
  },
  notch: {
    position: "absolute",
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: colors.light.background,
    left: -NOTCH / 2,
  },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    lineHeight: 21,
    color: colors.light.foreground,
  },
  where: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.olive[700],
  },
  cond: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  codeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: `${colors.olive[800]}66`,
    backgroundColor: `${colors.olive[500]}0F`,
    flexShrink: 1,
  },
  codeChipCopied: {
    borderStyle: "solid",
    borderColor: colors.olive[800],
    backgroundColor: colors.olive[800],
  },
  code: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11.5,
    letterSpacing: 1.2,
    color: colors.olive[900],
    flexShrink: 1,
  },
  codeCopied: { color: colors.paper.cream },
  expiry: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },
  expirySoon: { color: colors.accent2.rust, fontFamily: fontFamilies.sans.semibold },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing[5],
    marginTop: -spacing[3],
  },
  hint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
});
