import React, { useRef } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Display, Label } from "@/components/ui/Typography";
import { ProductCard } from "@/components/product/ProductCard";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";

interface EditorialRailProps {
  products: Product[];
  number?: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  href?: string;
}

export function EditorialRail({
  products,
  title,
  href,
}: EditorialRailProps) {
  const router = useRouter();
  const scrollerRef = useRef<FlatList>(null);
  if (!products.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Display size="lg" style={styles.title}>
          {title}
        </Display>
        <TouchableOpacity
          onPress={() => router.push((href as never) ?? ("/(main)/products" as never))}
          style={styles.seeAll}
          activeOpacity={0.7}
        >
          <Label style={styles.seeAllText}>See All &gt;</Label>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={scrollerRef}
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        scrollEventThrottle={16}
        renderItem={({ item }) => <ProductCard product={item} horizontal />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing[5],
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: spacing[4],
  },
  title: { 
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
  },
  seeAll: {
    paddingVertical: 4,
  },
  seeAllText: { 
    color: colors.light.primary, 
    fontSize: 12, 
    fontFamily: fontFamilies.sans.bold,
    textTransform: "none",
  },
  scroll: {
    paddingHorizontal: 20,
  },
});
