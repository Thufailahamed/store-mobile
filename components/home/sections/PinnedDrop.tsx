import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Text } from "react-native";
import { Label } from "@/components/ui/Typography";
import { ProductCard } from "@/components/product/ProductCard";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";

interface PinnedDropProps {
  products: Product[];
  endsAt?: string;
}

export function PinnedDrop({ products, endsAt }: PinnedDropProps) {
  const items = products.slice(0, 5);
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
        <Label style={styles.stripLabel}>FLASH SALE ENDS IN</Label>
        <Text style={styles.timerText}>
          {String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}:{String(t.s).padStart(2, "0")}
        </Text>
      </View>

      {/* Horizontal Rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((p) => (
          <ProductCard key={p.id} product={p} horizontal />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing[5],
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
  timerText: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  scroll: {
    paddingHorizontal: 20,
    gap: spacing[2],
  },
});
