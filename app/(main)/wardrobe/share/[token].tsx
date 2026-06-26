import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, spacing } from "@/lib/theme/tokens";
import { getPublicWardrobe } from "@/lib/api/wardrobe";
import type {
  PublicOutfitPayload,
  PublicWardrobePayload,
} from "@/lib/types";

const OLIVE = "#556b2f";
const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "rgba(22,23,15,0.10)";

type Payload = PublicWardrobePayload | PublicOutfitPayload;

export default function SharedWardrobeScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await getPublicWardrobe(token);
    if (!res.ok) {
      setError(res.error);
      setPayload(null);
    } else {
      setError(null);
      setPayload(res.data);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <PaperBackground style={{ backgroundColor: "#ffffff" }}>
        <HeaderBar title="Shared" onBack={() => router.back()} topInset={insets.top} />
        <View style={styles.center}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </PaperBackground>
    );
  }

  if (error || !payload) {
    return (
      <PaperBackground style={{ backgroundColor: "#ffffff" }}>
        <HeaderBar title="Not found" onBack={() => router.back()} topInset={insets.top} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={MUTED} />
          <Text style={styles.title}>Link unavailable</Text>
          <Text style={styles.muted}>
            {error ?? "This shared wardrobe link is no longer active."}
          </Text>
        </View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground style={{ backgroundColor: "#ffffff" }}>
      <HeaderBar
        title={payload.type === "outfit" ? "Shared outfit" : "Shared wardrobe"}
        onBack={() => router.back()}
        topInset={insets.top}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <View style={styles.hero}>
          <View style={styles.pill}>
            <Ionicons name="sparkles-outline" size={12} color={OLIVE} />
            <Text style={styles.pillText}>LUXE · Public share</Text>
          </View>
          <Text style={styles.title}>
            {payload.type === "outfit" ? payload.outfit.name : payload.wardrobe.name}
          </Text>
          {payload.type === "outfit" ? (
            <Text style={styles.sub}>
              {payload.outfit.occasion ?? "Outfit"}
              {payload.outfit.season ? ` · ${payload.outfit.season}` : ""}
            </Text>
          ) : (
            <Text style={styles.sub}>
              {payload.items.length} {payload.items.length === 1 ? "piece" : "pieces"}
              {payload.outfits.length > 0
                ? ` · ${payload.outfits.length} ${payload.outfits.length === 1 ? "outfit" : "outfits"}`
                : ""}
            </Text>
          )}
        </View>

        {payload.type === "outfit" ? (
          <View style={styles.grid}>
            {payload.items.map((link) => (
              <PublicItemCard
                key={link.id}
                name={link.item?.name ?? "Item"}
                imageUrl={link.item?.image_url ?? null}
                garment={link.item?.garment_type ?? "other"}
                wearCount={link.item?.wear_count ?? 0}
                slot={link.slot ?? undefined}
              />
            ))}
          </View>
        ) : (
          <>
            {payload.outfits.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Outfits</Text>
                <View style={{ gap: 8, marginTop: 8 }}>
                  {payload.outfits.map((o) => (
                    <View key={o.id} style={styles.outfitRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.outfitName}>{o.name}</Text>
                        <Text style={styles.outfitMeta}>
                          {o.occasion ?? ""}
                          {o.season ? ` · ${o.season}` : ""}
                        </Text>
                      </View>
                      {o.item ? (
                        <Text style={styles.outfitWear}>{o.item.wear_count}×</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All items</Text>
              <View style={[styles.grid, { marginTop: 8 }]}>
                {payload.items.map((it) => (
                  <PublicItemCard
                    key={it.id}
                    name={it.name}
                    imageUrl={it.image_url}
                    garment={it.garment_type}
                    wearCount={it.wear_count}
                    color={it.color}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

function HeaderBar({
  title,
  onBack,
  topInset,
}: {
  title: string;
  onBack: () => void;
  topInset: number;
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 8 }]}>
      <TouchableOpacity
        style={styles.headerBack}
        onPress={onBack}
        activeOpacity={0.85}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={20} color={INK} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerBack} />
    </View>
  );
}

function PublicItemCard({
  name,
  imageUrl,
  garment,
  wearCount,
  color,
  slot,
}: {
  name: string;
  imageUrl: string | null;
  garment: string;
  wearCount: number;
  color?: string | null;
  slot?: string;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemImgWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.itemImg} contentFit="cover" />
        ) : (
          <View style={styles.itemImgPlaceholder}>
            <Ionicons name="shirt-outline" size={20} color={MUTED} />
          </View>
        )}
      </View>
      <View style={{ padding: 8 }}>
        <View style={styles.itemHeadRow}>
          <Text style={styles.itemGarment}>{garment.toUpperCase()}</Text>
          {color ? <Text style={styles.itemColor}>{color}</Text> : null}
        </View>
        <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
        <Text style={styles.itemMeta}>
          {wearCount > 0 ? `${wearCount}× worn` : "Never logged"}
          {slot ? ` · ${slot}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    fontWeight: "600",
    color: INK,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[5],
    gap: 6,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(85,107,47,0.12)",
    borderRadius: radii.full,
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 11,
    color: OLIVE,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 28,
    color: INK,
    marginTop: 4,
  },
  sub: {
    fontSize: 13,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: INK,
    fontWeight: "600",
  },
  outfitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
  },
  outfitName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: INK,
    fontWeight: "600",
  },
  outfitMeta: {
    fontSize: 11,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 2,
  },
  outfitWear: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 14,
    color: INK,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
  },
  itemCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  itemImgWrap: {
    aspectRatio: 0.85,
    backgroundColor: "#f1efe6",
  },
  itemImg: {
    width: "100%",
    height: "100%",
  },
  itemImgPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  itemHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemGarment: {
    fontSize: 9,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.4,
    fontWeight: "700",
  },
  itemColor: {
    fontSize: 9,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
  },
  itemName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: INK,
    fontWeight: "600",
    marginTop: 2,
  },
  itemMeta: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 2,
  },
  muted: {
    fontSize: 13,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    textAlign: "center",
    marginTop: 6,
  },
});
