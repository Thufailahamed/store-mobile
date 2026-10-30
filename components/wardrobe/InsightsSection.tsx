import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui";
import {
  getWardrobeInsights,
  logWardrobeWear,
  updateWardrobeItem,
} from "@/lib/api/wardrobe";
import type { GarmentType, WardrobeInsights, WardrobeItem } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#65684d";

const GARMENT_LABEL: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  footwear: "Footwear",
  bag: "Bag",
  accessory: "Accessory",
  jewelry: "Jewelry",
  watch: "Watch",
  beauty: "Beauty",
  other: "Other",
};

type AccentKey = "amber" | "blue" | "rose" | "emerald";
// One house palette — accents differ only in the dot + label tone.
const ACCENT_TXT: Record<AccentKey, string> = {
  amber: "#85651b",
  blue: "#414a23",
  rose: "#b85c3a",
  emerald: "#535e2c",
};
const ACCENT_DOT: Record<AccentKey, string> = {
  amber: "#c8a44a",
  blue: "#869149",
  rose: "#b85c3a",
  emerald: "#6a7639",
};

export function InsightsSection({
  onLogWear,
}: {
  onLogWear?: (item: WardrobeItem) => void;
}) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<WardrobeInsights | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getWardrobeInsights();
    setLoading(false);
    if (res.ok) setInsights(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogCare = useCallback(
    async (item: WardrobeItem) => {
      const res = await updateWardrobeItem(item.id, {
        last_care_at: new Date().toISOString(),
      });
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Care logged", "success");
      await load();
    },
    [load, toast],
  );

  const handleQuickWear = useCallback(
    async (item: WardrobeItem) => {
      const res = await logWardrobeWear(item.id, {});
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast(`Worn × ${res.data.result.wear_count}`, "success");
      onLogWear?.(item);
      await load();
    },
    [load, onLogWear, toast],
  );

  if (loading && !insights) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#556b2f" />
      </View>
    );
  }
  if (!insights) return null;

  const cards: Array<{
    title: string;
    count: number;
    icon: keyof typeof Ionicons.glyphMap;
    accent: AccentKey;
    subtitle: string;
    items: WardrobeItem[];
    onAction?: (it: WardrobeItem) => void;
    actionLabel?: string;
    meta?: (it: WardrobeItem) => string | null;
  }> = [
    {
      title: "Never worn",
      count: insights.counts.never_worn,
      icon: "sparkles-outline",
      accent: "amber",
      subtitle: "Owned but not yet worn",
      items: insights.never_worn,
      onAction: handleQuickWear,
      actionLabel: "Wear",
    },
    {
      title: "Underused",
      count: insights.counts.underused,
      icon: "time-outline",
      accent: "blue",
      subtitle: "Worn ≤2× in last 60d",
      items: insights.underused,
    },
    {
      title: "Care due",
      count: insights.counts.care_due,
      icon: "warning-outline",
      accent: "rose",
      subtitle: "At wear-cycle threshold",
      items: insights.care_due,
      onAction: handleLogCare,
      actionLabel: "Log care",
    },
    {
      title: "Recent",
      count: insights.counts.recent,
      icon: "heart-outline",
      accent: "emerald",
      subtitle: "Worn in last 14d",
      items: insights.recent_wears,
      meta: (it) => `${it.wear_count}×`,
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {cards.map((c) => (
        <View key={c.title} style={styles.card}>
          <View style={styles.head}>
            <View
              style={[styles.dot, { backgroundColor: ACCENT_DOT[c.accent] }]}
            />
            <Text style={[styles.cardTitle, { color: ACCENT_TXT[c.accent] }]}>
              {c.title}
            </Text>
          </View>
          <View style={styles.countRow}>
            <Text style={[styles.count, c.count === 0 && styles.countMuted]}>
              {c.count}
            </Text>
            <Text style={styles.sub} numberOfLines={2}>
              {c.subtitle}
            </Text>
          </View>
          <View style={styles.rule} />
          <View style={{ gap: 10 }}>
            {c.items.length === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={15}
                  color={colors.olive[500]}
                />
                <Text style={styles.empty}>All clear</Text>
              </View>
            ) : (
              c.items.slice(0, 3).map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.thumb}>
                    {it.image_url ? (
                      <Image
                        source={{ uri: it.image_url }}
                        style={styles.thumbImg}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons name="shirt-outline" size={14} color={MUTED} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {GARMENT_LABEL[it.garment_type as GarmentType] ??
                        it.garment_type}
                      {c.meta ? ` · ${c.meta(it)}` : ""}
                    </Text>
                  </View>
                  {c.onAction && (
                    <TouchableOpacity
                      onPress={() => c.onAction!(it)}
                      hitSlop={6}
                      activeOpacity={0.7}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionTxt}>{c.actionLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  loading: {
    paddingVertical: 24,
    alignItems: "center",
  },
  row: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 12,
  },
  card: {
    width: 232,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    backgroundColor: "#FFFFFF",
    padding: 16,
    ...shadows.soft,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  cardTitle: {
    flex: 1,
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  index: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.regular,
    color: MUTED,
    letterSpacing: 0.8,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  count: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: -1,
    color: INK,
  },
  countMuted: { color: "rgba(22,23,15,0.25)" },
  sub: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 15,
    color: MUTED,
    fontFamily: fontFamilies.sans.medium,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginVertical: 12,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  empty: {
    fontSize: 12,
    color: colors.olive[600],
    fontFamily: fontFamilies.sans.semibold,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thumb: {
    width: 36,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  itemName: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },
  itemMeta: {
    fontSize: 9.5,
    color: MUTED,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: INK,
  },
  actionTxt: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.bold,
    color: colors.paper.cream,
  },
});
