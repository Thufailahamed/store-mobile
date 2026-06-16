import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const STORE_CARD_WIDTH = 120;

interface FeaturedStoresRowProps {
  stores: Store[];
}

export function FeaturedStoresRow({ stores }: FeaturedStoresRowProps) {
  const router = useRouter();
  const list = stores.slice(0, 10);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Featured boutiques"
        onPress={() => router.push("/(main)/stores")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => {
              if (s.slug) {
                router.push({
                  pathname: "/(main)/stores/[slug]",
                  params: { slug: s.slug, id: s.id },
                });
              } else {
                router.push("/(main)/products");
              }
            }}
          >
            <View style={styles.logoWrap}>
              {s.logo_url ? (
                <Image source={{ uri: s.logo_url }} style={styles.logo} contentFit="cover" />
              ) : (
                <Ionicons name="storefront-outline" size={28} color={colors.light.primary} />
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {s.name}
            </Text>
            {s.rating > 0 ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={11} color={colors.olive[600]} />
                <Text style={styles.rating}>{s.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[6],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  card: {
    width: STORE_CARD_WIDTH,
    alignItems: "center",
    gap: spacing[2],
  },
  logoWrap: {
    width: STORE_CARD_WIDTH,
    height: STORE_CARD_WIDTH,
    borderRadius: radii["2xl"],
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  name: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
    textAlign: "center",
    lineHeight: 15,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rating: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
});
