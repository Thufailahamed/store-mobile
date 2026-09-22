import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Body, Label } from "@/components/ui/Typography";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiTrendsBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Trend = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency?: string;
  image_url?: string | null;
  category?: string;
  score?: number;
};

export default function AiTrendsScreen() {
  const router = useRouter();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const res = await aiTrendsBackend();
    if (res.ok) {
      setTrends(res.data.trends ?? []);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AiPageShell
      title="What's moving"
      description="Pieces gaining traction across the catalogue this week."
    >
      {loading ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.card}>
              <Skeleton style={styles.img} borderRadius={0} />
              <View style={styles.cardBody}>
                <Skeleton width="90%" height={13} />
                <Skeleton width="45%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <View style={styles.stateIcon}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.olive[600]} />
          </View>
          <Text style={styles.stateTitle}>Couldn't load trends</Text>
          <Body muted size="sm" style={styles.stateSub}>
            Check your connection and try again.
          </Body>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Ionicons name="refresh" size={14} color={colors.paper.cream} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : trends.length === 0 ? (
        <View style={styles.stateWrap}>
          <View style={styles.stateIcon}>
            <Ionicons name="trending-up-outline" size={28} color={colors.olive[600]} />
          </View>
          <Text style={styles.stateTitle}>Nothing trending yet</Text>
          <Body muted size="sm" style={styles.stateSub}>
            Trending pieces appear here once shoppers start moving on the catalogue.
          </Body>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => router.push("/(main)/products" as never)}
          >
            <Ionicons name="compass-outline" size={14} color={colors.paper.cream} />
            <Text style={styles.retryText}>Explore the shop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.olive[600]}
            />
          }
        >
          {trends.map((p, index) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
              activeOpacity={0.9}
            >
              <View>
                {p.image_url ? (
                  <Image
                    source={{ uri: p.image_url }}
                    style={styles.img}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[styles.img, styles.imgFallback]}>
                    <Ionicons name="shirt-outline" size={28} color={colors.olive[300]} />
                  </View>
                )}
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                {index < 3 ? (
                  <View style={styles.hotBadge}>
                    <Ionicons name="flame" size={9} color="#fff" />
                    <Text style={styles.hotText}>HOT</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardBody}>
                <Body size="xs" numberOfLines={2} style={styles.name}>
                  {p.name}
                </Body>
                <View style={styles.cardFoot}>
                  <Body size="sm" style={styles.price}>
                    {formatPrice(p.price, p.currency ?? "LKR")}
                  </Body>
                  {p.category ? (
                    <Label style={styles.categoryTag} numberOfLines={1}>
                      {p.category.toUpperCase()}
                    </Label>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </AiPageShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: spacing[5],
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  img: { width: "100%", aspectRatio: 0.85, backgroundColor: colors.olive[50] },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  rankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    minWidth: 26,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[800],
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.paper.cream,
  },
  hotBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: radii.full,
    backgroundColor: colors.accent2.rust,
  },
  hotText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.6,
    color: "#fff",
  },
  cardBody: { padding: spacing[3], gap: 6 },
  name: { fontFamily: fontFamilies.sans.medium, lineHeight: 17 },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  price: { fontFamily: fontFamilies.sans.bold, color: colors.olive[700] },
  categoryTag: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.6,
    color: colors.light.mutedForeground,
    flexShrink: 1,
  },
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: spacing[2],
    paddingBottom: 60,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  stateTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
  },
  stateSub: { textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    height: 40,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[800],
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.paper.cream,
  },
});
