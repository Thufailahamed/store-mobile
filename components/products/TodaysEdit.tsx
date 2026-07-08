import React, { useRef, useState } from "react";
import {
  View,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label } from "@/components/ui/Typography";
import { ProductCard } from "@/components/product/ProductCard";
import { colors, spacing } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

const CARD_GAP = spacing[3];

/**
 * Bottom editorial rail — "Six pieces we love right now."
 * Horizontally scrollable, hidden when filters are active.
 * Port of web `components/products/todays-edit.tsx`.
 */
export function TodaysEdit({ products }: { products: Product[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const CARD_WIDTH = Math.round(screenWidth * 0.46);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(idx, products.length - 1)));
  };

  if (!products.length) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Label style={styles.kicker}>
            <Ionicons name="flame" size={10} color={colors.light.primary} /> The Edit
          </Label>
          <Display size="lg" style={styles.title}>
            Six pieces we <Display size="lg" italic>love</Display> right now.
          </Display>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {products.map((p) => (
          <View key={p.id} style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}>
            <ProductCard product={p} />
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {products.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() =>
              scrollRef.current?.scrollTo({
                x: i * (CARD_WIDTH + CARD_GAP),
                animated: true,
              })
            }
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  header: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  headerText: {
    gap: spacing[1],
  },
  kicker: {
    color: colors.light.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    marginTop: spacing[1],
  },
  row: {
    paddingHorizontal: spacing[5],
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[4],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.border,
  },
  dotActive: {
    backgroundColor: colors.light.primary,
    width: 18,
  },
});
