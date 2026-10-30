import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Label } from "@/components/ui/Typography";
import { Ionicons } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";

const TICKER: { text: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { text: "Issue Nº 014 · Summer / 26", icon: "book-outline" },
  { text: "Island-wide shipping available", icon: "car-outline" },
  { text: "Members earn 2× rewards · this week", icon: "sparkles" },
  { text: "New drop · Friday at 09:00 GMT", icon: "time-outline" },
  { text: "200+ verified ateliers · curated weekly", icon: "ribbon-outline" },
];

interface LiveTickerProps {
  /** "atelier" is the white pill used by the Home header; default is the full-width dark strip. */
  tone?: "default" | "atelier";
}

export function LiveTicker({ tone = "default" }: LiveTickerProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % TICKER.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const item = TICKER[index];

  if (tone === "atelier") {
    return (
      <View style={styles.pill} accessibilityRole="text" accessibilityLiveRegion="polite">
        <Animated.View key={index} entering={FadeInDown.duration(320)} style={styles.pillRow}>
          <View style={styles.pillIcon}>
            <Ionicons name={item.icon} size={12} color={C.lime} />
          </View>
          <Text style={styles.pillText} numberOfLines={1}>
            {item.text}
          </Text>
        </Animated.View>
        <View style={styles.dots}>
          {TICKER.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <View style={styles.barDot} />
      <Label style={styles.text} numberOfLines={1}>
        {item.text}
      </Label>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.olive[950],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  barDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[400],
  },
  text: {
    color: colors.olive[200],
    flex: 1,
    textAlign: "center",
  },

  pill: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  pillRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  pillIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    letterSpacing: -0.1,
    color: C.text,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(22,23,15,0.15)",
  },
  dotActive: {
    width: 12,
    backgroundColor: C.accent,
  },
});
