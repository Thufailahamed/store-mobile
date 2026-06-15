import React, { useEffect, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import * as api from "@/lib/api";
import type { Product } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "#e5e5e5";

interface YouMayAlsoLoveProps {
  excludeIds?: string[];
  style?: ViewStyle;
}

export function YouMayAlsoLove({ excludeIds = [], style }: YouMayAlsoLoveProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getProducts({ limit: 10, sort: "rating" });
        if (cancelled) return;
        if (res.ok) {
          const filtered = (res.data.products || []).filter(
            (p) => !excludeIds.includes(p.id)
          );
          setProducts(filtered.slice(0, 8));
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeIds.join(",")]);

  if (!loading && products.length === 0) return null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>CURATED FOR YOU</Text>
          <Text style={styles.title}>You may also love</Text>
        </View>
        <Pressable onPress={() => router.push("/(main)/products")} hitSlop={6}>
          <Text style={styles.explore}>EXPLORE →</Text>
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        ItemSeparatorComponent={() => <View style={{ width: spacing[3] }} />}
        renderItem={({ item }) => {
          const img =
            item.images?.find((i) => i.is_primary)?.url || item.images?.[0]?.url;
          const brandLabel = (item.store?.name || item.brand?.name || "").toUpperCase();

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(main)/products/[slug]",
                  params: { slug: item.slug || item.id },
                })
              }
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.imgWrap}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.img} contentFit="cover" transition={250} />
                ) : null}
              </View>
              <View style={styles.cardInfo}>
                {brandLabel ? (
                  <Text style={styles.brand} numberOfLines={1}>
                    {brandLabel}
                  </Text>
                ) : null}
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.price}>{formatPrice(item.price, item.currency)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[4],
    paddingTop: spacing[2],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    color: MUTED,
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.3,
  },
  explore: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: INK,
    letterSpacing: 0.8,
  },
  railContent: {
    gap: spacing[3],
  },
  card: {
    width: 148,
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  imgWrap: {
    width: 148,
    height: 176,
    backgroundColor: "#f5f5f5",
  },
  img: {
    width: "100%",
    height: "100%",
  },
  cardInfo: {
    padding: spacing[2.5],
    gap: 3,
  },
  brand: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 8,
    color: MUTED,
    letterSpacing: 0.7,
  },
  name: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 12,
    color: INK,
    lineHeight: 16,
  },
  price: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: INK,
    marginTop: 4,
  },
});
