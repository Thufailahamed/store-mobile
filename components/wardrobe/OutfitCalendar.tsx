import React, { useMemo, useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { WardrobeOutfit } from "@/lib/types";

const HAIRLINE = "rgba(22, 23, 15, 0.08)";
const GOLD_DEEP = "#85651b";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatChipDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function OutfitCalendar({
  outfits,
  onSelectDay,
  onSelectOutfit,
}: {
  outfits: WardrobeOutfit[];
  onSelectDay?: (date: string, items: WardrobeOutfit[]) => void;
  onSelectOutfit?: (outfit: WardrobeOutfit) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const byDate = useMemo(() => {
    const map: Record<string, WardrobeOutfit[]> = {};
    for (const o of outfits) {
      const d = o.scheduled_for;
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(o);
    }
    return map;
  }, [outfits]);

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
    const lastDay = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string; date?: Date; iso?: string }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ key: `pad-${i}` });
    }
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month, d);
      cells.push({ key: `d-${d}`, date, iso: formatISO(date) });
    }
    return cells;
  }, [cursor]);

  const goPrev = () => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  };
  const goNext = () => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  };

  const todayIso = formatISO(new Date());
  const scheduledDates = Object.keys(byDate).sort();
  const upcoming = scheduledDates.filter((iso) => iso >= todayIso);
  const list = (upcoming.length > 0 ? upcoming : scheduledDates).slice(0, 4);

  return (
    <View style={styles.wrap}>
      {/* Month navigation */}
      <View style={styles.head}>
        <TouchableOpacity
          onPress={goPrev}
          hitSlop={8}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={17} color={colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={goNext}
          hitSlop={8}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={17} color={colors.light.foreground} />
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>

      {/* Days */}
      <View style={styles.grid}>
        {days.map((c) => {
          if (!c.iso) return <View key={c.key} style={styles.dayCell} />;
          const items = byDate[c.iso] ?? [];
          const isToday = c.iso === todayIso;
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.dayCell,
                items.length > 0 && styles.dayCellWith,
                isToday && styles.dayCellToday,
              ]}
              onPress={() => {
                if (items.length > 0) {
                  onSelectDay?.(c.iso!, items);
                  if (items.length === 1) onSelectOutfit?.(items[0]);
                }
              }}
              activeOpacity={0.7}
              disabled={items.length === 0}
              accessibilityLabel={
                items.length > 0
                  ? `${c.date!.toDateString()}, ${items.length} scheduled`
                  : undefined
              }
            >
              <Text
                style={[
                  styles.dayNum,
                  isToday && styles.dayNumToday,
                ]}
              >
                {c.date!.getDate()}
              </Text>
              {items.length > 0 && (
                <View style={styles.dots}>
                  {items.slice(0, 3).map((o) => (
                    <View
                      key={o.id}
                      style={[styles.dot, isToday && styles.dotToday]}
                    />
                  ))}
                  {items.length > 3 && (
                    <Text style={styles.moreTxt}>+{items.length - 3}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Scheduled looks */}
      <View style={styles.schedule}>
        <Text style={styles.scheduleEyebrow}>
          {upcoming.length > 0 ? "Coming up" : scheduledDates.length > 0 ? "Scheduled" : "Coming up"}
        </Text>
        {list.length === 0 ? (
          <Text style={styles.scheduleEmpty}>
            Nothing planned yet — schedule an outfit from its page.
          </Text>
        ) : (
          list.map((iso, i) => {
            const items = byDate[iso];
            return (
              <TouchableOpacity
                key={iso}
                style={[styles.schedRow, i > 0 && styles.schedRowDivider]}
                onPress={() => {
                  if (items.length === 1) onSelectOutfit?.(items[0]);
                  else onSelectDay?.(iso, items);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.schedDateBox}>
                  <Text style={styles.schedDayNum}>{iso.slice(8)}</Text>
                  <Text style={styles.schedDayLabel}>
                    {new Date(`${iso}T12:00:00`)
                      .toLocaleDateString(undefined, { weekday: "short" })
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={styles.schedBody}>
                  <Text style={styles.schedName} numberOfLines={1}>
                    {items[0].name}
                  </Text>
                  <Text style={styles.schedMeta} numberOfLines={1}>
                    {formatChipDate(iso)}
                    {items.length > 1 ? `  ·  +${items.length - 1} more` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: colors.paper.cream,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
  },
  title: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  weekRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 6,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellWith: {},
  dayCellToday: {
    backgroundColor: colors.olive[900],
    borderRadius: 12,
  },
  dayNum: {
    fontSize: 13.5,
    fontFamily: fontFamilies.sans.medium,
    color: colors.light.foreground,
  },
  dayNumToday: {
    color: colors.paper.cream,
    fontFamily: fontFamilies.sans.bold,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 3,
    height: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent2.ochre,
  },
  dotToday: {
    backgroundColor: "#E8CF8F",
  },
  moreTxt: {
    fontSize: 8,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    marginLeft: 1,
  },
  schedule: {
    marginTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  scheduleEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  scheduleEmpty: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    paddingVertical: 8,
  },
  schedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: 10,
  },
  schedRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  schedDateBox: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
  },
  schedDayNum: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
  },
  schedDayLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 7.5,
    letterSpacing: 0.6,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  schedBody: {
    flex: 1,
    gap: 1,
  },
  schedName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  schedMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
});
