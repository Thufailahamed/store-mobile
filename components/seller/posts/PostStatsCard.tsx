/**
 * Post insights (last 14 days) — a rounded card: three headline figures, the
 * shopper journey as soft progress bars, and daily views as a column chart.
 */
import { P, RADIUS, SHADOW } from "./palette";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { sellerPostsApi } from "@/lib/posts/api";
import type { PostStats } from "@/lib/posts/types";
import { fontFamilies } from "@/lib/theme/fonts";
import { CountUp, compactCount } from "./motion";

function Grow({ pct, delay, horizontal, children, style }: {
  pct: number; delay: number; horizontal?: boolean; children?: React.ReactNode; style?: object;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [pct, delay, v]);
  const a = useAnimatedStyle(() => (horizontal ? { width: `${v.value}%` } : { height: `${v.value}%` }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

export function PostStatsCard({ postId }: { postId: string }) {
  const [stats, setStats] = useState<PostStats | null>(null);
  useEffect(() => {
    sellerPostsApi.stats(postId, 14).then(setStats).catch(() => setStats(null));
  }, [postId]);
  if (!stats) return null;
  const t = stats.totals;
  const max = Math.max(1, ...stats.series.map((d) => d.views));
  const top = Math.max(1, t.impressions, t.views);
  const funnel: { label: string; icon: IonIconName; value: number }[] = [
    { label: "Seen", icon: "eye-outline", value: t.impressions },
    { label: "Watched or opened", icon: "play-outline", value: t.views },
    { label: "Tapped a piece", icon: "hand-left-outline", value: t.product_clicks },
    { label: "Added to bag", icon: "bag-add-outline", value: t.add_to_carts },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
      <Text style={styles.title}>Insights</Text>
      <Text style={styles.period}>Last 14 days</Text>

      <View style={styles.headRow}>
        <Figure value={t.views} format={compactCount} label="Views" />
        <View style={styles.vr} />
        <Figure value={Math.round(t.click_rate * 100)} format={(n) => `${Math.round(n)}%`} label="Tap rate" delay={120} />
        <View style={styles.vr} />
        <Figure value={t.avg_watch_ms / 1000} format={(n) => `${n.toFixed(1)}s`} label="Avg. watch" delay={240} />
      </View>

      <View style={styles.body}>
        <Text style={styles.section}>Shopper journey</Text>
        {funnel.map((f, i) => (
          <View key={f.label} style={styles.fRow}>
            <View style={styles.fIcon}>
              <Ionicons name={f.icon} size={14} color={P.ink} />
            </View>
            <View style={{ flex: 1, gap: 7 }}>
              <View style={styles.fTop}>
                <Text style={styles.fLabel}>{f.label}</Text>
                <Text style={styles.fValue}>{f.value.toLocaleString()}</Text>
              </View>
              <View style={styles.track}>
                <Grow horizontal pct={Math.max(f.value ? 4 : 0, (f.value / top) * 100)} delay={200 + i * 120}
                  style={[styles.fill, i === 3 && { backgroundColor: P.coral }]} />
              </View>
            </View>
          </View>
        ))}

        <Text style={[styles.section, { marginTop: 6 }]}>Daily views</Text>
        {stats.series.length ? (
          <View style={styles.chart} accessibilityLabel="Daily views">
            {stats.series.map((d, i) => (
              <View key={d.day} style={styles.col}>
                <Grow pct={Math.max(4, (d.views / max) * 100)} delay={400 + i * 40}
                  style={[styles.bar, d.views === max && { backgroundColor: P.coral }]} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyRow}>
            <Ionicons name="time-outline" size={14} color={P.mute} />
            <Text style={styles.empty}>No views yet. Insights refresh every fifteen minutes.</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function Figure({ value, format, label, delay = 0 }: {
  value: number; format: (n: number) => string; label: string; delay?: number;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <CountUp value={value} style={styles.big} format={format} delay={delay} />
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: P.card, borderRadius: RADIUS.card + 4, padding: 18, marginTop: 4, ...SHADOW },
  title: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: P.ink },
  period: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: P.mute, marginTop: 2 },
  headRow: {
    flexDirection: "row", alignItems: "center", marginTop: 16, paddingVertical: 16, borderRadius: RADIUS.card,
    backgroundColor: P.paper,
  },
  big: { fontFamily: fontFamilies.sans.bold, fontSize: 24, letterSpacing: -0.8, color: P.ink },
  bigLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: P.mute, marginTop: 3 },
  vr: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: P.border },

  body: { paddingTop: 22, gap: 14 },
  section: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: P.body },
  fRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  fIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: P.track, alignItems: "center", justifyContent: "center", marginTop: -1 },
  fTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  fLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: P.ink },
  fValue: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: P.track, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: P.ink },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 104 },
  col: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 5, backgroundColor: P.warmer },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  empty: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 18, color: P.mute },
});
