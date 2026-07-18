import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, spacing } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui";
import {
  deleteWardrobeItem,
  listWardrobeItems,
  logWardrobeWear,
  updateWardrobeItem,
} from "@/lib/api/wardrobe";
import { LogWearSheet } from "@/components/wardrobe/LogWearSheet";
import type { WardrobeItem } from "@/lib/types";

const OLIVE = "#556b2f";
const INK = "#16170f";
const MUTED = "#6b6b6b";
const PAPER = "#fbfaf3";
const BORDER = "rgba(22,23,15,0.10)";

export default function WardrobeItemDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useToast();

  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [wearOpen, setWearOpen] = useState(false);
  const [logPending, setLogPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    // The id might be a wardrobe item id or an outfit id. Try items first
    // (cheaper — server filters via list), then outfits below if 404.
    const res = await listWardrobeItems({ limit: 500 });
    if (res.ok) {
      const found = res.data.items.find((it) => it.id === id);
      if (found) {
        setItem(found);
        setLoading(false);
        return;
      }
    }
    setItem(null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleLogWear = useCallback(async (wornAtIso: string) => {
    if (!item) return;
    setLogPending(true);
    const res = await logWardrobeWear(item.id, { worn_at: wornAtIso });
    setLogPending(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setWearOpen(false);
    toast(`Worn × ${res.data.result.wear_count}`, "success");
    await load();
  }, [item, load, toast]);

  const handleArchiveToggle = useCallback(async () => {
    if (!item) return;
    const next = item.status === "active" ? "archived" : "active";
    const res = await updateWardrobeItem(item.id, { status: next });
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    await load();
    toast(next === "archived" ? "Archived" : "Restored", "success");
  }, [item, load, toast]);

  const handleDelete = useCallback(() => {
    if (!item) return;
    Alert.alert(
      "Delete this item?",
      "This will remove it from your wardrobe. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await deleteWardrobeItem(item.id);
            if (!res.ok) {
              toast(res.error, "error");
              return;
            }
            toast("Item deleted", "success");
            router.back();
          },
        },
      ],
    );
  }, [item, router, toast]);

  return (
    <PaperBackground style={{ backgroundColor: "#ffffff" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item?.name ?? "Wardrobe"}
        </Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleDelete}
          activeOpacity={0.85}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={INK} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OLIVE} />
        }
      >
        {loading ? (
          <Text style={[styles.muted, { padding: 32, textAlign: "center" }]}>
            Loading…
          </Text>
        ) : !item ? (
          <View style={styles.notFound}>
            <Ionicons name="alert-circle-outline" size={36} color={MUTED} />
            <Text style={styles.notFoundTitle}>Item not found</Text>
            <Text style={styles.muted}>
              It may have been deleted or moved to another wardrobe.
            </Text>
          </View>
        ) : (
          <View>
            <View style={styles.heroImg}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.heroImgEl}
                  contentFit="cover"
                  transition={250}
                />
              ) : (
                <View style={styles.heroImgPlaceholder}>
                  <Ionicons name="shirt-outline" size={48} color={MUTED} />
                </View>
              )}
              <View style={styles.garmentBadge}>
                <Text style={styles.garmentBadgeText}>
                  {item.garment_type.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
              {item.brand_name ? (
                <Text style={styles.brand}>{item.brand_name.toUpperCase()}</Text>
              ) : null}
              <Text style={styles.title}>{item.name}</Text>

              {item.purchase_price != null ? (
                <Text style={styles.price}>
                  {formatPrice(item.purchase_price, item.currency)}
                </Text>
              ) : null}

              <View style={styles.stampsRow}>
                <Stamp label={item.status.toUpperCase()} />
                {item.size ? <Stamp label={`Size ${item.size}`} /> : null}
                {item.color ? <Stamp label={item.color} /> : null}
                {item.source === "manual" ? <Stamp label="MANUAL" /> : null}
              </View>

              {item.tags && item.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {item.tags.map((t) => (
                    <View key={t} style={styles.tagPill}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Wear summary */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Wear activity</Text>
                <View style={styles.cpwRow}>
                  <View style={styles.cpwCard}>
                    <Text style={styles.cpwLabel}>WORN</Text>
                    <Text style={styles.cpwValue}>{item.wear_count}×</Text>
                  </View>
                  <View style={styles.cpwCard}>
                    <Text style={styles.cpwLabel}>COST / WEAR</Text>
                    <Text style={styles.cpwValue}>
                      {item.purchase_price && item.wear_count > 0
                        ? formatPrice(item.purchase_price / item.wear_count, item.currency)
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.cpwCard}>
                    <Text style={styles.cpwLabel}>LAST</Text>
                    <Text style={styles.cpwValue}>
                      {item.last_worn_at ? new Date(item.last_worn_at).toLocaleDateString() : "Never"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.cta}
                  onPress={() => setWearOpen(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.ctaText}>Log a wear</Text>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              {item.notes ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Notes</Text>
                  <Text style={styles.notes}>{item.notes}</Text>
                </View>
              ) : null}

              {/* Meta */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Details</Text>
                <MetaRow k="Garment" v={item.garment_type} />
                {item.purchased_at ? (
                  <MetaRow
                    k="Purchased"
                    v={new Date(item.purchased_at).toLocaleDateString()}
                  />
                ) : null}
                <MetaRow k="Source" v={item.source} />
                {item.season ? <MetaRow k="Season" v={item.season} /> : null}
                {item.occasion ? <MetaRow k="Occasion" v={item.occasion} /> : null}
              </View>

              <TouchableOpacity
                style={[styles.ghostBtn]}
                onPress={handleArchiveToggle}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={item.status === "active" ? "archive-outline" : "refresh-outline"}
                  size={14}
                  color={INK}
                />
                <Text style={styles.ghostBtnText}>
                  {item.status === "active" ? "Archive item" : "Restore to active"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: Math.max(insets.bottom, spacing[4]) }} />
      </ScrollView>

      <LogWearSheet
        item={wearOpen ? item : null}
        onClose={() => setWearOpen(false)}
        onConfirm={handleLogWear}
        pending={logPending}
      />
    </PaperBackground>
  );
}

function Stamp({ label }: { label: string }) {
  return (
    <View style={styles.stamp}>
      <Text style={styles.stampText}>{label}</Text>
    </View>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaK}>{k}</Text>
      <Text style={styles.metaV}>{v}</Text>
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
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    fontWeight: "600",
    color: INK,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImg: {
    aspectRatio: 1,
    backgroundColor: "#f1efe6",
    position: "relative",
  },
  heroImgEl: {
    width: "100%",
    height: "100%",
  },
  heroImgPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  garmentBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  garmentBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  brand: {
    fontSize: 10,
    letterSpacing: 0.7,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    color: INK,
    marginTop: 4,
  },
  price: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: INK,
    marginTop: 6,
    fontWeight: "600",
  },
  stampsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  stamp: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(85,107,47,0.10)",
  },
  stampText: {
    color: OLIVE,
    fontSize: 10,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fff",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tagText: {
    fontSize: 11,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
  },
  card: {
    marginTop: 16,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: PAPER,
    gap: 8,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 15,
    color: INK,
    fontWeight: "600",
  },
  cpwRow: {
    flexDirection: "row",
    gap: 8,
  },
  cpwCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: BORDER,
  },
  cpwLabel: {
    fontSize: 9,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.4,
    fontWeight: "700",
  },
  cpwValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    color: INK,
    fontWeight: "600",
    marginTop: 2,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: OLIVE,
    borderRadius: radii.md,
    marginTop: 6,
  },
  ctaText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    fontSize: 13,
  },
  ghostBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
  },
  ghostBtnText: {
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  metaK: {
    fontSize: 11,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  metaV: {
    fontSize: 12,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
  },
  notes: {
    fontSize: 13,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    lineHeight: 19,
  },
  muted: {
    fontSize: 13,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
  },
  notFound: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 4,
  },
  notFoundTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 20,
    color: INK,
    marginTop: 8,
  },
});
