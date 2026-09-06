import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Rect } from "react-native-svg";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export type ChartPoint = { date: string; revenue: number; orders?: number };

type Props = {
  points: ChartPoint[];
  height?: number;
  compact?: boolean;
  style?: ViewStyle;
};

function formatAxisDate(raw: string): string {
  if (!raw) return "";
  if (/^[A-Za-z]{3}/.test(raw) && !raw.includes("-") && raw.length <= 12) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const m = raw.match(/^(\d{4})-(\d{2})/);
    if (m) {
      const dt = new Date(Number(m[1]), Number(m[2]) - 1, 1);
      return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    return raw.slice(0, 10);
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildLinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return "";
  return coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
}

/** Catmull-Rom → cubic bezier for a calmer premium curve. */
function buildSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length < 2) return buildLinePath(coords);
  if (coords.length === 2) return buildLinePath(coords);
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function RevenueChart({ points, height = 168, compact = false, style }: Props) {
  const [measuredW, setMeasuredW] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = compact ? 112 : Math.max(measuredW || 300, 200);
  const padX = compact ? 2 : 12;
  const padY = compact ? 4 : 16;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const onLayout = (e: LayoutChangeEvent) => {
    if (compact) return;
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - measuredW) > 1) setMeasuredW(w);
  };

  const { linePath, areaPath, coords, maxRevenue, labels, midLabel, series } = useMemo(() => {
    const s = points.length > 0 ? points : [{ date: "", revenue: 0 }];
    const values = s.map((p) => Math.max(0, Number(p.revenue) || 0));
    const max = Math.max(...values, 1);
    const n = s.length;
    const c = s.map((p, i) => ({
      x: padX + (n === 1 ? chartW / 2 : (i / Math.max(n - 1, 1)) * chartW),
      y: padY + chartH - (Math.max(0, Number(p.revenue) || 0) / max) * chartH,
    }));
    const line = n >= 3 && !compact ? buildSmoothPath(c) : buildLinePath(c);
    const area =
      c.length > 0
        ? `${line} L ${c[c.length - 1].x} ${padY + chartH} L ${c[0].x} ${padY + chartH} Z`
        : "";
    const mid = s[Math.floor(s.length / 2)];
    return {
      linePath: line,
      areaPath: area,
      coords: c,
      maxRevenue: max,
      labels: {
        first: formatAxisDate(s[0]?.date ?? ""),
        last: formatAxisDate(s[s.length - 1]?.date ?? ""),
      },
      midLabel: formatAxisDate(mid?.date ?? ""),
      series: s,
    };
  }, [points, chartW, chartH, padX, padY, compact]);

  const pickIndex = useCallback(
    (x: number) => {
      if (coords.length === 0) return;
      let best = 0;
      let bestDist = Infinity;
      coords.forEach((c, i) => {
        const d = Math.abs(c.x - x);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setActiveIndex(best);
    },
    [coords],
  );

  if (compact) {
    return (
      <View style={[{ width, height }, style]} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent2.ochre} stopOpacity="0.4" />
              <Stop offset="1" stopColor={colors.accent2.ochre} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {areaPath ? <Path d={areaPath} fill="url(#sparkFill)" /> : null}
          {linePath ? (
            <Path d={linePath} stroke={colors.accent2.ochre} strokeWidth={1.75} fill="none" />
          ) : null}
        </Svg>
      </View>
    );
  }

  const hasData = points.some((p) => (p.revenue ?? 0) > 0);
  const focus = activeIndex != null ? activeIndex : coords.length - 1;
  const focusPoint = coords[focus];
  const focusData = series[focus];

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {!hasData ? (
        <View style={[styles.empty, { height }]}>
          <Text style={styles.emptyKicker}>Trend</Text>
          <Text style={styles.emptyText}>No paid revenue in this window yet</Text>
        </View>
      ) : measuredW === 0 ? (
        <View style={{ height }} />
      ) : (
        <>
          {focusData ? (
            <View style={styles.callout}>
              <Text style={styles.calloutDate}>{formatAxisDate(focusData.date)}</Text>
              <Text style={styles.calloutValue}>{formatPrice(focusData.revenue)}</Text>
              {typeof focusData.orders === "number" ? (
                <Text style={styles.calloutOrders}>
                  {focusData.orders} {focusData.orders === 1 ? "order" : "orders"}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Pressable
            onPress={(e) => pickIndex(e.nativeEvent.locationX)}
            onPressIn={(e) => pickIndex(e.nativeEvent.locationX)}
            accessibilityRole="adjustable"
            accessibilityLabel="Revenue chart. Tap to inspect a day."
          >
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.olive[600]} stopOpacity="0.3" />
                  <Stop offset="1" stopColor={colors.olive[600]} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              {[0.25, 0.5, 0.75].map((t) => (
                <Line
                  key={t}
                  x1={padX}
                  y1={padY + chartH * t}
                  x2={padX + chartW}
                  y2={padY + chartH * t}
                  stroke="rgba(83,94,44,0.1)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}
              {areaPath ? <Path d={areaPath} fill="url(#revFill)" /> : null}
              {linePath ? (
                <Path
                  d={linePath}
                  stroke={colors.olive[800]}
                  strokeWidth={2.4}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {focusPoint ? (
                <>
                  <Line
                    x1={focusPoint.x}
                    y1={padY}
                    x2={focusPoint.x}
                    y2={padY + chartH}
                    stroke="rgba(200,164,74,0.45)"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                  <Circle cx={focusPoint.x} cy={focusPoint.y} r={7} fill="rgba(200,164,74,0.28)" />
                  <Circle
                    cx={focusPoint.x}
                    cy={focusPoint.y}
                    r={3.75}
                    fill={colors.accent2.ochre}
                    stroke={colors.paper.cream}
                    strokeWidth={2}
                  />
                </>
              ) : null}
              {/* Invisible hit targets */}
              {coords.map((c, i) => (
                <Rect
                  key={`hit-${i}`}
                  x={Math.max(0, c.x - chartW / Math.max(coords.length * 2, 2))}
                  y={0}
                  width={Math.max(24, chartW / Math.max(coords.length, 1))}
                  height={height}
                  fill="transparent"
                  onPress={() => setActiveIndex(i)}
                />
              ))}
            </Svg>
          </Pressable>
          <View style={styles.axisRow}>
            <Text style={styles.axisLabel}>{labels.first}</Text>
            <Text style={styles.axisPeak}>Peak {formatPrice(maxRevenue)}</Text>
            <Text style={styles.axisLabel}>{labels.last || midLabel}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: radii.xl, overflow: "hidden" },
  callout: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  calloutDate: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  calloutValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.olive[950],
    letterSpacing: -0.3,
  },
  calloutOrders: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.olive[700],
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    borderRadius: radii.xl,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
  },
  emptyKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 2,
  },
  axisLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
    letterSpacing: 0.3,
  },
  axisPeak: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
    letterSpacing: 0.3,
  },
});
