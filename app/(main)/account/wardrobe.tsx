import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, shadows, spacing } from "@/lib/theme/tokens";
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
import {
  getWardrobeCardWidth,
  WARDROBE_H_PAD,
  WardrobeItemCard,
} from "@/components/wardrobe/WardrobeItemCard";
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

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "items", label: "Pieces", icon: "shirt-outline" },
  { key: "outfits", label: "Outfits", icon: "albums-outline" },
  { key: "stats", label: "Analytics", icon: "bar-chart-outline" },
  { key: "planned", label: "Lookbook", icon: "calendar-outline" },
];

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
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
        : "Wardrobe is up to date",
      "success"
    );
    await load();
  }, [load, toast]);

  const handleLogWear = useCallback(
    async (wornAtIso: string) => {
      if (!wearItem) return;
      setLogPending(true);
      const res = await logWardrobeWear(wearItem.id, { worn_at: wornAtIso });
      setLogPending(false);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setWearItem(null);
      toast(`Wear logged × ${res.data.result.wear_count}`, "success");
      await load();
    },
    [wearItem, load, toast]
  );

  const handleArchive = useCallback(
    async (item: WardrobeItem) => {
      const next = item.status === "active" ? "archived" : "active";
      const res = await updateWardrobeItem(item.id, { status: next });
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      await load();
    },
    [load, toast]
  );

  const handleDelete = useCallback(
    async (item: WardrobeItem) => {
      const res = await deleteWardrobeItem(item.id);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      toast("Item removed from closet", "success");
      await load();
    },
    [load, toast]
  );

  const handleShare = useCallback(async () => {
    const res = await shareWardrobeHeader();
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setHeader(res.data.wardrobe);
    const token = res.data.wardrobe.share_token;
    if (token) setShareLink(`/account/wardrobe/share/${token}`);
    toast("Public link ready", "success");
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
      <PaperBackground>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color="#181b12" />
          </TouchableOpacity>
          <View style={styles.navTitleWrap}>
            <Text style={styles.headerTitle}>DIGITAL WARDROBE</Text>
            <Text style={styles.headerSubtitle}>CAPSULE ARCHIVE</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.gateWrap}>
          <View style={styles.gateMedallion}>
            <Ionicons name="lock-closed-outline" size={32} color="#C8A44A" />
          </View>
          <Text style={styles.gateTitle}>Sign in to Access Wardrobe</Text>
          <Text style={styles.gateSub}>
            Track closet pieces, log cost-per-wear, and assemble bespoke looks across all your acquisitions.
          </Text>
          <TouchableOpacity
            style={styles.gateCta}
            onPress={() => router.push("/(auth)/login" as never)}
            activeOpacity={0.88}
          >
            <Text style={styles.gateCtaText}>SIGN IN</Text>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      {/* Atelier Navigation Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color="#181b12" />
        </TouchableOpacity>

        <View style={styles.navTitleWrap}>
          <Text style={styles.headerTitle}>DIGITAL WARDROBE</Text>
          <Text style={styles.headerSubtitle}>CAPSULE ARCHIVE</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.7}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#C8A44A" />
            ) : (
              <Ionicons name="sync-outline" size={18} color="#181b12" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons
              name={header?.is_public ? "share-social" : "share-outline"}
              size={18}
              color={header?.is_public ? "#85651b" : "#181b12"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C8A44A"
          />
        }
      >
        {/* 1. Haute Couture Obsidian Wardrobe Hero Card */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={["#1c2016", "#14170e", "#0e110a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroEyebrowRow}>
              <View style={styles.heroTagBadge}>
                <Ionicons name="sparkles" size={11} color="#C8A44A" />
                <Text style={styles.heroTagText}>CAPSULE ATELIER</Text>
              </View>
              <View style={styles.heroLiveBadge}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroLiveText}>DELIVERY SYNC ACTIVE</Text>
              </View>
            </View>

            <Text style={styles.heroMainTitle}>
              Things You <Text style={styles.heroGoldText}>Own.</Text>
            </Text>
            <Text style={styles.heroSubText}>
              A living digital catalog of your closet — auto-synced from verified deliveries, ready for bespoke look curation and cost-per-wear analytics.
            </Text>

            <View style={styles.heroStatsRibbon}>
              <View style={styles.heroStatCell}>
                <Text style={styles.heroStatValue}>{items.length}</Text>
                <Text style={styles.heroStatLabel}>Curated Pieces</Text>
              </View>
              <View style={styles.heroStatSep} />
              <View style={styles.heroStatCell}>
                <Text style={styles.heroStatValue}>{outfits.length}</Text>
                <Text style={styles.heroStatLabel}>Bespoke Outfits</Text>
              </View>
              <View style={styles.heroStatSep} />
              <View style={styles.heroStatCell}>
                <Text style={styles.heroStatValue}>
                  {stats?.totals.total_wears ?? 0}
                </Text>
                <Text style={styles.heroStatLabel}>Wears Logged</Text>
              </View>
              <View style={styles.heroStatSep} />
              <TouchableOpacity
                style={styles.heroSyncQuickBtn}
                activeOpacity={0.8}
                onPress={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#E8CF8F" />
                ) : (
                  <>
                    <Ionicons name="sync" size={12} color="#E8CF8F" />
                    <Text style={styles.heroSyncQuickText}>Sync</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* 2. Stats Rail (when items exist) */}
        {items.length > 0 && (
          <View style={{ marginTop: 6, paddingHorizontal: WARDROBE_H_PAD }}>
            <WardrobeStatsBar stats={stats} />
          </View>
        )}

        {/* 3. Insights Strip (when items exist) */}
        {items.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionEyebrow}>WARDROBE INTELLIGENCE</Text>
            <InsightsSection onLogWear={(it) => setWearItem(it)} />
          </View>
        )}

        {/* 4. Segmented Mode Tabs Ribbon */}
        <View style={styles.tabsContainer}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={t.icon}
                  size={14}
                  color={active ? "#E8CF8F" : "#181b12"}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    active && styles.tabButtonTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. Tab Body */}
        {tab === "items" && (
          <View style={{ marginTop: 12 }}>
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
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#C8A44A" />
                <Text style={styles.loadingBoxText}>Cataloging your pieces…</Text>
              </View>
            ) : items.length === 0 ? (
              <WardrobeEmptyState
                onSync={handleSync}
                syncing={syncing}
                onExplore={() => router.push("/(main)/account/orders" as any)}
              />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(it) => it.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={{
                  gap: WARDROBE_H_PAD,
                  paddingHorizontal: WARDROBE_H_PAD,
                }}
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
        )}

        {tab === "outfits" && (
          <View style={{ marginTop: 14, paddingHorizontal: WARDROBE_H_PAD }}>
            <View style={styles.outfitsHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>RUNWAY CURATION</Text>
                <Text style={styles.outfitsTitle}>Bespoke Outfits</Text>
              </View>
              <TouchableOpacity
                style={styles.autoGenerateBtn}
                onPress={() => setAutoSheetOpen(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={13} color="#ffffff" />
                <Text style={styles.autoGenerateBtnText}>AI Outfit Suggestion</Text>
              </TouchableOpacity>
            </View>

            {outfits.length === 0 ? (
              <View style={styles.emptyOutfitsBox}>
                <View style={styles.emptyOutfitsMedallion}>
                  <Ionicons name="albums-outline" size={28} color="#C8A44A" />
                </View>
                <Text style={styles.emptyOutfitsTitle}>No Outfits Composed</Text>
                <Text style={styles.emptyOutfitsSub}>
                  Pair your tops, bottoms, and footwear into complete runway lookbooks for any season.
                </Text>
                <TouchableOpacity
                  style={styles.createOutfitBtn}
                  onPress={() => setAutoSheetOpen(true)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.createOutfitBtnText}>Generate Outfit</Text>
                  <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 12, marginTop: 10 }}>
                {outfits.map((o) => (
                  <OutfitCard
                    key={o.id}
                    outfit={o}
                    items={items}
                    onPress={() =>
                      router.push({
                        pathname: "/(main)/wardrobe/[id]",
                        params: { id: o.id },
                      } as never)
                    }
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {tab === "stats" && stats && (
          <View style={{ marginTop: 14, paddingHorizontal: WARDROBE_H_PAD, gap: 14 }}>
            <View style={styles.statPanel}>
              <Text style={styles.statPanelTitle}>Breakdown by Category</Text>
              {stats.byGarment.length === 0 ? (
                <Text style={styles.emptyStatText}>No items cataloged yet.</Text>
              ) : (
                stats.byGarment.map((g) => {
                  const max = Math.max(...stats.byGarment.map((x) => x.n), 1);
                  return (
                    <View key={g.garment_type} style={{ marginTop: 10 }}>
                      <View style={styles.statLineHeader}>
                        <Text style={styles.statLineLabel}>
                          {g.garment_type.toUpperCase()}
                        </Text>
                        <Text style={styles.statLineValue}>
                          {g.n} pieces · LKR {g.total_spent.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.statProgressTrack}>
                        <View
                          style={[
                            styles.statProgressFill,
                            { width: `${(g.n / max) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.statPanel}>
              <Text style={styles.statPanelTitle}>Most Worn Staples</Text>
              {stats.topWorn.length === 0 ? (
                <Text style={styles.emptyStatText}>No wears logged yet.</Text>
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
                        <Ionicons name="shirt-outline" size={18} color="#C8A44A" />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.topWornName} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <Text style={styles.topWornMeta}>
                        {w.garment_type.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.topWornCount}>{w.wear_count} wears</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {tab === "planned" && (
          <View style={{ marginTop: 14, gap: 14 }}>
            <OutfitCalendar
              outfits={outfits}
              onSelectOutfit={(o) =>
                router.push({
                  pathname: "/(main)/wardrobe/[id]",
                  params: { id: o.id },
                } as never)
              }
            />
            <View style={{ paddingHorizontal: WARDROBE_H_PAD }}>
              <Text style={styles.lookbookSubText}>
                Plan your looks ahead. Tap any scheduled day to preview or swap pieces.
              </Text>
            </View>
          </View>
        )}

        {/* Share link pill */}
        {shareLink && (
          <View style={styles.sharePill}>
            <Ionicons name="link" size={14} color="#85651b" />
            <Text style={styles.sharePillText} numberOfLines={1}>
              Public collection link active
            </Text>
            <TouchableOpacity onPress={() => setShareLink(null)} hitSlop={8}>
              <Ionicons name="close" size={14} color="#181b12" />
            </TouchableOpacity>
          </View>
        )}

        {/* Revoke public link */}
        {header?.is_public && (
          <View style={{ paddingHorizontal: WARDROBE_H_PAD, marginTop: 14 }}>
            <TouchableOpacity
              style={styles.revokeBtn}
              onPress={handleRevoke}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
              <Text style={styles.revokeBtnText}>Revoke public link</Text>
            </TouchableOpacity>
          </View>
        )}

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

/* =========================================================================
   Styles
   ========================================================================= */
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  navTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    letterSpacing: 2,
    color: "#181b12",
    textTransform: "uppercase",
  },
  headerSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#85651b",
    marginTop: 1,
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },

  /* Gate Wrap */
  gateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: 12,
  },
  gateMedallion: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    marginBottom: 4,
  },
  gateTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#181b12",
    textAlign: "center",
  },
  gateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#6b6b6b",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 290,
  },
  gateCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#181b12",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radii.full,
    marginTop: 8,
    ...shadows.soft,
  },
  gateCtaText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1.2,
  },

  /* 1. Hero Card */
  heroSection: {
    paddingHorizontal: WARDROBE_H_PAD,
    paddingTop: 12,
  },
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    ...shadows.editorial,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  heroLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  heroLiveText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: 0.8,
  },
  heroMainTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  heroGoldText: {
    color: "#E8CF8F",
    fontStyle: "italic",
  },
  heroSubText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.72)",
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  heroStatsRibbon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  heroStatCell: {
    flex: 1,
  },
  heroStatValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: "#E8CF8F",
  },
  heroStatLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: "rgba(255, 255, 255, 0.55)",
    marginTop: 1,
  },
  heroStatSep: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 6,
  },
  heroSyncQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
  },
  heroSyncQuickText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#E8CF8F",
    letterSpacing: 0.5,
  },

  /* Section Eyebrow */
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
    paddingHorizontal: WARDROBE_H_PAD,
    marginBottom: 6,
  },

  /* Tabs Ribbon */
  tabsContainer: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: WARDROBE_H_PAD,
    marginTop: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    backgroundColor: "#ffffff",
    ...shadows.soft,
  },
  tabButtonActive: {
    backgroundColor: "#181b12",
    borderColor: "#181b12",
  },
  tabButtonText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.medium,
    color: "#181b12",
  },
  tabButtonTextActive: {
    color: "#ffffff",
    fontFamily: fontFamilies.sans.semibold,
  },

  /* Loading Box */
  loadingBox: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  loadingBoxText: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 13,
    color: "#6b6b6b",
    fontStyle: "italic",
  },

  /* Outfits Tab */
  outfitsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  outfitsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: "#181b12",
  },
  autoGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#181b12",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    ...shadows.soft,
  },
  autoGenerateBtnText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 0.5,
  },
  emptyOutfitsBox: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[7],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
    marginTop: 8,
    gap: 8,
  },
  emptyOutfitsMedallion: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  emptyOutfitsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: "#181b12",
    marginTop: 4,
  },
  emptyOutfitsSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "#6b6b6b",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 270,
  },
  createOutfitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#181b12",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    marginTop: 6,
  },
  createOutfitBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#ffffff",
    letterSpacing: 0.8,
  },

  /* Stats Tab */
  statPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  statPanelTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: "#181b12",
    marginBottom: 6,
  },
  emptyStatText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "#6b6b6b",
  },
  statLineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statLineLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: "#85651b",
    letterSpacing: 0.6,
  },
  statLineValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#181b12",
  },
  statProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(22, 23, 15, 0.06)",
    overflow: "hidden",
  },
  statProgressFill: {
    height: "100%",
    backgroundColor: "#C8A44A",
    borderRadius: 2,
  },
  topWornRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.05)",
  },
  topWornThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(22, 23, 15, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  topWornImg: {
    width: "100%",
    height: "100%",
  },
  topWornName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: "#181b12",
  },
  topWornMeta: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 0.5,
  },
  topWornCount: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#181b12",
  },

  /* Lookbook Tab */
  lookbookSubText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "#6b6b6b",
    textAlign: "center",
    lineHeight: 17,
  },

  /* Share Pill */
  sharePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 14,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  sharePillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    color: "#85651b",
  },

  /* Revoke Button */
  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  revokeBtnText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: "#dc2626",
  },
});
