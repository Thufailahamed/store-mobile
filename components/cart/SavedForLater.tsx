import React from "react";
import { View, FlatList, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii } from "@/lib/theme/tokens";
import { useWishlist } from "@/lib/stores";
import { Image } from "expo-image";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface SavedForLaterProps {
  products: Product[];
  style?: ViewStyle;
}

export function SavedForLater({ products, style }: SavedForLaterProps) {
  const theme = useTheme();
  const router = useRouter();
  const { toggle } = useWishlist();

  if (!products.length) return null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View>
          <Label style={{ color: theme.olive[600] }}>For Future</Label>
          <Display
            size="lg"
            italic
            style={{ color: theme.colors.foreground, marginTop: 2 }}
          >
            Saved for later
          </Display>
        </View>
        <Pressable
          onPress={() => router.push("/(main)/wishlist")}
          hitSlop={6}
        >
          <Label style={{ color: theme.olive[700] }}>View all →</Label>
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => {
          const img = item.images?.find((i) => i.is_primary)?.url || item.images?.[0]?.url;
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
                pressed && { opacity: 0.85 },
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
                <Pressable
                  onPress={() => toggle(item.id)}
                  hitSlop={8}
                  style={[
                    styles.heart,
                    { backgroundColor: theme.colors.card },
                  ]}
                >
                  <Ionicons
                    name="heart"
                    size={12}
                    color={theme.accent2.rust}
                  />
                </Pressable>
              </View>
              <View style={styles.cardInfo}>
                <Body
                  size="xs"
                  numberOfLines={1}
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fontFamilies.display.regular,
                  }}
                >
                  {item.name}
                </Body>
                <Body
                  size="xs"
                  style={{
                    color: theme.colors.mutedForeground,
                    marginTop: 4,
                    fontFamily: fontFamilies.mono.medium,
                    letterSpacing: typography.letterSpacing.wide,
                  }}
                >
                  {formatPrice(item.price)}
                </Body>
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
    marginTop: spacing[6],
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  card: {
    width: 130,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  imgWrap: {
    width: 130,
    height: 150,
    position: "relative",
  },
  img: {
    width: "100%",
    height: "100%",
  },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    padding: 10,
  },
});
