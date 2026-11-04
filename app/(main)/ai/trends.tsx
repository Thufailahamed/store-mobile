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
import { AiPageShell } from "@/components/ai/AiPageShell";
import { UP as C } from "@/components/user/user-page";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiTrendsBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";

const SOFT = "#f5f3ec";

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

  // A failed pull-to-refresh keeps the list on screen; the error state only
  // replaces content when there is nothing to show.
  const showError = !!error && trends.length === 0;

  return (
    <AiPageShell title="Trends">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={C.accent}
          />
        }
      >
        <View style={styles.cardShadow}>
          <View style={[styles.card, styles.introRow]}>
            <View style={styles.iconCircle}>
              <Ionicons name="trending-up" size={22} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>What&apos;s moving this week</Text>
              <Text style={styles.introSub}>
                Pieces gaining traction, ranked as shoppers move.
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <>
            <Text style={styles.sectionTitle}>Scanning this week&apos;s movers…</Text>
            <View style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.product}>
                  <Skeleton style={styles.img} borderRadius={14} />
                  <View style={styles.productBody}>
                    <Skeleton width="90%" height={13} />
                    <Skeleton width="45%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : showError ? (
          <View style={[styles.cardShadow, styles.gapTop]}>
            <View style={[styles.card, styles.stateCard]}>
              <View style={styles.iconCircle}>
                <Ionicons name="cloud-offline-outline" size={22} color={C.accent} />
              </View>
              <Text style={styles.stateTitle}>Couldn&apos;t load trends</Text>
              <Text style={styles.stateSub}>Check your connection and try again.</Text>
              <PressableScale style={styles.smallCta} onPress={() => void load()}>
                <Ionicons name="refresh" size={15} color={C.lime} />
                <Text style={styles.smallCtaText}>Retry</Text>
              </PressableScale>
            </View>
          </View>
        ) : trends.length === 0 ? (
          <View style={[styles.cardShadow, styles.gapTop]}>
            <View style={[styles.card, styles.stateCard]}>
              <View style={styles.iconCircle}>
                <Ionicons name="trending-up-outline" size={22} color={C.accent} />
              </View>
              <Text style={styles.stateTitle}>Nothing trending yet</Text>
              <Text style={styles.stateSub}>
                Trending pieces appear here once shoppers start moving on the catalogue.
              </Text>
              <PressableScale
                style={styles.smallCta}
                onPress={() => router.push("/(main)/products" as never)}
              >
                <Ionicons name="compass-outline" size={15} color={C.lime} />
                <Text style={styles.smallCtaText}>Explore the shop</Text>
              </PressableScale>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.resultHead}>
              <Text style={styles.resultTitle}>Live ranking</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {trends.length} mover{trends.length === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              {trends.map((p, index) => (
                <PressableScale
                  key={p.id}
                  scale={0.98}
                  style={styles.product}
                  onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`Number ${index + 1}, ${p.name}`}
                >
                  <View>
                    {p.image_url ? (
                      <Image
                        source={{ uri: p.image_url }}
                        style={styles.img}
                        contentFit="cover"
                        transition={250}
                      />
                    ) : (
                      <View style={[styles.img, styles.imgFallback]}>
                        <Ionicons name="shirt-outline" size={28} color={C.faint} />
                      </View>
                    )}
                    <View style={[styles.rankBadge, index === 0 && styles.rankBadgeTop]}>
                      {index < 3 ? (
                        <Ionicons name="flame" size={11} color={index === 0 ? C.ink : C.lime} />
                      ) : null}
                      <Text style={[styles.rankText, index === 0 && styles.rankTextTop]}>
                        #{index + 1}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.productBody}>
                    {p.category ? (
                      <Text style={styles.categoryTag} numberOfLines={1}>
                        {p.category}
                      </Text>
                    ) : null}
                    <Text numberOfLines={2} style={styles.name}>
                      {p.name}
                    </Text>
                    <Text style={styles.price}>{formatPrice(p.price, p.currency ?? "LKR")}</Text>
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
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  gapTop: { marginTop: 20 },
  cardShadow: {
    borderRadius: 26,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    overflow: "hidden",
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  introRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  introTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.text, letterSpacing: -0.3 },
  introSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: C.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.3,
    marginTop: 26,
    marginBottom: 12,
  },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 12 },
  resultTitle: { flex: 1, fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.text, letterSpacing: -0.3 },
  countBadge: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: C.accentSoft,
    justifyContent: "center",
  },
  countText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: C.accent },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  product: {
    width: "48.5%",
    flexGrow: 1,
    maxWidth: "50%",
    padding: 8,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  img: { width: "100%", aspectRatio: 0.8, borderRadius: 14, backgroundColor: SOFT },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  rankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: C.ink,
  },
  rankBadgeTop: { backgroundColor: C.lime },
  rankText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: "#FFFFFF" },
  rankTextTop: { color: C.ink },
  productBody: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4, gap: 3 },
  categoryTag: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, lineHeight: 18, color: C.text },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text },
  stateCard: { alignItems: "center", paddingVertical: 28, gap: 6 },
  stateTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text, marginTop: 8 },
  stateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  smallCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: C.ink,
    marginTop: 10,
  },
  smallCtaText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: "#FFFFFF" },
});
