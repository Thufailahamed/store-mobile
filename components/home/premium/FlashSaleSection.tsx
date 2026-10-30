import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeProductCard } from "./HomeProductCard";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";

interface FlashSaleSectionProps {
  products: Product[];
  /** Real drop deadline from the backend. Absent → no countdown is shown. */
  endsAt?: string;
  /** Fired once when the countdown reaches zero (e.g. to refetch home). */
  onExpired?: () => void;
}

type Remaining = { d: number; h: number; m: number; s: number; total: number };

function remainingUntil(target: number): Remaining {
  const total = Math.max(0, target - Date.now());
  return {
    total,
    d: Math.floor(total / 86_400_000),
    h: Math.floor((total % 86_400_000) / 3_600_000),
    m: Math.floor((total % 3_600_000) / 60_000),
    s: Math.floor((total % 60_000) / 1000),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function TimeTile({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileUnit}>{unit}</Text>
    </View>
  );
}

function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotHalo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          },
        ]}
      />
      <View style={styles.dot} />
    </View>
  );
}

/**
 * Flash sale — dark editorial header card with a live segmented countdown,
 * followed by the sale rail. The countdown only renders for a real
 * backend deadline; when it hits zero the section hides itself and asks
 * the screen to refetch, so an expired price is never shown as "on sale".
 */
export function FlashSaleSection({ products, endsAt, onExpired }: FlashSaleSectionProps) {
  const router = useRouter();
  const target = endsAt ? Date.parse(endsAt) : NaN;
  const hasDeadline = Number.isFinite(target);
  const [t, setT] = useState<Remaining | null>(() => (hasDeadline ? remainingUntil(target) : null));
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!hasDeadline) {
      setT(null);
      return;
    }
    const tick = () => {
      const next = remainingUntil(target);
      setT(next);
      if (next.total <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpired?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // onExpired is a callback prop; re-subscribing on identity change would reset the ticker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDeadline, target]);

  const items = products.slice(0, 10);
  if (!items.length) return null;
  if (hasDeadline && t && t.total <= 0) return null;

  const maxDiscount = items.reduce(
    (m, p) => (p.mrp > p.price ? Math.max(m, Math.round(((p.mrp - p.price) / p.mrp) * 100)) : m),
    0,
  );
  const urgent = !!t && t.total > 0 && t.total < 3_600_000;
  const openSale = () => router.push("/(main)/products?sort=sale" as never);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <LinearGradient
          colors={[colors.olive[800], colors.olive[950], "#0d0e0a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`${colors.accent2.rust}40`, `${colors.accent2.rust}00`]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.35, y: 0.7 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.hairline} pointerEvents="none" />

        <View style={styles.topRow}>
          <View style={styles.livePill}>
            <LiveDot />
            <Text style={styles.liveText}>FLASH SALE · LIVE</Text>
          </View>
          <Text style={styles.countText}>{items.length} pieces</Text>
        </View>

        <Text style={styles.headline}>
          {maxDiscount > 0 ? (
            <>
              Up to <Text style={styles.headlineAccent}>{maxDiscount}%</Text> off
            </>
          ) : (
            "Prices cut, briefly"
          )}
        </Text>
        <Text style={styles.sub}>Hand-picked markdowns from our ateliers — while stock lasts.</Text>

        <View style={styles.bottomRow}>
          {t ? (
            <View style={styles.timerBlock}>
              <Text style={[styles.endsLabel, urgent && styles.endsLabelUrgent]}>
                {urgent ? "ENDING SOON" : "ENDS IN"}
              </Text>
              <View style={styles.tiles}>
                {t.d > 0 ? (
                  <>
                    <TimeTile value={pad(t.d)} unit="DAYS" />
                    <Text style={styles.colon}>:</Text>
                  </>
                ) : null}
                <TimeTile value={pad(t.h)} unit="HRS" />
                <Text style={styles.colon}>:</Text>
                <TimeTile value={pad(t.m)} unit="MIN" />
                {t.d === 0 ? (
                  <>
                    <Text style={styles.colon}>:</Text>
                    <TimeTile value={pad(t.s)} unit="SEC" />
                  </>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.limitedPill}>
              <Ionicons name="hourglass-outline" size={13} color={colors.accent2.ochre} />
              <Text style={styles.limitedText}>Limited time only</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cta}
            onPress={openSale}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Shop the flash sale"
          >
            <Text style={styles.ctaText}>Shop</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.olive[950]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {items.map((p, i) => (
          <HomeProductCard key={p.id} product={p} index={i} />
        ))}
        <TouchableOpacity style={styles.seeAllCard} onPress={openSale} activeOpacity={0.85}>
          <View style={styles.seeAllIcon}>
            <Ionicons name="arrow-forward" size={18} color={colors.paper.cream} />
          </View>
          <Text style={styles.seeAllTitle}>See the{"\n"}full sale</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  card: {
    marginHorizontal: spacing[4],
    borderRadius: 28,
    padding: spacing[5],
    overflow: "hidden",
    gap: spacing[2],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 10,
  },
  hairline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.08)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[1],
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.14)",
  },
  dotWrap: { width: 8, height: 8, alignItems: "center", justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent2.rust },
  dotHalo: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent2.rust,
  },
  liveText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: colors.paper.cream,
  },
  countText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    color: "rgba(250,248,241,0.55)",
  },
  headline: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
    color: colors.paper.cream,
  },
  headlineAccent: {
    fontFamily: fontFamilies.display.italic,
    color: colors.accent2.ochre,
  },
  sub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(250,248,241,0.68)",
    maxWidth: 280,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing[3],
    marginTop: spacing[3],
  },
  timerBlock: { gap: 6, flexShrink: 1 },
  endsLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "rgba(250,248,241,0.55)",
  },
  endsLabelUrgent: { color: colors.accent2.ochre },
  tiles: { flexDirection: "row", alignItems: "center", gap: 4 },
  tile: {
    minWidth: 48,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(250,248,241,0.1)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.16)",
  },
  tileValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.paper.cream,
    fontVariant: ["tabular-nums"],
  },
  tileUnit: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: "rgba(250,248,241,0.5)",
    marginTop: 1,
  },
  colon: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    color: "rgba(250,248,241,0.4)",
    marginBottom: 12,
  },
  limitedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.3)",
  },
  limitedText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.accent2.ochre,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
  },
  ctaText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.olive[950],
    letterSpacing: 0.3,
  },
  rail: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: spacing[3],
  },
  seeAllCard: {
    width: 120,
    alignSelf: "stretch",
    borderRadius: radii["2xl"],
    backgroundColor: colors.olive[900],
    padding: spacing[4],
    justifyContent: "space-between",
    minHeight: 180,
  },
  seeAllIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,241,0.14)",
  },
  seeAllTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.paper.cream,
  },
});
