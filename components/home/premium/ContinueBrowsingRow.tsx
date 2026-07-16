import React, { useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { useAuth } from "@/lib/supabase/auth";
import { getHomeFeed, type HomeFeedBrandOrStore, type HomeFeedResponse } from "@/lib/api";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const CARD_WIDTH = 128;
const LOGO_SIZE = 64;

/**
 * "Continue browsing" — brands/stores the user recently viewed products
 * from but hasn't followed or bought from yet. Shares the same
 * `["home-feed", user.id]` query as PersonalisedRails, so this adds no
 * extra network call.
 */
export function ContinueBrowsingRow() {
  const router = useRouter();
  const { user } = useAuth();

  const query = useQuery<HomeFeedResponse | null>({
    queryKey: ["home-feed", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await getHomeFeed();
      if (!res.ok) return null;
      return res.data;
    },
  });

  const entries = useMemo(
    () => query.data?.sections.continue_browsing ?? [],
    [query.data],
  );

  if (!user) return null;
  if (!entries.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader kicker="Pick up where you left off" title="Continue browsing" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {entries.map((entry) => (
          <EntryCard
            key={entry.brand_id ?? entry.store_id}
            entry={entry}
            onPress={() => {
              if (entry.brand_id && entry.slug) {
                router.push(`/(main)/brands/${entry.slug}` as never);
              } else if (entry.store_id && entry.slug) {
                router.push(`/(main)/stores/${entry.slug}` as never);
              }
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function EntryCard({ entry, onPress }: { entry: HomeFeedBrandOrStore; onPress: () => void }) {
  const name = entry.brand_name ?? entry.store_name ?? "";
  const logoUrl = entry.brand_logo_url ?? entry.store_logo_url;
  const kind = entry.brand_id ? "Brand" : "Shop";

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.logoWrap}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
        ) : (
          <Text style={styles.logoInitial}>{name.charAt(0)}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.kind}>{kind}</Text>
    </TouchableOpacity>
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
    width: CARD_WIDTH,
    alignItems: "center",
    gap: 4,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing[1],
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  logoInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.primary,
  },
  name: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
    textAlign: "center",
  },
  kind: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
});
