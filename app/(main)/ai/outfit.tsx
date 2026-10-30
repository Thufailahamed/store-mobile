import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiOutfitBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;
const CREAM = colors.paper.cream;
const INK = colors.ink.DEFAULT;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const OCCASIONS: { key: string; label: string; icon: IconName }[] = [
  { key: "casual", label: "Casual", icon: "cafe-outline" },
  { key: "work", label: "Work", icon: "briefcase-outline" },
  { key: "wedding", label: "Wedding", icon: "diamond-outline" },
  { key: "travel", label: "Travel", icon: "airplane-outline" },
  { key: "evening", label: "Evening", icon: "moon-outline" },
];
const VIBES: { key: string; icon: IconName }[] = [
  { key: "Minimal", icon: "square-outline" },
  { key: "Bold", icon: "flash-outline" },
  { key: "Romantic", icon: "heart-outline" },
  { key: "Streetwear", icon: "bonfire-outline" },
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

function PressableScale({
  style,
  children,
  scale = 0.97,
  ...rest
}: React.ComponentProps<typeof Pressable> & { style?: StyleProp<ViewStyle>; scale?: number }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

function SelectChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const inner = (
    <>
      <Ionicons
        name={icon}
        size={13}
        color={active ? colors.olive[950] : `${CREAM}B3`}
      />
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </>
  );
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={styles.chipWrap}
    >
      {active ? (
        <LinearGradient
          colors={["#e6c873", GOLD, "#a8862f"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chipInner}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.chipInner, styles.chipOff]}>{inner}</View>
      )}
    </PressableScale>
  );
}

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
  const lookName = `${occasionLabel} · ${vibe}`;

  return (
    <AiPageShell title="Outfit Builder">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>LUXE AI · OUTFIT BUILDER</Text>
          <Text style={styles.heroTitle}>
            Pick the mood.{"\n"}
            <Text style={styles.heroTitleItalic}>We'll style it.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Choose an occasion and a vibe — get a complete look built from live
            pieces.
          </Text>
        </View>

        <View style={styles.builderShadow}>
          <LinearGradient
            colors={["#22271a", colors.olive[950], "#0b0c07"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.builder}
          >
            <View style={styles.builderGlow} />
            <View style={styles.builderTop}>
              <LinearGradient
                colors={["#e6c873", GOLD, "#9c7a2c"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.builderBadge}
              >
                <Ionicons name="shirt-outline" size={13} color={colors.olive[950]} />
              </LinearGradient>
              <Text style={styles.builderLabel}>Design your look</Text>
            </View>

            <Text style={styles.groupLabel}>OCCASION</Text>
            <View style={styles.chips}>
              {OCCASIONS.map((o) => (
                <SelectChip
                  key={o.key}
                  label={o.label}
                  icon={o.icon}
                  active={occasion === o.key}
                  onPress={() => setOccasion(o.key)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>VIBE</Text>
            <View style={styles.chips}>
              {VIBES.map((v) => (
                <SelectChip
                  key={v.key}
                  label={v.key}
                  icon={v.icon}
                  active={vibe === v.key}
                  onPress={() => setVibe(v.key)}
                />
              ))}
            </View>

            <View style={styles.builderFooter}>
              <View style={styles.hintRow}>
                {(["Head-to-toe", "Live prices"] as const).map((h) => (
                  <View key={h} style={styles.hint}>
                    <Text style={styles.hintText}>{h}</Text>
                  </View>
                ))}
              </View>
              <PressableScale
                onPress={() => void generate()}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Build outfit"
                style={[styles.buildWrap, loading && { opacity: 0.6 }]}
              >
                <LinearGradient
                  colors={["#e6c873", GOLD, "#a8862f"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buildBtn}
                >
                  <Text style={styles.buildText}>
                    {loading ? "Styling…" : "Build outfit"}
                  </Text>
                  {!loading ? (
                    <Ionicons name="sparkles" size={14} color={colors.olive[950]} />
                  ) : null}
                </LinearGradient>
              </PressableScale>
            </View>
          </LinearGradient>
        </View>

        {loading ? (
          <>
            <View style={styles.statusRow}>
              <View style={styles.statusPill}>
                <Ionicons name="sparkles" size={12} color={GOLD} />
                <Text style={styles.statusText} numberOfLines={1}>
                  Styling a {vibe.toLowerCase()} {occasionLabel.toLowerCase()} look…
                </Text>
              </View>
            </View>
            <View style={styles.pieceList}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.pieceRow}>
                  <Skeleton width={56} height={56} borderRadius={12} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="40%" height={10} />
                    <Skeleton width="85%" height={13} />
                    <Skeleton width="30%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : error ? (
          <View style={styles.stateCard}>
            <View style={styles.medallionOuter}>
              <LinearGradient
                colors={["#242621", "#151613"]}
                style={styles.medallionInner}
              >
                <Ionicons name="cloud-offline-outline" size={24} color={GOLD} />
              </LinearGradient>
            </View>
            <Text style={styles.stateTitle}>Couldn't build an outfit</Text>
            <Text style={styles.stateSub}>{error}</Text>
            <PressableScale style={styles.retryBtn} onPress={() => void generate()}>
              <Ionicons name="refresh" size={14} color={CREAM} />
              <Text style={styles.retryText}>Try again</Text>
            </PressableScale>
          </View>
        ) : outfit ? (
          outfit.pieces.length === 0 ? (
            <View style={styles.stateCard}>
              <View style={styles.medallionOuter}>
                <LinearGradient
                  colors={["#242621", "#151613"]}
                  style={styles.medallionInner}
                >
                  <Ionicons name="shirt-outline" size={24} color={GOLD} />
                </LinearGradient>
              </View>
              <Text style={styles.stateTitle}>No look found</Text>
              <Text style={styles.stateSub}>
                The catalogue doesn't have enough pieces for this combination
                yet — try another vibe.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.resultHead}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.eyebrow}>Curated for you</Text>
                  <Text style={styles.resultTitle}>
                    {outfit.pieces.length}{" "}
                    <Text style={styles.resultTitleItalic}>
                      piece{outfit.pieces.length === 1 ? "" : "s"}
                    </Text>
                  </Text>
                </View>
                <View style={styles.queryChip}>
                  <Ionicons name="sparkles" size={11} color={colors.olive[700]} />
                  <Text style={styles.queryChipText} numberOfLines={1}>
                    {lookName}
                  </Text>
                </View>
              </View>

              <View style={styles.lookShadow}>
                <LinearGradient
                  colors={["#22271a", colors.olive[950], "#0b0c07"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.lookCard}
                >
                  <View style={styles.builderGlow} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.lookEyebrow}>YOUR LOOK</Text>
                    <Text style={styles.lookTitle}>{lookName}</Text>
                    <Text style={styles.lookSub}>Picked to work together</Text>
                  </View>
                  {typeof outfit.total_price === "number" && outfit.total_price > 0 ? (
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text style={styles.lookEyebrow}>FULL LOOK</Text>
                      <Text style={styles.lookPrice}>
                        {formatPrice(outfit.total_price)}
                      </Text>
                    </View>
                  ) : null}
                </LinearGradient>
              </View>

              <View style={styles.pieceList}>
                {outfit.pieces.map((p) => (
                  <PressableScale
                    key={p.id}
                    scale={0.98}
                    style={styles.pieceRow}
                    onPress={() =>
                      router.push(`/(main)/products/${p.slug}` as never)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`View ${p.name}`}
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
                        <Text style={styles.slotTag}>
                          {(SLOT_LABEL[p.slot] ?? p.slot).toUpperCase()}
                        </Text>
                      ) : null}
                      <Text numberOfLines={2} style={styles.pieceName}>
                        {p.name}
                      </Text>
                      <Text style={styles.piecePrice}>
                        {formatPrice(p.price, p.currency ?? "LKR")}
                      </Text>
                    </View>
                    <View style={styles.pieceChevron}>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={colors.olive[700]}
                      />
                    </View>
                  </PressableScale>
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
  scroll: { paddingBottom: spacing[10] },
  hero: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    gap: spacing[2],
  },
  heroEyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.olive[600],
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: INK,
  },
  heroTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    maxWidth: 320,
  },

  builderShadow: {
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    borderRadius: 26,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 10,
  },
  builder: {
    borderRadius: 26,
    padding: spacing[4],
    gap: spacing[3],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${GOLD}26`,
  },
  builderGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -120,
    right: -80,
    backgroundColor: `${GOLD}1A`,
  },
  builderTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  builderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  builderLabel: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: `${CREAM}B3`,
  },
  groupLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: `${CREAM}59`,
    marginTop: spacing[1],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipWrap: { borderRadius: radii.full },
  chipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.full,
    paddingHorizontal: 13,
    height: 36,
  },
  chipOff: {
    borderWidth: 1,
    borderColor: `${CREAM}1F`,
    backgroundColor: `${CREAM}0F`,
  },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: `${CREAM}CC`,
  },
  chipTextOn: { color: colors.olive[950] },
  builderFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    marginTop: spacing[1],
  },
  hintRow: {
    flexDirection: "row",
    flexShrink: 1,
    gap: 6,
  },
  hint: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: `${CREAM}1F`,
  },
  hintText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10.5,
    color: `${CREAM}8C`,
  },
  buildWrap: { borderRadius: radii.full },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.full,
  },
  buildText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.olive[950],
    letterSpacing: 0.2,
  },

  statusRow: {
    alignItems: "flex-start",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  statusText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: CREAM,
    flexShrink: 1,
  },

  resultHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[1],
  },
  eyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  resultTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: INK,
  },
  resultTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  queryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "50%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}1F`,
  },
  queryChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.olive[800],
    flexShrink: 1,
  },

  lookShadow: {
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    borderRadius: 26,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 10,
  },
  lookCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    borderRadius: 26,
    padding: spacing[5],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${GOLD}26`,
  },
  lookEyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: `${CREAM}59`,
  },
  lookTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: CREAM,
  },
  lookSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: `${CREAM}8C`,
  },
  lookPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: GOLD,
  },

  pieceList: {
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    gap: spacing[2.5],
  },
  pieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: `${INK}0D`,
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  pieceImg: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
  },
  pieceImgFallback: { alignItems: "center", justifyContent: "center" },
  pieceBody: { flex: 1, gap: 3 },
  slotTag: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: colors.olive[600],
  },
  pieceName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
  },
  piecePrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.olive[800],
  },
  pieceChevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },

  stateCard: {
    alignItems: "center",
    marginHorizontal: spacing[5],
    marginTop: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
    gap: spacing[2],
    borderRadius: radii["3xl"],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${INK}0D`,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  medallionOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${GOLD}4D`,
    marginBottom: spacing[2],
  },
  medallionInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: INK,
  },
  stateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: colors.light.mutedForeground,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    height: 42,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: CREAM,
  },
});
