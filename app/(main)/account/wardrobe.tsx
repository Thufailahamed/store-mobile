import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, spacing } from "@/lib/theme/tokens";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import {
  deleteWardrobeItem,
  getWardrobeHeader,
  getWardrobeStats,
  listWardrobeItems,
  listWardrobeOutfits,
  logWardrobeWear,
  revokeWardrobeShare,
  shareWardrobeHeader,
  syncWardrobe,
  updateWardrobeItem,
} from "@/lib/api/wardrobe";
import { getWardrobeCardWidth, WARDROBE_H_PAD, WardrobeItemCard } from "@/components/wardrobe/WardrobeItemCard";
import {
  WardrobeFilterBar,
  type WardrobeGarmentFilter,
  type WardrobeStatusFilter,
} from "@/components/wardrobe/WardrobeFilterBar";
import { WardrobeStatsBar } from "@/components/wardrobe/WardrobeStatsBar";
import { WardrobeEmptyState } from "@/components/wardrobe/WardrobeEmptyState";
import { LogWearSheet } from "@/components/wardrobe/LogWearSheet";
import { OutfitCard } from "@/components/wardrobe/OutfitCard";
import { InsightsSection } from "@/components/wardrobe/InsightsSection";
import { OutfitCalendar } from "@/components/wardrobe/OutfitCalendar";
import { AutoOutfitSheet } from "@/components/wardrobe/AutoOutfitSheet";
import type {
  GarmentType,
  WardrobeHeader,
  WardrobeItem,
  WardrobeOutfit,
  WardrobeStats,
} from "@/lib/types";

type Tab = "items" | "outfits" | "stats" | "planned";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "items", label: "Items", icon: "shirt-outline" },
  { key: "outfits", label: "Outfits", icon: "albums-outline" },
  { key: "stats", label: "Stats", icon: "bar-chart-outline" },
  { key: "planned", label: "Planned", icon: "calendar-outline" },
];

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("items");
  const [garment, setGarment] = useState<WardrobeGarmentFilter>("all");
  const [status, setStatus] = useState<WardrobeStatusFilter>("active");
  const [q, setQ] = useState("");
  const [wearItem, setWearItem] = useState<WardrobeItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [autoSheetOpen, setAutoSheetOpen] = useState(false);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<WardrobeOutfit[]>([]);
  const [stats, setStats] = useState<WardrobeStats | null>(null);
  const [header, setHeader] = useState<WardrobeHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [logPending, setLogPending] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setOutfits([]);
      setStats(null);
      setHeader(null);
      setLoading(false);
      return;
    }
    const params: Parameters<typeof listWardrobeItems>[0] = {
      status,
      garment_type: garment,
      q: q.trim() || undefined,
      limit: 200,
    };
    const [itemsRes, outfitsRes, statsRes, headerRes] = await Promise.all([
      listWardrobeItems(params),
      listWardrobeOutfits(),
      getWardrobeStats(),
      getWardrobeHeader(),
    ]);
    if (itemsRes.ok) setItems(itemsRes.data.items);
    if (outfitsRes.ok) setOutfits(outfitsRes.data.outfits);
    if (statsRes.ok) setStats(statsRes.data);
    if (headerRes.ok) setHeader(headerRes.data.wardrobe);
    setLoading(false);
  }, [user?.id, status, garment, q]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    const res = await syncWardrobe();
    setSyncing(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast(
      res.data.inserted > 0
        ? `Added ${res.data.inserted} item${res.data.inserted === 1 ? "" : "s"}`
        : "Already up to date",
      "success",
    );
    await load();
  }, [load, toast]);

  const handleLogWear = useCallback(async (wornAtIso: string) => {
    if (!wearItem) return;
    setLogPending(true);
    const res = await logWardrobeWear(wearItem.id, { worn_at: wornAtIso });
    setLogPending(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setWearItem(null);
    toast(
      `Worn × ${res.data.result.wear_count}`,
      "success",
    );
    await load();
  }, [wearItem, load, toast]);

  const handleArchive = useCallback(async (item: WardrobeItem) => {
    const next = item.status === "active" ? "archived" : "active";
    const res = await updateWardrobeItem(item.id, { status: next });
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    await load();
  }, [load, toast]);

  const handleDelete = useCallback(async (item: WardrobeItem) => {
    const res = await deleteWardrobeItem(item.id);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast("Item removed", "success");
    await load();
  }, [load, toast]);

  const handleShare = useCallback(async () => {
    const res = await shareWardrobeHeader();
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setHeader(res.data.wardrobe);
    const token = res.data.wardrobe.share_token;
    if (token) setShareLink(`/account/wardrobe/share/${token}`);
  }, [toast]);

  const handleRevoke = useCallback(async () => {
    const res = await revokeWardrobeShare();
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setHeader(res.data.wardrobe);
    setShareLink(null);
    toast("Share link revoked", "success");
  }, [toast]);

  const cardWidth = getWardrobeCardWidth(SCREEN_WIDTH);

  const countsByGarment = useMemo(() => {
    const map: Partial<Record<GarmentType, number>> = {};
    for (const it of items) {
      map[it.garment_type] = (map[it.garment_type] ?? 0) + 1;
    }
    return map;
  }, [items]);

  if (!user?.id) {
    return (
      <PaperBackground style={{ backgroundColor: "#ffffff" }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>Wardrobe</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.gateWrap}>
          <Ionicons name="lock-closed-outline" size={48} color="#556b2f" />
          <Text style={styles.gateTitle}>Sign in to see your wardrobe</Text>
          <Text style={styles.gateSub}>
            Track items, outfits, and cost-per-wear across every order.
          </Text>
          <TouchableOpacity
            style={styles.gateCta}
            onPress={() => router.push("/(auth)/login" as never)}
            activeOpacity={0.85}
          >
            <Text style={styles.gateCtaText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground style={{ backgroundColor: "#ffffff" }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBtn} />
        <Text style={styles.headerTitle}>Wardrobe</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <HeaderBtn icon="bag-add-outline" onPress={handleSync} busy={syncing} />
          <HeaderBtn
            icon={header?.is_public ? "share-social" : "share-outline"}
            onPress={handleShare}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#556b2f" />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>YOUR VIRTUAL WARDROBE</Text>
          <Text style={styles.heroTitle}>
            Things you <Text style={styles.heroItalic}>own</Text>.
          </Text>
          <Text style={styles.heroSub}>
            A living catalog of your closet — auto-synced from deliveries, curated by you.
          </Text>
          <View style={styles.heroStamps}>
            <Stamp label={`${items.length} pieces`} tone="primary" />
            {(stats?.totals.total_wears ?? 0) > 0 ? (
              <Stamp
                label={`${stats?.totals.total_wears} wears`}
                tone="rust"
              />
            ) : null}
          </View>
        </View>

        {/* Stats rail */}
        {items.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <WardrobeStatsBar stats={stats} />
          </View>
        ) : null}

        {/* Insights strip */}
        {items.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionLabel}>INSIGHTS</Text>
            <InsightsSection onLogWear={(it) => setWearItem(it)} />
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={t.icon}
                  size={14}
                  color={active ? "#fff" : "#16170f"}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab body */}
        {tab === "items" ? (
          <View style={{ marginTop: 14 }}>
            <WardrobeFilterBar
              garment={garment}
              status={status}
              q={q}
              onGarment={setGarment}
              onStatus={setStatus}
              onQ={setQ}
              counts={countsByGarment}
              totalCount={items.length}
            />

            {loading ? (
              <View style={{ padding: 32 }}>
                <Text style={styles.muted}>Loading wardrobe…</Text>
              </View>
            ) : items.length === 0 ? (
              <WardrobeEmptyState
                onSync={handleSync}
                onAdd={() => router.push("/(main)/account/wardrobe" as never)}
                syncing={syncing}
              />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(it) => it.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: WARDROBE_H_PAD, paddingHorizontal: WARDROBE_H_PAD }}
                contentContainerStyle={{ gap: 12, marginTop: 14 }}
                renderItem={({ item }) => (
                  <WardrobeItemCard
                    item={item}
                    cardWidth={cardWidth}
                    onLogWear={() => setWearItem(item)}
                    onArchive={() => handleArchive(item)}
                    onDelete={() => handleDelete(item)}
                  />
                )}
              />
            )}
          </View>
        ) : null}

        {tab === "outfits" ? (
          <View style={{ marginTop: 14 }}>
            <View style={styles.outfitsHead}>
              <Text style={styles.muted}>
                Compose outfits from your wardrobe by occasion or season.
              </Text>
            </View>
            <View style={styles.outfitsActions}>
              <TouchableOpacity
                style={styles.smallCta}
                onPress={() => setAutoSheetOpen(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={13} color="#fff" />
                <Text style={styles.smallCtaText}>Auto-generate</Text>
              </TouchableOpacity>
            </View>

            {outfits.length === 0 ? (
              <View style={styles.subtle}>
                <Ionicons name="albums-outline" size={32} color="#556b2f" />
                <Text style={[styles.muted, { marginTop: 8 }]}>No outfits yet.</Text>
              </View>
            ) : (
              outfits.map((o) => (
                <OutfitCard
                  key={o.id}
                  outfit={o}
                  onPress={() =>
                    router.push({ pathname: "/(main)/wardrobe/[id]", params: { id: o.id } } as never)
                  }
                />
              ))
            )}
          </View>
        ) : null}

        {tab === "stats" && stats ? (
          <View style={{ marginTop: 14, paddingHorizontal: WARDROBE_H_PAD, gap: 14 }}>
            <View style={styles.statCard}>
              <Text style={styles.statTitle}>By category</Text>
              {stats.byGarment.length === 0 ? (
                <Text style={styles.muted}>No items yet.</Text>
              ) : (
                stats.byGarment.map((g) => {
                  const max = Math.max(...stats.byGarment.map((x) => x.n), 1);
                  return (
                    <View key={g.garment_type} style={{ marginTop: 10 }}>
                      <View style={styles.statRow}>
                        <Text style={styles.statRowLabel}>
                          {g.garment_type.toUpperCase()}
                        </Text>
                        <Text style={styles.statRowVal}>
                          {g.n} · LKR {g.total_spent.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.statBar}>
                        <View
                          style={[
                            styles.statBarFill,
                            { width: `${(g.n / max) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statTitle}>Top worn</Text>
              {stats.topWorn.length === 0 ? (
                <Text style={styles.muted}>No wears logged yet.</Text>
              ) : (
                stats.topWorn.map((w) => (
                  <View key={w.id} style={styles.topWornRow}>
                    <View style={styles.topWornThumb}>
                      {w.image_url ? (
                        <Image
                          source={{ uri: w.image_url }}
                          style={styles.topWornImg}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="shirt-outline" size={18} color="#6b6b6b" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topWornName} numberOfLines={1}>{w.name}</Text>
                      <Text style={styles.topWornMeta}>{w.garment_type}</Text>
                    </View>
                    <Text style={styles.topWornCount}>{w.wear_count}×</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        {tab === "planned" ? (
          <View style={{ marginTop: 14, gap: 14 }}>
            <OutfitCalendar
              outfits={outfits}
              onSelectOutfit={(o) =>
                router.push({ pathname: "/(main)/wardrobe/[id]", params: { id: o.id } } as never)
              }
            />
            <View style={{ paddingHorizontal: WARDROBE_H_PAD }}>
              <Text style={styles.muted}>
                Scheduled outfits appear here. Tap a chip to open it.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Share link pill */}
        {shareLink ? (
          <View style={styles.sharePill}>
            <Ionicons name="link" size={14} color="#556b2f" />
            <Text style={styles.sharePillText} numberOfLines={1}>
              Share link created
            </Text>
            <TouchableOpacity onPress={() => setShareLink(null)} hitSlop={8}>
              <Ionicons name="close" size={14} color="#16170f" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Revoke (only when public) */}
        {header?.is_public ? (
          <View style={{ paddingHorizontal: WARDROBE_H_PAD, marginTop: 14 }}>
            <TouchableOpacity
              style={[styles.smallCta, styles.smallCtaGhost]}
              onPress={handleRevoke}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={14} color="#16170f" />
              <Text style={[styles.smallCtaText, styles.smallCtaTextGhost]}>
                Revoke public link
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: Math.max(insets.bottom, spacing[4]) }} />
      </ScrollView>

      <LogWearSheet
        item={wearItem}
        onClose={() => setWearItem(null)}
        onConfirm={handleLogWear}
        pending={logPending}
      />
      <AutoOutfitSheet
        visible={autoSheetOpen}
        onClose={() => setAutoSheetOpen(false)}
        items={items}
        onSaved={() => {
          setAutoSheetOpen(false);
          load();
        }}
      />
    </PaperBackground>
  );
}

function HeaderBtn({
  icon,
  onPress,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.headerBtn, busy && { opacity: 0.6 }]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={busy}
    >
      <Ionicons name={icon} size={18} color="#16170f" />
    </TouchableOpacity>
  );
}

function Stamp({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "rust";
}) {
  return (
    <View
      style={[
        styles.stamp,
        tone === "primary"
          ? styles.stampPrimary
          : styles.stampRust,
      ]}
    >
      <Text
        style={[
          styles.stampText,
          tone === "primary" ? styles.stampTextPrimary : styles.stampTextRust,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

import { Image } from "expo-image";

const OLIVE = "#556b2f";
const INK = "#16170f";
const MUTED = "#6b6b6b";
const PAPER = "#fbfaf3";
const BORDER = "rgba(22,23,15,0.10)";

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
  hero: {
    paddingHorizontal: WARDROBE_H_PAD,
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroLabel: {
    fontSize: 10,
    letterSpacing: 0.7,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    color: INK,
    marginTop: 6,
  },
  heroItalic: {
    fontStyle: "italic",
    color: OLIVE,
  },
  heroSub: {
    fontSize: 13,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 6,
    maxWidth: 320,
    lineHeight: 19,
  },
  heroStamps: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  stamp: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  stampPrimary: {
    backgroundColor: "rgba(85,107,47,0.12)",
  },
  stampRust: {
    backgroundColor: "rgba(168,49,31,0.12)",
  },
  stampText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
  stampTextPrimary: {
    color: OLIVE,
  },
  stampTextRust: {
    color: "#a8311f",
  },
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: WARDROBE_H_PAD,
    marginTop: 18,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  tabActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  tabText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
    color: INK,
  },
  tabTextActive: {
    color: "#fff",
  },
  muted: {
    fontSize: 13,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    lineHeight: 19,
  },
  outfitsHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: WARDROBE_H_PAD,
  },
  outfitsActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: WARDROBE_H_PAD,
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.7,
    paddingHorizontal: WARDROBE_H_PAD,
    marginBottom: 6,
  },
  smallCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: OLIVE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  smallCtaText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
  smallCtaGhost: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
  },
  smallCtaTextGhost: {
    color: INK,
  },
  subtle: {
    alignItems: "center",
    paddingVertical: 40,
  },
  statCard: {
    backgroundColor: PAPER,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  statTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    color: INK,
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  statRowLabel: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  statRowVal: {
    fontSize: 11,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
  },
  statBar: {
    height: 6,
    backgroundColor: "#f1efe6",
    borderRadius: 3,
    overflow: "hidden",
  },
  statBarFill: {
    height: "100%",
    backgroundColor: OLIVE,
    borderRadius: 3,
  },
  topWornRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  topWornThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f1efe6",
    alignItems: "center",
    justifyContent: "center",
  },
  topWornImg: {
    width: "100%",
    height: "100%",
  },
  topWornName: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
    fontWeight: "600",
  },
  topWornMeta: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  topWornCount: {
    fontSize: 14,
    fontFamily: fontFamilies.display.regular,
    fontWeight: "700",
    color: INK,
  },
  sharePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: WARDROBE_H_PAD,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(85,107,47,0.10)",
    borderRadius: radii.full,
  },
  sharePillText: {
    flex: 1,
    fontSize: 12,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
  },
  gateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
    paddingVertical: 60,
    gap: 8,
  },
  gateTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    color: INK,
    textAlign: "center",
    marginTop: 14,
  },
  gateSub: {
    fontSize: 13,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 19,
  },
  gateCta: {
    marginTop: 18,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: OLIVE,
    borderRadius: radii.full,
  },
  gateCtaText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
    fontSize: 13,
  },
});
