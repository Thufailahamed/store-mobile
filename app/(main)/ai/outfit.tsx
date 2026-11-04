import React, { useRef, useState } from "react";
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
import { AiPageShell } from "@/components/ai/AiPageShell";
import { UP as C } from "@/components/user/user-page";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiOutfitBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";

const SOFT = "#f5f3ec";

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
  /** The selection this look was built for — the chips can change after. */
  occasionLabel: string;
  vibe: string;
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
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipOn]}
    >
      {active ? (
        <View style={styles.chipCheck}>
          <Ionicons name="checkmark" size={12} color={C.ink} />
        </View>
      ) : (
        <Ionicons name={icon} size={15} color={C.accent} />
      )}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
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
  const reqId = useRef(0);

  const occasionLabel = OCCASIONS.find((o) => o.key === occasion)?.label ?? occasion;

  const generate = async () => {
    const id = ++reqId.current;
    const builtFor = { occasionLabel, vibe };
    setLoading(true);
    setError(null);
    setOutfit(null);
    const res = await aiOutfitBackend({ occasion, vibe });
    if (id !== reqId.current) return;
    if (res.ok) {
      const o = res.data.outfit ?? res.data;
      setOutfit({
        pieces: (o as { pieces?: Piece[] }).pieces ?? [],
        total_price: (o as { total_price?: number }).total_price,
        ...builtFor,
      });
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const lookName = outfit ? `${outfit.occasionLabel} · ${outfit.vibe}` : "";
  const stale = !!outfit && (outfit.occasionLabel !== occasionLabel || outfit.vibe !== vibe);

  return (
    <AiPageShell title="Outfit Builder">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <View style={styles.introRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="shirt" size={22} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.introTitle}>Pick the mood, we&apos;ll style it</Text>
                <Text style={styles.introSub}>
                  A head-to-toe look built from live pieces.
                </Text>
              </View>
            </View>

            <Text style={styles.groupLabel}>Occasion</Text>
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

            <Text style={styles.groupLabel}>Vibe</Text>
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

            <PressableScale
              onPress={() => void generate()}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Build outfit"
              style={[styles.cta, loading && { opacity: 0.5 }]}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="sparkles" size={18} color={C.ink} />
              </View>
              <Text style={styles.ctaText}>
                {loading ? "Styling…" : stale ? "Rebuild for this mood" : outfit ? "Build another" : "Build outfit"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </PressableScale>
          </View>
        </View>

        {loading ? (
          <>
            <Text style={styles.sectionTitle} numberOfLines={1}>
              Styling a {vibe.toLowerCase()} {occasionLabel.toLowerCase()} look…
            </Text>
            <View style={styles.cardShadow}>
              <View style={[styles.card, styles.listCard]}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[styles.pieceRow, i === 1 && styles.pieceRowFirst]}>
                    <Skeleton width={64} height={64} borderRadius={14} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Skeleton width="40%" height={10} />
                      <Skeleton width="85%" height={13} />
                      <Skeleton width="30%" height={12} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : error ? (
          <View style={[styles.cardShadow, styles.gapTop]}>
            <View style={[styles.card, styles.stateCard]}>
              <View style={styles.iconCircle}>
                <Ionicons name="cloud-offline-outline" size={22} color={C.accent} />
              </View>
              <Text style={styles.stateTitle}>Couldn&apos;t build an outfit</Text>
              <Text style={styles.stateSub}>{error}</Text>
              <PressableScale style={styles.smallCta} onPress={() => void generate()}>
                <Ionicons name="refresh" size={15} color={C.lime} />
                <Text style={styles.smallCtaText}>Try again</Text>
              </PressableScale>
            </View>
          </View>
        ) : outfit ? (
          outfit.pieces.length === 0 ? (
            <View style={[styles.cardShadow, styles.gapTop]}>
              <View style={[styles.card, styles.stateCard]}>
                <View style={styles.iconCircle}>
                  <Ionicons name="shirt-outline" size={22} color={C.accent} />
                </View>
                <Text style={styles.stateTitle}>No look found</Text>
                <Text style={styles.stateSub}>
                  Not enough pieces for {lookName.toLowerCase()} yet — try another vibe.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Your look</Text>
              <View style={styles.cardShadow}>
                <View style={styles.card}>
                  <View style={styles.lookHead}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.lookTitle} numberOfLines={1}>
                        {lookName}
                      </Text>
                      <Text style={styles.lookSub}>Picked to work together</Text>
                    </View>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>
                        {outfit.pieces.length} piece{outfit.pieces.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                  </View>

                  {outfit.pieces.map((p, i) => (
                    <PressableScale
                      key={p.id}
                      scale={0.98}
                      style={[styles.pieceRow, i === 0 && styles.pieceRowFirst]}
                      onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
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
                          <Ionicons name="shirt-outline" size={20} color={C.faint} />
                        </View>
                      )}
                      <View style={styles.pieceBody}>
                        {p.slot ? (
                          <Text style={styles.slotTag}>{SLOT_LABEL[p.slot] ?? p.slot}</Text>
                        ) : null}
                        <Text numberOfLines={2} style={styles.pieceName}>
                          {p.name}
                        </Text>
                        <Text style={styles.piecePrice}>
                          {formatPrice(p.price, p.currency ?? "LKR")}
                        </Text>
                      </View>
                      <View style={styles.pieceChevron}>
                        <Ionicons name="chevron-forward" size={14} color={C.text} />
                      </View>
                    </PressableScale>
                  ))}

                  {typeof outfit.total_price === "number" && outfit.total_price > 0 ? (
                    <View style={styles.totalStrip}>
                      <Text style={styles.totalLabel}>Full look</Text>
                      <Text style={styles.totalValue}>
                        {formatPrice(outfit.total_price, outfit.pieces[0]?.currency ?? "LKR")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </>
          )
        ) : null}
      </ScrollView>
    </AiPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  gapTop: { marginTop: 20 },

  cardShadow: {
    borderRadius: 26,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    overflow: "hidden",
  },
  listCard: { paddingVertical: 8 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  introRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  introTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.text, letterSpacing: -0.3 },
  introSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: C.muted,
    marginTop: 2,
  },
  groupLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: C.text,
    marginTop: 20,
    marginBottom: 10,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingHorizontal: 15,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink, paddingLeft: 8 },
  chipCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
  chipTextOn: { color: "#FFFFFF" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 60,
    marginTop: 22,
    paddingLeft: 8,
    paddingRight: 20,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: "#FFFFFF" },

  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.3,
    marginTop: 26,
    marginBottom: 12,
  },
  lookHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  lookTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text },
  lookSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 2 },
  countBadge: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: C.accentSoft,
    justifyContent: "center",
  },
  countText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: C.accent },
  pieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  pieceRowFirst: { borderTopWidth: 0 },
  pieceImg: { width: 64, height: 64, borderRadius: 14, backgroundColor: SOFT },
  pieceImgFallback: { alignItems: "center", justifyContent: "center" },
  pieceBody: { flex: 1, minWidth: 0, gap: 2 },
  slotTag: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted },
  pieceName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, lineHeight: 19, color: C.text },
  piecePrice: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text },
  pieceChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  totalStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    marginTop: 4,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: C.ink,
  },
  totalLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: "rgba(255,255,255,0.6)" },
  totalValue: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.lime },

  stateCard: { alignItems: "center", paddingVertical: 28, gap: 6 },
  stateTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text, marginTop: 8 },
  stateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  smallCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: C.ink,
    marginTop: 10,
  },
  smallCtaText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: "#FFFFFF" },
});
