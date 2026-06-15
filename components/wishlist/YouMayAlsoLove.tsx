import React, { useEffect, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import * as api from "@/lib/api";
import type { Product } from "@/lib/types";

interface YouMayAlsoLoveProps {
  excludeIds?: string[];
  style?: ViewStyle;
}

export function YouMayAlsoLove({ excludeIds = [], style }: YouMayAlsoLoveProps) {
  const theme = useTheme();
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
        <View style={{ flex: 1 }}>
          <Label style={{ color: theme.accent2.rust }}>Curated For You</Label>
          <Display
            size="lg"
            italic
            style={{ color: theme.colors.foreground, marginTop: 2 }}
          >
            You may also love
          </Display>
        </View>
        <Pressable
          onPress={() => router.push("/(main)/products")}
          hitSlop={6}
        >
          <Label style={{ color: theme.olive[700] }}>Explore →</Label>
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => {
          const img =
            item.images?.find((i) => i.is_primary)?.url || item.images?.[0]?.url;
          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(main)/products/[slug]",
                  params: { slug: item.slug || item.id },
                })
              }
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View
                style={[
                  styles.imgWrap,
                  { backgroundColor: theme.colors.muted },
                ]}
              >
                {img ? (
                  <Image
                    source={{ uri: img }}
                    style={styles.img}
                    contentFit="cover"
                    transition={250}
                  />
                ) : null}
              </View>
              <View style={styles.cardInfo}>
                {item.brand ? (
                  <Label
                    style={{ color: theme.olive[600], fontSize: 9 }}
                    numberOfLines={1}
                  >
                    {item.brand.name}
                  </Label>
                ) : null}
                <Body
                  size="xs"
                  numberOfLines={2}
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fontFamilies.display.regular,
                    marginTop: 4,
                  }}
                >
                  {item.name}
                </Body>
                <Price
                  size="sm"
                  style={{
                    color: theme.colors.foreground,
                    marginTop: 6,
                  }}
                >
                  {formatPrice(item.price)}
                </Price>
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
    marginTop: spacing[8],
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  card: {
    width: 156,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  imgWrap: {
    width: 156,
    height: 180,
  },
  img: {
    width: "100%",
    height: "100%",
  },
  cardInfo: {
    padding: 10,
  },
});
