import React, { useRef } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { ProductCard } from "@/components/product/ProductCard";
import { colors, spacing } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

interface EditorialRailProps {
  products: Product[];
  number: string;
  kicker: string;
  title: string;
  subtitle?: string;
  href?: string;
}

export function EditorialRail({
  products,
  number,
  kicker,
  title,
  subtitle,
  href,
}: EditorialRailProps) {
  const router = useRouter();
  const scrollerRef = useRef<FlatList>(null);
  if (!products.length) return null;

  const onScroll = (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // reserved for future progress indicator
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Display size="2xl" style={styles.number}>
              {number}
            </Display>
            <View style={styles.kickerCol}>
              <View style={styles.kickerRule} />
              <Label style={styles.kickerText}>{kicker}</Label>
            </View>
          </View>
          <Display size="3xl" style={styles.title} numberOfLines={2}>
            {title}
          </Display>
          {subtitle ? <Body muted size="sm" style={styles.subtitle}>{subtitle}</Body> : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push((href as never) ?? ("/(main)/products" as never))}
            style={styles.seeAll}
            activeOpacity={0.7}
          >
            <Label style={styles.seeAllText}>View all</Label>
            <Ionicons name="arrow-up" size={11} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={scrollerRef}
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => <ProductCard product={item} horizontal />}
      />

      <View style={styles.footer}>
        <View style={styles.footerRule} />
        <Label style={styles.footerText}>Scroll to browse the rail</Label>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing[10],
    paddingBottom: spacing[8],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: spacing[5],
    gap: spacing[3],
  },
  headerLeft: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing[3] },
  number: { color: colors.light.primary, fontSize: 28, lineHeight: 30 },
  kickerCol: { flex: 1, gap: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  title: { color: colors.light.foreground, lineHeight: 32 },
  subtitle: { marginTop: 4 },
  headerRight: { alignItems: "flex-end" },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 4,
  },
  seeAllText: { color: colors.light.foreground },
  scroll: {
    paddingHorizontal: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: 20,
    marginTop: spacing[4],
  },
  footerRule: { width: 24, height: 1, backgroundColor: colors.light.border },
  footerText: { color: colors.light.mutedForeground },
});
