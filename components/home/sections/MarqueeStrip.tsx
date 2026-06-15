import React, { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import { Display, Label } from "@/components/ui/Typography";
import { colors, spacing } from "@/lib/theme/tokens";

const DEFAULT_TOP = [
  "New Drop",
  "Olive · Edition 014",
  "Ships Worldwide",
  "Made in small batches",
  "Free returns",
  "Members earn 2×",
  "Hand-finished",
  "Edited weekly",
];

const DEFAULT_BOTTOM = [
  "Atelier",
  "Lookbook 26",
  "Restraint over excess",
  "120 pieces only",
  "Olive against ink",
  "Worn close",
  "Curated by humans",
  "Shipped from Lisbon",
];

interface MarqueeStripProps {
  top?: string[];
  bottom?: string[];
}

export function MarqueeStrip({ top = DEFAULT_TOP, bottom = DEFAULT_BOTTOM }: MarqueeStripProps) {
  return (
    <View style={styles.wrap}>
      <MarqueeRow items={top} dir="left" big />
      <View style={styles.divider} />
      <MarqueeRow items={bottom} dir="right" />
    </View>
  );
}

function MarqueeRow({
  items,
  dir,
  big = false,
}: {
  items: string[];
  dir: "left" | "right";
  big?: boolean;
}) {
  const x = useRef(new Animated.Value(dir === "left" ? 0 : -1200)).current;
  const trackWidthRef = useRef(0);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!items.length) return;
    // Doubled list, animate by -50% (one full copy) for a seamless loop.
    const start = dir === "left" ? 0 : -trackWidthRef.current / 2;
    const end = dir === "left" ? -trackWidthRef.current / 2 : 0;
    x.setValue(start);
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: end,
        duration: big ? 22000 : 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopRef.current = anim;
    anim.start();
    return () => {
      anim.stop();
    };
  }, [dir, big, items.length, x]);

  const doubled = [...items, ...items];

  return (
    <View style={styles.row}>
      <Animated.View
        style={[styles.track, { transform: [{ translateX: x }] }]}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
      >
        {doubled.map((t, i) => (
          <View key={`${t}-${i}`} style={styles.item}>
            {big ? (
              <Display size="xl" style={styles.bigText}>
                {t}
              </Display>
            ) : (
              <Label style={styles.smallText}>{t}</Label>
            )}
            <Display
              italic
              size="xl"
              style={[styles.bullet, big ? styles.bulletBig : styles.bulletSmall]}
            >
              ✺
            </Display>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.olive[950],
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 244, 239, 0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 244, 239, 0.12)",
    overflow: "hidden",
  },
  row: { overflow: "hidden", paddingVertical: spacing[3] },
  divider: { height: 1, backgroundColor: "rgba(245, 244, 239, 0.12)" },
  track: { flexDirection: "row" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 16,
  },
  bigText: { color: colors.paper.cream, fontSize: 24 },
  smallText: { color: "rgba(245, 244, 239, 0.75)" },
  bullet: { color: colors.olive[300] },
  bulletBig: { fontSize: 22 },
  bulletSmall: { fontSize: 11 },
});
