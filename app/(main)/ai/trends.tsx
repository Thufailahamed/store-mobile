import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiTrendsBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;
const CREAM = colors.paper.cream;
const INK = colors.ink.DEFAULT;

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

function PressableScale({
  style,
  children,
  scale = 0.97,
  ...rest
}: React.ComponentProps<typeof Pressable> & { style?: StyleProp<ViewStyle>; scale?: number }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

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
    <AiPageShell title="What's moving">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.olive[600]}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>LUXE AI · TRENDING</Text>
          <Text style={styles.heroTitle}>
            What's moving,{"\n"}
            <Text style={styles.heroTitleItalic}>this week.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Pieces gaining traction across the catalogue — ranked as shoppers
            move.
          </Text>
        </View>

        {loading ? (
          <>
            <View style={styles.statusRow}>
              <View style={styles.statusPill}>
                <Ionicons name="flame" size={12} color={GOLD} />
                <Text style={styles.statusText}>Scanning this week's movers…</Text>
              </View>
            </View>
            <View style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.card}>
                  <View style={styles.imgWrap}>
                    <Skeleton style={styles.img} borderRadius={0} />
                  </View>
                  <View style={styles.cardBody}>
                    <Skeleton width="90%" height={13} />
                    <Skeleton width="45%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : error ? (
          <View style={styles.stateCard}>
            <View style={styles.medallionOuter}>
              <LinearGradient
                colors={["#242621", "#151613"]}
                style={styles.medallionInner}
              >
                <Ionicons name="cloud-offline-outline" size={24} color={GOLD} />
              </LinearGradient>
            </View>
            <Text style={styles.stateTitle}>Couldn't load trends</Text>
            <Text style={styles.stateSub}>
              Check your connection and try again.
            </Text>
            <PressableScale style={styles.retryBtn} onPress={() => void load()}>
              <Ionicons name="refresh" size={14} color={CREAM} />
              <Text style={styles.retryText}>Retry</Text>
            </PressableScale>
          </View>
        ) : trends.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={styles.medallionOuter}>
              <LinearGradient
                colors={["#242621", "#151613"]}
                style={styles.medallionInner}
              >
                <Ionicons name="trending-up-outline" size={24} color={GOLD} />
              </LinearGradient>
            </View>
            <Text style={styles.stateTitle}>Nothing trending yet</Text>
            <Text style={styles.stateSub}>
              Trending pieces appear here once shoppers start moving on the
              catalogue.
            </Text>
            <PressableScale
              style={styles.retryBtn}
              onPress={() => router.push("/(main)/products" as never)}
            >
              <Ionicons name="compass-outline" size={14} color={CREAM} />
              <Text style={styles.retryText}>Explore the shop</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            <View style={styles.resultHead}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eyebrow}>Live ranking</Text>
                <Text style={styles.resultTitle}>
                  {trends.length}{" "}
                  <Text style={styles.resultTitleItalic}>
                    mover{trends.length === 1 ? "" : "s"}
                  </Text>
                </Text>
              </View>
              <View style={styles.queryChip}>
                <Ionicons name="flame" size={11} color={colors.olive[700]} />
                <Text style={styles.queryChipText} numberOfLines={1}>
                  This week
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              {trends.map((p, index) => (
                <PressableScale
                  key={p.id}
                  scale={0.98}
                  style={styles.card}
                  onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={p.name}
                >
                  <View style={styles.imgWrap}>
                    {p.image_url ? (
                      <Image
                        source={{ uri: p.image_url }}
                        style={styles.img}
                        contentFit="cover"
                        transition={250}
                      />
                    ) : (
                      <View style={[styles.img, styles.imgFallback]}>
                        <Ionicons
                          name="shirt-outline"
                          size={28}
                          color={colors.olive[300]}
                        />
                      </View>
                    )}
                    <LinearGradient
                      colors={["transparent", `${INK}26`]}
                      style={styles.imgShade}
                      pointerEvents="none"
                    />
                    {index === 0 ? (
                      <LinearGradient
                        colors={["#e6c873", GOLD, "#a8862f"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.rankBadge}
                      >
                        <Text style={styles.rankTextTop}>#1</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{index + 1}</Text>
                      </View>
                    )}
                    {index < 3 ? (
                      <View style={styles.hotBadge}>
                        <Ionicons name="flame" size={9} color="#fff" />
                        <Text style={styles.hotText}>HOT</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cardBody}>
                    <Text numberOfLines={2} style={styles.name}>
                      {p.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>
                        {formatPrice(p.price, p.currency ?? "LKR")}
                      </Text>
                      {p.category ? (
                        <Text style={styles.categoryTag} numberOfLines={1}>
                          {p.category.toUpperCase()}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </PressableScale>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </AiPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[10] },
  hero: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },
  heroEyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.olive[600],
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: INK,
  },
  heroTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    maxWidth: 320,
  },

  statusRow: {
    alignItems: "flex-start",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  statusText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: CREAM,
    flexShrink: 1,
  },

  resultHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[1],
  },
  eyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  resultTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: INK,
  },
  resultTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  queryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "50%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}1F`,
  },
  queryChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.olive[800],
    flexShrink: 1,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: 14,
  },
  card: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#ffffff",
    borderRadius: radii["3xl"],
    borderWidth: 1,
    borderColor: `${INK}0D`,
    overflow: "hidden",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  imgWrap: {
    margin: 6,
    borderRadius: radii["2xl"],
    overflow: "hidden",
  },
  img: {
    width: "100%",
    aspectRatio: 0.82,
    backgroundColor: colors.olive[50],
  },
  imgShade: {
    ...StyleSheet.absoluteFillObject,
    top: "55%",
  },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  rankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    minWidth: 28,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10.5,
    color: CREAM,
  },
  rankTextTop: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10.5,
    color: colors.olive[950],
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
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: "#fff",
  },
  cardBody: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
    gap: 6,
  },
  name: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  price: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: INK,
  },
  categoryTag: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: colors.light.mutedForeground,
    flexShrink: 1,
  },

  stateCard: {
    alignItems: "center",
    marginHorizontal: spacing[5],
    marginTop: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
    gap: spacing[2],
    borderRadius: radii["3xl"],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${INK}0D`,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  medallionOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${GOLD}4D`,
    marginBottom: spacing[2],
  },
  medallionInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: INK,
  },
  stateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: colors.light.mutedForeground,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    height: 42,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: CREAM,
  },
});
