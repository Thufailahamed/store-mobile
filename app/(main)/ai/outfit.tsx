import React, { useState } from "react";
import { View, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Body, Label } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { aiOutfitBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const OCCASIONS = [
  { key: "casual", label: "Casual" },
  { key: "work", label: "Work" },
  { key: "wedding", label: "Wedding" },
  { key: "travel", label: "Travel" },
  { key: "evening", label: "Evening" },
];
const VIBES = ["Minimal", "Bold", "Romantic", "Streetwear"];

type Piece = { id: string; name: string; slug: string; price: number; image_url?: string };

export default function AiOutfitScreen() {
  const router = useRouter();
  const [occasion, setOccasion] = useState("casual");
  const [vibe, setVibe] = useState("Minimal");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setPieces([]);
    const res = await aiOutfitBackend({ occasion, vibe });
    const o = res.ok ? (res.data.outfit ?? res.data) : {};
    setPieces((o as { pieces?: Piece[] }).pieces ?? []);
    setLoading(false);
  };

  return (
    <AiPageShell title="Outfit Builder" description="Pick an occasion and vibe — we'll suggest a complete look.">
      <View style={styles.pad}>
        <Label>Occasion</Label>
        <View style={styles.chips}>
          {OCCASIONS.map((o) => (
            <TouchableOpacity
              key={o.key}
              style={[styles.chip, occasion === o.key && styles.chipOn]}
              onPress={() => setOccasion(o.key)}
            >
              <Body size="xs" style={occasion === o.key ? styles.onText : undefined}>{o.label}</Body>
            </TouchableOpacity>
          ))}
        </View>
        <Label style={{ marginTop: 12 }}>Vibe</Label>
        <View style={styles.chips}>
          {VIBES.map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.chip, vibe === v && styles.chipOn]}
              onPress={() => setVibe(v)}
            >
              <Body size="xs" style={vibe === v ? styles.onText : undefined}>{v}</Body>
            </TouchableOpacity>
          ))}
        </View>
        <Button variant="brand" onPress={() => void generate()} style={{ marginTop: 16 }}>
          {loading ? "Building…" : "Build outfit"}
        </Button>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      <ScrollView contentContainerStyle={styles.grid}>
        {pieces.map((p) => (
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
  pad: { paddingHorizontal: spacing[5] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.olive[800], borderColor: colors.olive[800] },
  onText: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing[5], gap: 12 },
  card: { width: "47%", gap: 6 },
  img: { width: "100%", aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.olive[50] },
});
