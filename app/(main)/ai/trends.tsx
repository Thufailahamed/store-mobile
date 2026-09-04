import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Body } from "@/components/ui/Typography";
import { aiTrendsBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Trend = { id: string; name: string; slug: string; price: number; image_url?: string };

export default function AiTrendsScreen() {
  const router = useRouter();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void aiTrendsBackend().then((res) => {
      if (cancelled) return;
      setTrends(res.ok ? (res.data.trends ?? []) : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AiPageShell title="What's moving" description="Pieces gaining traction across the catalogue this week.">
      {loading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
      {!loading && trends.length === 0 ? (
        <Body muted style={{ textAlign: "center", marginTop: 40 }}>No trends available right now.</Body>
      ) : null}
      <ScrollView contentContainerStyle={styles.grid}>
        {trends.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
          >
            {p.image_url ? (
              <Image source={{ uri: p.image_url }} style={styles.img} contentFit="cover" />
            ) : (
              <View style={styles.img} />
            )}
            <Body size="xs" numberOfLines={2}>{p.name}</Body>
            <Body size="sm" style={{ fontFamily: fontFamilies.sans.semibold }}>{formatPrice(p.price)}</Body>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </AiPageShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing[5], gap: 12 },
  card: { width: "47%", gap: 6 },
  img: { width: "100%", aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.olive[50] },
});
