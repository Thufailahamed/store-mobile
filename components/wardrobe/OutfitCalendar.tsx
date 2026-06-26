import React, { useMemo, useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii } from "@/lib/theme/tokens";
import type { WardrobeOutfit } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "rgba(22,23,15,0.10)";
const OLIVE = "#556b2f";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
    const firstWeekday = new Date(year, month, 1).getDay(); // 0..6
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

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <TouchableOpacity onPress={goPrev} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={16} color={INK} />
        </TouchableOpacity>
        <Text style={styles.title}>{monthLabel}</Text>
        <TouchableOpacity onPress={goNext} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={16} color={INK} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>

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
                isToday && styles.dayCellToday,
                items.length > 0 && styles.dayCellWith,
              ]}
              onPress={() => {
                if (items.length > 0) {
                  onSelectDay?.(c.iso!, items);
                  if (items.length === 1) onSelectOutfit?.(items[0]);
                }
              }}
              activeOpacity={0.7}
              disabled={items.length === 0}
            >
              <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                {c.date!.getDate()}
              </Text>
              {items.length > 0 && (
                <View style={styles.dots}>
                  {items.slice(0, 3).map((o) => (
                    <View key={o.id} style={[styles.dot, isToday && styles.dotToday]} />
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

      {/* Upcoming list */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.upcoming}
      >
        {Object.keys(byDate)
          .sort()
          .slice(0, 8)
          .map((iso) => (
            <TouchableOpacity
              key={iso}
              style={styles.chip}
              onPress={() => {
                const items = byDate[iso];
                if (items.length === 1) onSelectOutfit?.(items[0]);
                else onSelectDay?.(iso, items);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.chipDate}>{iso.slice(5)}</Text>
              <Text style={styles.chipName} numberOfLines={1}>
                {byDate[iso][0].name}
              </Text>
              {byDate[iso].length > 1 && (
                <Text style={styles.chipMore}>+{byDate[iso].length - 1} more</Text>
              )}
            </TouchableOpacity>
          ))}
        {Object.keys(byDate).length === 0 && (
          <Text style={styles.empty}>No scheduled outfits this month</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f1e7",
  },
  title: {
    fontSize: 14,
    fontFamily: fontFamilies.display.regular,
    fontWeight: "600",
    color: INK,
  },
  weekRow: {
    flexDirection: "row",
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 9,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRadius: 6,
  },
  dayCellToday: {
    backgroundColor: "rgba(85,107,47,0.10)",
  },
  dayCellWith: {
    backgroundColor: "rgba(85,107,47,0.06)",
  },
  dayNum: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  dayNumToday: {
    color: OLIVE,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: OLIVE,
  },
  dotToday: {
    backgroundColor: OLIVE,
  },
  moreTxt: {
    fontSize: 8,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginLeft: 2,
  },
  upcoming: {
    paddingTop: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fbfaf3",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 130,
    maxWidth: 180,
  },
  chipDate: {
    fontSize: 10,
    color: OLIVE,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
  chipName: {
    fontSize: 12,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
    marginTop: 2,
  },
  chipMore: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 2,
  },
  empty: {
    fontSize: 12,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontStyle: "italic",
    paddingVertical: 6,
  },
});