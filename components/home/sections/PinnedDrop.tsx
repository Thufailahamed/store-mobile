import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Typography";
import { HomeProductCard } from "@/components/home/premium/HomeProductCard";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";

interface PinnedDropProps {
  products: Product[];
  endsAt?: string;
}

export function PinnedDrop({ products, endsAt }: PinnedDropProps) {
  const router = useRouter();
  const items = products.slice(0, 5);
  const maxDiscount = items.reduce(
    (m, p) => (p.mrp > p.price ? Math.max(m, Math.round(((p.mrp - p.price) / p.mrp) * 100)) : m),
    0,
  );
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const target = endsAt || new Date(Date.now() + 6 * 3600_000).toISOString();
    const tick = () => {
      const remain = new Date(target).getTime() - Date.now();
      if (remain <= 0) {
        setT({ h: 0, m: 0, s: 0 });
        return;
      }
      const h = Math.floor(remain / 3600_000);
      const m = Math.floor((remain % 3600_000) / 60_000);
      const s = Math.floor((remain % 60_000) / 1000);
      setT({ h, m, s });
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [endsAt]);

  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      {/* Countdown Strip */}
      <View style={styles.countdownStrip}>
        <View style={{ flex: 1 }}>
          <Label style={styles.stripLabel}>FLASH SALE</Label>
          {maxDiscount > 0 ? <Text style={styles.stripSub}>Up to {maxDiscount}% off · ends in</Text> : <Text style={styles.stripSub}>Ends in</Text>}
        </View>
        <Text style={styles.timerText}>
          {String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}:{String(t.s).padStart(2, "0")}
        </Text>
        <TouchableOpacity
          style={styles.seeAll}
          onPress={() => router.push("/(main)/products?sort=sale")}
          activeOpacity={0.75}
          accessibilityLabel="See all sale items"
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.accent2.rust} />
        </TouchableOpacity>
      </View>

      {/* Horizontal Rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((p, i) => (
          <HomeProductCard key={p.id} product={p} index={i} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing[5],
    marginBottom: spacing[6],
    backgroundColor: colors.light.background,
  },
  countdownStrip: {
    backgroundColor: colors.accent2.rust,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: spacing[4],
  },
  stripLabel: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  stripSub: {
    color: "rgba(250,248,241,0.85)",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    marginTop: 1,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: spacing[3],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.light.primaryForeground,
  },
  seeAllText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.accent2.rust,
  },
  timerText: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
});
