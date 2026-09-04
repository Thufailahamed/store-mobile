import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Body } from "@/components/ui/Typography";
import { aiSearchBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const SUGGESTIONS = [
  "linen blazer under LKR 20,000",
  "wedding guest outfit",
  "running shoes for wide feet",
  "black tie event dress",
];

type ProductHit = { id: string; name: string; slug: string; price: number; image_url?: string };

export default function AiSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setLoading(true);
    setResults(null);
    const res = await aiSearchBackend(text);
    const rows = res.ok ? (res.data.products ?? []) : [];
    setResults(rows);
    setLoading(false);
  };

  return (
    <AiPageShell title="Smart Search" description="Describe what you're looking for — natural language works.">
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder="e.g. leather loafers under LKR 25,000"
          placeholderTextColor={colors.light.mutedForeground}
          style={styles.input}
        />
        <TouchableOpacity style={styles.go} onPress={() => void search()} disabled={loading}>
          <Body size="sm" style={{ color: "#fff" }}>Go</Body>
        </TouchableOpacity>
      </View>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={styles.chip}
            onPress={() => {
              setQuery(s);
              void search(s);
            }}
          >
            <Body size="xs">{s}</Body>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      <ScrollView contentContainerStyle={styles.grid}>
        {(results ?? []).map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
          >
            {p.image_url ? (
              <Image source={{ uri: p.image_url }} style={styles.img} contentFit="cover" />
            ) : (
              <View style={[styles.img, styles.ph]} />
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
  row: { flexDirection: "row", gap: 8, paddingHorizontal: spacing[5] },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
  },
  go: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing[5], paddingTop: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing[5], gap: 12 },
  card: { width: "47%", gap: 6 },
  img: { width: "100%", aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.olive[50] },
  ph: {},
});
