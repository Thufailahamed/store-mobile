import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

interface FeaturedStoresRowProps {
  stores: Store[];
}

/**
 * A vertical directory list — rows, not scrolling tiles — so "boutiques"
 * reads as a distinct browsing mode instead of yet another circle-avatar
 * horizontal scroller (CategoryScroller / ContinueBrowsingRow already own
 * that shape).
 */
export function FeaturedStoresRow({ stores }: FeaturedStoresRowProps) {
  const router = useRouter();
  const list = stores.slice(0, 6);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Boutique directory"
        kicker="Shop by store"
        onPress={() => router.push("/(main)/stores")}
      />
      <View style={styles.list}>
        {list.map((s, i) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.row, i === 0 && styles.rowFirst]}
            activeOpacity={0.7}
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
            <View style={styles.avatar}>
              {s.logo_url ? (
                <Image source={{ uri: s.logo_url }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarInitial}>{s.name.charAt(0)}</Text>
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={styles.note} numberOfLines={1}>
                {s.rating > 0 ? `${s.rating.toFixed(1)} rating · ` : ""}
                {s.description || "Curated for the LUXE edit"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  list: {
    paddingHorizontal: spacing[5],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.primary,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  note: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
});
