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
import { radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui";
import { getWardrobeInsights, logWardrobeWear, updateWardrobeItem } from "@/lib/api/wardrobe";
import type { GarmentType, WardrobeInsights, WardrobeItem } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";

const GARMENT_LABEL: Record<string, string> = {
  top: "Top", bottom: "Bottom", dress: "Dress", footwear: "Footwear",
  bag: "Bag", accessory: "Accessory", jewelry: "Jewelry", watch: "Watch",
  beauty: "Beauty", other: "Other",
};

type AccentKey = "amber" | "blue" | "rose" | "emerald";
const ACCENT_RING: Record<AccentKey, string> = {
  amber: "rgba(217,119,6,0.25)",
  blue: "rgba(37,99,235,0.20)",
  rose: "rgba(225,29,72,0.20)",
  emerald: "rgba(5,150,105,0.20)",
};
const ACCENT_BG: Record<AccentKey, string> = {
  amber: "rgba(217,119,6,0.06)",
  blue: "rgba(37,99,235,0.05)",
  rose: "rgba(225,29,72,0.05)",
  emerald: "rgba(5,150,105,0.05)",
};
const ACCENT_TXT: Record<AccentKey, string> = {
  amber: "#b45309", blue: "#1d4ed8", rose: "#be123c", emerald: "#047857",
};

export function InsightsSection({ onLogWear }: { onLogWear?: (item: WardrobeItem) => void }) {
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
        <View
          key={c.title}
          style={[
            styles.card,
            {
              borderColor: ACCENT_RING[c.accent],
              backgroundColor: ACCENT_BG[c.accent],
            },
          ]}
        >
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: ACCENT_TXT[c.accent] }]}>
                {c.title}
              </Text>
              <Text style={styles.count}>{c.count}</Text>
            </View>
            <Ionicons name={c.icon} size={18} color={ACCENT_TXT[c.accent]} />
          </View>
          <Text style={styles.sub}>{c.subtitle}</Text>
          <View style={{ marginTop: 10, gap: 6 }}>
            {c.items.length === 0 ? (
              <Text style={styles.empty}>No items</Text>
            ) : (
              c.items.slice(0, 4).map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.thumb}>
                    {it.image_url ? (
                      <Image source={{ uri: it.image_url }} style={styles.thumbImg} contentFit="cover" />
                    ) : (
                      <Ionicons name="shirt-outline" size={14} color={MUTED} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {GARMENT_LABEL[it.garment_type as GarmentType] ?? it.garment_type}
                      {c.meta ? ` · ${c.meta(it)}` : ""}
                    </Text>
                  </View>
                  {c.onAction && (
                    <TouchableOpacity
                      onPress={() => c.onAction!(it)}
                      hitSlop={6}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionTxt, { color: ACCENT_TXT[c.accent] }]}>
                        {c.actionLabel}
                      </Text>
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
    gap: 10,
  },
  card: {
    width: 240,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 12,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  count: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    fontWeight: "700",
    color: INK,
    marginTop: 2,
  },
  sub: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 4,
  },
  empty: {
    fontSize: 11,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontStyle: "italic",
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#f1efe6",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  itemName: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
    color: INK,
  },
  itemMeta: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 1,
  },
  actionTxt: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});