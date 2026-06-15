import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Label } from "@/components/ui/Typography";
import { colors } from "@/lib/theme/tokens";

const TICKER = [
  "Issue Nº 014 · Summer / 26",
  "Free shipping over LKR 15,000 — islandwide",
  "Members earn 2× rewards · this week",
  "New drop · Friday at 09:00 GMT",
  "200+ verified ateliers · curated weekly",
];

export function LiveTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % TICKER.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.bar}>
      <View style={styles.dot} />
      <Label style={styles.text} numberOfLines={1}>
        {TICKER[index]}
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
  dot: {
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
});
