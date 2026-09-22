import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Body, Label } from "@/components/ui/Typography";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiOutfitBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const OCCASIONS = [
  { key: "casual", label: "Casual", icon: "cafe-outline" as const },
  { key: "work", label: "Work", icon: "briefcase-outline" as const },
  { key: "wedding", label: "Wedding", icon: "diamond-outline" as const },
  { key: "travel", label: "Travel", icon: "airplane-outline" as const },
  { key: "evening", label: "Evening", icon: "moon-outline" as const },
];
const VIBES = [
  { key: "Minimal", icon: "square-outline" as const },
  { key: "Bold", icon: "flash-outline" as const },
  { key: "Romantic", icon: "heart-outline" as const },
  { key: "Streetwear", icon: "bonfire-outline" as const },
];

const SLOT_LABEL: Record<string, string> = {
  dress: "Dress",
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
  outerwear: "Layer",
};

type Piece = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency?: string;
  image_url?: string | null;
  slot?: string;
};

type OutfitResult = {
  pieces: Piece[];
  total_price?: number;
};

export default function AiOutfitScreen() {
  const router = useRouter();
  const [occasion, setOccasion] = useState("casual");
  const [vibe, setVibe] = useState("Minimal");
  const [outfit, setOutfit] = useState<OutfitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setOutfit(null);
    const res = await aiOutfitBackend({ occasion, vibe });
    if (res.ok) {
      const o = res.data.outfit ?? res.data;
      setOutfit({ pieces: (o as { pieces?: Piece[] }).pieces ?? [], total_price: (o as { total_price?: number }).total_price });
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const occasionLabel = OCCASIONS.find((o) => o.key === occasion)?.label ?? occasion;

  return (
    <AiPageShell
      title="Outfit Builder"
      description="Pick an occasion and vibe — we'll suggest a complete look."
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.builderCard}>
          <Label style={styles.groupLabel}>OCCASION</Label>
          <View style={styles.chips}>
            {OCCASIONS.map((o) => {
              const active = occasion === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, active && styles.chipOn]}
                  onPress={() => setOccasion(o.key)}
                  activeOpacity={0.8}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={o.icon}
                    size={13}
                    color={active ? colors.paper.cream : colors.olive[700]}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextOn]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Label style={[styles.groupLabel, { marginTop: spacing[4] }]}>VIBE</Label>
          <View style={styles.chips}>
            {VIBES.map((v) => {
              const active = vibe === v.key;
              return (
                <TouchableOpacity
                  key={v.key}
                  style={[styles.chip, active && styles.chipOn]}
                  onPress={() => setVibe(v.key)}
                  activeOpacity={0.8}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={v.icon}
                    size={13}
                    color={active ? colors.paper.cream : colors.olive[700]}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextOn]}>
                    {v.key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.buildBtn, loading && { opacity: 0.7 }]}
            onPress={() => void generate()}
            disabled={loading}
            activeOpacity={0.9}
          >
            <Ionicons name="sparkles" size={15} color={colors.paper.cream} />
            <Text style={styles.buildText}>
              {loading ? "Building your look…" : "Build outfit"}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.pieceList}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.pieceRow}>
                <Skeleton width={64} height={64} borderRadius={12} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="40%" height={10} />
                  <Skeleton width="85%" height={13} />
                  <Skeleton width="30%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : error ? (
          <View style={styles.stateWrap}>
            <View style={styles.stateIcon}>
              <Ionicons name="cloud-offline-outline" size={28} color={colors.olive[600]} />
            </View>
            <Text style={styles.stateTitle}>Couldn't build an outfit</Text>
            <Body muted size="sm" style={styles.stateSub}>{error}</Body>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void generate()}>
              <Ionicons name="refresh" size={14} color={colors.paper.cream} />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : outfit ? (
          outfit.pieces.length === 0 ? (
            <View style={styles.stateWrap}>
              <View style={styles.stateIcon}>
                <Ionicons name="shirt-outline" size={28} color={colors.olive[600]} />
              </View>
              <Text style={styles.stateTitle}>No look found</Text>
              <Body muted size="sm" style={styles.stateSub}>
                The catalogue doesn't have enough pieces for this combination yet.
              </Body>
            </View>
          ) : (
            <>
              <View style={styles.lookCard}>
                <View style={{ flex: 1 }}>
                  <Label style={styles.lookLabel}>YOUR LOOK</Label>
                  <Text style={styles.lookTitle}>
                    {occasionLabel} · {vibe}
                  </Text>
                  <Body muted size="xs">
                    {outfit.pieces.length} piece{outfit.pieces.length === 1 ? "" : "s"} picked for you
                  </Body>
                </View>
                {typeof outfit.total_price === "number" && outfit.total_price > 0 ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <Label style={styles.lookLabel}>TOTAL</Label>
                    <Text style={styles.lookPrice}>
                      {formatPrice(outfit.total_price)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.pieceList}>
                {outfit.pieces.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.pieceRow}
                    onPress={() =>
                      router.push(`/(main)/products/${p.slug}` as never)
                    }
                    activeOpacity={0.85}
                  >
                    {p.image_url ? (
                      <Image
                        source={{ uri: p.image_url }}
                        style={styles.pieceImg}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.pieceImg, styles.pieceImgFallback]}>
                        <Ionicons
                          name="shirt-outline"
                          size={20}
                          color={colors.olive[300]}
                        />
                      </View>
                    )}
                    <View style={styles.pieceBody}>
                      {p.slot ? (
                        <Label style={styles.slotTag}>
                          {(SLOT_LABEL[p.slot] ?? p.slot).toUpperCase()}
                        </Label>
                      ) : null}
                      <Body size="sm" numberOfLines={2} style={styles.pieceName}>
                        {p.name}
                      </Body>
                      <Body size="sm" style={styles.piecePrice}>
                        {formatPrice(p.price, p.currency ?? "LKR")}
                      </Body>
                    </View>
                    <View style={styles.pieceChevron}>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={colors.olive[700]}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )
        ) : null}
      </ScrollView>
    </AiPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },
  builderCard: {
    marginTop: spacing[3],
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    padding: spacing[4],
    ...shadows.soft,
  },
  groupLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.light.mutedForeground,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: spacing[2.5],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.full,
    paddingHorizontal: 13,
    height: 36,
    backgroundColor: colors.paper.DEFAULT,
  },
  chipOn: {
    backgroundColor: colors.olive[800],
    borderColor: colors.olive[800],
  },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  chipTextOn: { color: colors.paper.cream },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: radii.xl,
    backgroundColor: colors.olive[800],
    marginTop: spacing[4],
  },
  buildText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.paper.cream,
  },
  lookCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radii["2xl"],
    backgroundColor: colors.olive[900],
    ...shadows.soft,
  },
  lookLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.olive[200],
  },
  lookTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.paper.cream,
    marginTop: 2,
  },
  lookPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.accent2.ochre,
    marginTop: 2,
  },
  pieceList: { marginTop: spacing[4], gap: spacing[2.5] },
  pieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    ...shadows.soft,
  },
  pieceImg: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
  },
  pieceImgFallback: { alignItems: "center", justifyContent: "center" },
  pieceBody: { flex: 1, gap: 3 },
  slotTag: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.accent2.rust,
  },
  pieceName: { fontFamily: fontFamilies.sans.semibold, lineHeight: 18 },
  piecePrice: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[700],
  },
  pieceChevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  stateWrap: {
    alignItems: "center",
    paddingTop: spacing[10],
    gap: spacing[2],
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  stateTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
  },
  stateSub: { textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    height: 40,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[800],
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.paper.cream,
  },
});
