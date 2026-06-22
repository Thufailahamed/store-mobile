import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useTheme } from "@/lib/theme/provider";
import { useDriverEarnings } from "@/lib/hooks/useDriverEarnings";
import { formatPrice } from "@/lib/utils/delivery-format";
import { EmptyState } from "@/components/ui";
import { typography, radii } from "@/lib/theme/tokens";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 days" },
  { key: "month", label: "30 days" },
  { key: "all", label: "All" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

export default function EarningsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { metricsByRange, loading, refreshing, load, error } = useDriverEarnings();
  const [range, setRange] = useState<RangeKey>("week");
  const styles = makeStyles(colors);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const m = metricsByRange[range];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />
      }
    >
      <Text style={styles.h1}>Earnings</Text>
      <Text style={styles.muted}>Your delivery performance at a glance</Text>

      {/* Range tabs */}
      <View style={styles.tabs}>
        {RANGES.map((r) => {
          const selected = range === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => setRange(r.key)}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* KPI grid */}
      <View style={styles.kpiGrid}>
        <KpiCard label="Delivered" value={m.delivered.toString()} accent="#16a34a" colors={colors} />
        <KpiCard label="Success rate" value={`${m.success_rate}%`} accent={colors.primary} colors={colors} />
        <KpiCard label="COD collected" value={formatPrice(m.cod_collected)} accent="#d97706" colors={colors} />
        <KpiCard
          label="Avg time"
          value={m.avg_delivery_minutes > 0 ? `${m.avg_delivery_minutes}m` : "—"}
          accent="#6366f1"
          colors={colors}
        />
      </View>

      {/* Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily breakdown</Text>
        <Text style={styles.muted}>{m.daily.length} day{m.daily.length === 1 ? "" : "s"}</Text>
        <BarChart
          data={m.daily}
          deliveredColor={colors.primary}
          failedColor={colors.destructive}
          bgColor={colors.card}
          borderColor={colors.border}
          textColor={colors.mutedForeground}
        />
      </View>

      {/* Failures summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Outcomes</Text>
        <StatRow label="Delivered" value={m.delivered} colors={colors} />
        <StatRow label="Returned" value={m.returned} colors={colors} />
        <StatRow label="Cancelled" value={m.cancelled} colors={colors} />
        <StatRow label="Failed" value={m.failed} colors={colors} bold />
      </View>

      {error ? (
        <View style={[styles.card, { backgroundColor: colors.destructive + "15" }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.destructive} />
          <Text style={{ color: colors.destructive, marginTop: 6 }}>{error}</Text>
        </View>
      ) : null}

      {m.total_assigned === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No deliveries yet"
          description="Complete a delivery to see your earnings."
        />
      ) : null}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function KpiCard({
  label,
  value,
  accent,
  colors,
}: {
  label: string;
  value: string;
  accent: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[kpiStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[kpiStyles.value, { color: accent }]}>{value}</Text>
      <Text style={[kpiStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function StatRow({
  label,
  value,
  colors,
  bold,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useTheme>["colors"];
  bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
      <Text
        style={{
          fontSize: typography.fontSizes.sm,
          color: colors.foreground,
          fontWeight: bold ? (typography.fontWeights.semibold as any) : typography.fontWeights.regular,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: typography.fontSizes.sm,
          fontFamily: "monospace",
          color: colors.foreground,
          fontWeight: bold ? (typography.fontWeights.bold as any) : typography.fontWeights.medium,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function BarChart({
  data,
  deliveredColor,
  failedColor,
  bgColor,
  borderColor,
  textColor,
}: {
  data: { date: string; delivered: number; failed: number }[];
  deliveredColor: string;
  failedColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}) {
  if (data.length === 0) {
    return (
      <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: textColor, fontSize: typography.fontSizes.sm }}>No data</Text>
      </View>
    );
  }
  const width = 320;
  const height = 140;
  const padBottom = 24;
  const padTop = 12;
  const innerH = height - padBottom - padTop;
  const max = Math.max(1, ...data.map((d) => d.delivered + d.failed));
  const barW = Math.max(6, (width - 16) / data.length - 4);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const total = d.delivered + d.failed;
        const totalH = (total / max) * innerH;
        const failH = total > 0 ? (d.failed / total) * totalH : 0;
        const x = 8 + i * (barW + 4);
        const y = padTop + (innerH - totalH);
        return (
          <React.Fragment key={d.date}>
            <Rect x={x} y={y} width={barW} height={totalH} fill={deliveredColor} rx={2} />
            {failH > 0 ? (
              <Rect
                x={x}
                y={y}
                width={barW}
                height={failH}
                fill={failedColor}
                rx={2}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  value: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold as any,
    fontFamily: "monospace",
  },
  label: {
    fontSize: typography.fontSizes.xs,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { paddingHorizontal: 16, paddingBottom: 24 },
    h1: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold as any, color: colors.foreground },
    muted: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground, marginTop: 2 },
    tabs: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 16 },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: typography.fontSizes.xs, color: colors.mutedForeground, fontWeight: typography.fontWeights.medium as any },
    tabTextActive: { color: colors.primaryForeground },
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginTop: 12,
    },
    cardTitle: {
      fontSize: typography.fontSizes.base,
      fontWeight: typography.fontWeights.semibold as any,
      color: colors.foreground,
      marginBottom: 4,
    },
  });
}
