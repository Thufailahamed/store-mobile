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
import { Ionicons } from "@/components/ui/Icon";
import { LUX } from "@/components/orders/luxe-order";
import { C } from "@/components/orders/parcel-track";
import { PaperBackground } from "@/components/layout";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";
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
import { formatPrice } from "@/lib/utils";
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
import { UserPageFrame, withUserTheme } from "@/components/user/user-page";

type Tab = "items" | "outfits" | "stats" | "planned";

const TABS: {
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "items", label: "Pieces", icon: "shirt-outline" },
  { key: "outfits", label: "Outfits", icon: "albums-outline" },
  { key: "stats", label: "Insights", icon: "bar-chart-outline" },
  { key: "planned", label: "Plan", icon: "calendar-outline" },
];

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

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
      "success",
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
    [wearItem, load, toast],
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
    [load, toast],
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
    [load, toast],
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

  const filtersActive =
    garment !== "all" || status !== "active" || q.trim().length > 0;
  const heroStats = [
    { label: "Pieces", value: stats?.totals.total_items ?? items.length },
    { label: "Outfits", value: outfits.length },
    { label: "Wears", value: stats?.totals.total_wears ?? 0 },
  ];
  const totalSpent = stats?.totals.total_spent ?? 0;
  const avgCpw = stats?.totals.avg_cost_per_wear;

  if (!user?.id) {
    return (
      <UserPageFrame title="Wardrobe">
        <View style={styles.gateWrap}>
          <View style={styles.gateMedallion}>
            <Ionicons
              name="lock-closed-outline"
              size={26}
              color={colors.olive[700]}
            />
          </View>
          <Text style={styles.gateTitle}>Sign in to see your wardrobe</Text>
          <Text style={styles.gateSub}>
            Track closet pieces, log cost-per-wear, and assemble looks across
            everything you own.
          </Text>
          <TouchableOpacity
            style={styles.gateCta}
            onPress={() => router.push("/(auth)/login" as never)}
            activeOpacity={0.88}
          >
            <Text style={styles.gateCtaText}>Sign in</Text>
            <View style={styles.ctaArrow}>
              <Ionicons
                name="arrow-forward"
                size={14}
                color={colors.olive[900]}
              />
            </View>
          </TouchableOpacity>
        </View>
      </UserPageFrame>
    );
  }

  return (
    <UserPageFrame
      title="Wardrobe"
      right={
        <>
          <TouchableOpacity
            style={[
              styles.headerBtn,
              header?.is_public && styles.headerBtnActive,
            ]}
            onPress={handleShare}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Share wardrobe"
          >
            <Ionicons
              name={header?.is_public ? "share-social" : "share-outline"}
              size={18}
              color={header?.is_public ? GOLD_DEEP : colors.light.foreground}
            />
          </TouchableOpacity>
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
          />
        }
      >
        {/* Summary card */}
        <View style={styles.heroSection}>
          <View style={styles.sumShadow}>
            <View style={styles.sumCard}>
              <View style={styles.sumTop}>
                <View style={styles.sumIcon}>
                  <Ionicons name="shirt" size={22} color={C.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sumLabel}>Closet value</Text>
                  <Text
                    style={styles.sumValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatPrice(totalSpent)}
                  </Text>
                </View>
                <View style={styles.cpwPill}>
                  <Text style={styles.cpwPillLabel}>Per wear</Text>
                  <Text style={styles.cpwPillValue} numberOfLines={1}>
                    {typeof avgCpw === "number" ? formatPrice(avgCpw) : "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.sumStrip}>
                {heroStats.map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 ? <View style={styles.sumDivider} /> : null}
                    <View
                      style={styles.sumStat}
                      accessible
                      accessibilityLabel={`${s.value} ${s.label}`}
                    >
                      <Text style={styles.sumStatValue}>{s.value}</Text>
                      <Text style={styles.sumStatLabel}>{s.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              <View style={styles.sumFoot}>
                <View style={styles.liveDot} />
                <Text style={styles.sumFootLabel} numberOfLines={2}>
                  Auto-synced from your delivered orders
                </Text>
                <TouchableOpacity
                  style={styles.sumSyncBtn}
                  activeOpacity={0.85}
                  onPress={handleSync}
                  disabled={syncing}
                  accessibilityRole="button"
                  accessibilityLabel="Sync delivered orders"
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color={C.lime} />
                  ) : (
                    <>
                      <Ionicons name="sync" size={14} color={C.lime} />
                      <Text style={styles.sumSyncText}>Sync</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Insights Strip (when items exist) */}
        {items.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Closet insights</Text>
            </View>
            <InsightsSection onLogWear={(it) => setWearItem(it)} />
          </View>
        )}

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsRow}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const count =
              t.key === "items"
                ? stats?.totals.total_items ?? items.length
                : t.key === "outfits"
                  ? outfits.length
                  : null;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={t.icon}
                  size={16}
                  color={active ? LUX.lime : C.muted}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    active && styles.tabButtonTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
                {count !== null ? (
                  <View style={[styles.tabCount, active && styles.tabCountOn]}>
                    <Text
                      style={[
                        styles.tabCountText,
                        active && styles.tabCountTextOn,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. Tab Body */}
        {tab === "items" && (
          <View style={{ marginTop: 16 }}>
            {(items.length > 0 || filtersActive) && (
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
            )}

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={GOLD} />
                <Text style={styles.loadingBoxText}>
                  Cataloguing your pieces…
                </Text>
              </View>
            ) : items.length === 0 && filtersActive ? (
              <View
                style={[
                  styles.emptyOutfitsBox,
                  { marginHorizontal: WARDROBE_H_PAD, marginTop: 14 },
                ]}
              >
                <View style={styles.emptyOutfitsMedallion}>
                  <Ionicons
                    name="search-outline"
                    size={22}
                    color={colors.olive[700]}
                  />
                </View>
                <Text style={styles.emptyOutfitsTitle}>No matching pieces</Text>
                <Text style={styles.emptyOutfitsSub}>
                  Try a different category, status or search term.
                </Text>
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setGarment("all");
                    setStatus("active");
                    setQ("");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearBtnText}>Clear filters</Text>
                </TouchableOpacity>
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
                <Text style={[styles.sectionEyebrow, { paddingHorizontal: 0 }]}>
                  Curation
                </Text>
                <Text style={styles.outfitsTitle}>Outfits</Text>
              </View>
              <TouchableOpacity
                style={styles.autoGenerateBtn}
                onPress={() => setAutoSheetOpen(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={13} color={LUX.lime} />
                <Text style={styles.autoGenerateBtnText}>Suggest outfit</Text>
              </TouchableOpacity>
            </View>

            {outfits.length === 0 ? (
              <View style={styles.emptyOutfitsBox}>
                <View style={styles.emptyOutfitsMedallion}>
                  <Ionicons
                    name="albums-outline"
                    size={24}
                    color={colors.olive[700]}
                  />
                </View>
                <Text style={styles.emptyOutfitsTitle}>No outfits yet</Text>
                <Text style={styles.emptyOutfitsSub}>
                  Pair your tops, bottoms, and footwear into complete looks for
                  any season.
                </Text>
                <TouchableOpacity
                  style={styles.createOutfitBtn}
                  onPress={() => setAutoSheetOpen(true)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.createOutfitBtnText}>
                    Generate outfit
                  </Text>
                  <View style={styles.ctaArrow}>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.olive[900]}
                    />
                  </View>
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
          <View
            style={{
              marginTop: 16,
              paddingHorizontal: WARDROBE_H_PAD,
              gap: 14,
            }}
          >
            {stats.totals.total_items === 0 ? (
              <View style={styles.emptyOutfitsBox}>
                <View style={styles.emptyOutfitsMedallion}>
                  <Ionicons
                    name="bar-chart-outline"
                    size={24}
                    color={colors.olive[700]}
                  />
                </View>
                <Text style={styles.emptyOutfitsTitle}>No insights yet</Text>
                <Text style={styles.emptyOutfitsSub}>
                  Sync your delivered orders and log a few wears — cost-per-wear
                  and category breakdowns will appear here.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.createOutfitBtn,
                    (syncing || loading) && { opacity: 0.85 },
                  ]}
                  onPress={handleSync}
                  disabled={syncing || loading}
                  activeOpacity={0.88}
                >
                  <Text style={styles.createOutfitBtnText}>
                    {syncing ? "Syncing…" : "Sync delivered orders"}
                  </Text>
                  <View style={styles.ctaArrow}>
                    <Ionicons name="sync" size={14} color={colors.olive[900]} />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Spend summary */}
                <View style={styles.spendStrip}>
                  <View style={styles.spendCell}>
                    <Text style={styles.spendValue}>
                      {formatPrice(stats.totals.total_spent)}
                    </Text>
                    <Text style={styles.spendLabel}>Total invested</Text>
                  </View>
                  <View style={styles.spendDivider} />
                  <View style={styles.spendCell}>
                    <Text style={styles.spendValue}>
                      {typeof stats.totals.avg_cost_per_wear === "number"
                        ? formatPrice(stats.totals.avg_cost_per_wear)
                        : "—"}
                    </Text>
                    <Text style={styles.spendLabel}>Avg cost per wear</Text>
                  </View>
                </View>

                {/* By category */}
                {stats.byGarment.length > 0 && (
                  <View style={styles.statPanel}>
                    <View style={styles.panelHead}>
                      <Text style={styles.statPanelTitle}>By category</Text>
                      <Text style={styles.panelMeta}>
                        {stats.byGarment.reduce((n, g) => n + g.n, 0)} pieces
                      </Text>
                    </View>
                    {stats.byGarment.map((g, i) => {
                      const max = Math.max(
                        ...stats.byGarment.map((x) => x.n),
                        1,
                      );
                      const label = g.garment_type
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <View
                          key={g.garment_type}
                          style={[styles.catRow, i > 0 && styles.catRowDivider]}
                        >
                          <View style={styles.statLineHeader}>
                            <Text style={styles.statLineLabel}>{label}</Text>
                            <Text style={styles.statLineValue}>
                              {g.n} {g.n === 1 ? "piece" : "pieces"} ·{" "}
                              {formatPrice(g.total_spent)}
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
                    })}
                  </View>
                )}

                {/* Most worn */}
                <View style={styles.statPanel}>
                  <View style={styles.panelHead}>
                    <Text style={styles.statPanelTitle}>Most worn</Text>
                    {stats.topWorn.length > 0 && (
                      <Text style={styles.panelMeta}>
                        {stats.totals.total_wears} wears total
                      </Text>
                    )}
                  </View>
                  {stats.topWorn.length === 0 ? (
                    <View style={styles.inlineEmpty}>
                      <Ionicons
                        name="repeat-outline"
                        size={18}
                        color={colors.olive[700]}
                      />
                      <Text style={styles.emptyStatText}>
                        No wears logged — tap the wear button on any piece to
                        start tracking.
                      </Text>
                    </View>
                  ) : (
                    stats.topWorn.map((w, i) => (
                      <View
                        key={w.id}
                        style={[
                          styles.topWornRow,
                          i === stats.topWorn.length - 1 && {
                            borderBottomWidth: 0,
                          },
                        ]}
                      >
                        <Text style={styles.topWornRank}>
                          {String(i + 1).padStart(2, "0")}
                        </Text>
                        <View style={styles.topWornThumb}>
                          {w.image_url ? (
                            <Image
                              source={{ uri: w.image_url }}
                              style={styles.topWornImg}
                              contentFit="cover"
                              transition={200}
                            />
                          ) : (
                            <Ionicons
                              name="shirt-outline"
                              size={18}
                              color={colors.olive[300]}
                            />
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
                        <Text style={styles.topWornCount}>{w.wear_count}×</Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
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
                Days marked with a gold dot have a look scheduled — tap to
                preview or swap pieces.
              </Text>
            </View>
          </View>
        )}

        {/* Share link pill */}
        {shareLink && (
          <View style={styles.sharePill}>
            <Ionicons name="link" size={14} color={GOLD_DEEP} />
            <Text style={styles.sharePillText} numberOfLines={1}>
              Public collection link active
            </Text>
            <TouchableOpacity onPress={() => setShareLink(null)} hitSlop={8}>
              <Ionicons
                name="close"
                size={14}
                color={colors.light.foreground}
              />
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
              <Ionicons
                name="close-circle-outline"
                size={14}
                color={colors.accent2.rust}
              />
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
    </UserPageFrame>
  );
}

/* =========================================================================
   Styles
   ========================================================================= */
const styles = withUserTheme(
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: WARDROBE_H_PAD,
      paddingBottom: 10,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.paper.cream,
      borderWidth: 1,
      borderColor: HAIRLINE,
      alignItems: "center",
      justifyContent: "center",
    },
    headerBtnActive: {
      backgroundColor: "rgba(200, 164, 74, 0.14)",
      borderColor: "rgba(200, 164, 74, 0.35)",
    },
    headerTitle: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 15,
      color: colors.light.foreground,
    },

    /* Gate */
    gateWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing[8],
      gap: 10,
    },
    gateMedallion: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.paper.warm,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    gateTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 22,
      letterSpacing: -0.3,
      color: colors.light.foreground,
      textAlign: "center",
    },
    gateSub: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 13,
      color: colors.light.mutedForeground,
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 290,
    },
    gateCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      height: 50,
      paddingLeft: 22,
      paddingRight: 6,
      borderRadius: radii.full,
      backgroundColor: "#15160f",
      marginTop: 12,
    },
    gateCtaText: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 14,
      color: colors.paper.cream,
    },
    ctaArrow: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.paper.cream,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Page heading */
    pageHead: {
      paddingHorizontal: WARDROBE_H_PAD,
      paddingTop: 0,
      marginBottom: spacing[4],
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    eyebrowRule: { width: 22, height: 1, backgroundColor: "#535e2c" },
    eyebrow: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 10,
      letterSpacing: 2.2,
      textTransform: "uppercase",
      color: "#535e2c",
    },
    pageTitle: {
      fontFamily: fontFamilies.display.semibold,
      fontSize: 38,
      lineHeight: 44,
      letterSpacing: -1,
      color: LUX.ink,
    },
    pageTitleAccent: {
      fontFamily: fontFamilies.display.italic,
      color: "#535e2c",
    },
    pageSub: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 14,
      lineHeight: 20,
      color: C.muted,
      maxWidth: 320,
    },

    /* Summary card */
    heroSection: {
      paddingHorizontal: WARDROBE_H_PAD,
      paddingTop: 4,
    },
    sumShadow: {
      borderRadius: 26,
      backgroundColor: C.card,
      shadowColor: "#16170f",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 3,
    },
    sumCard: {
      borderRadius: 26,
      borderCurve: "continuous",
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.line,
      padding: 18,
      gap: 16,
    },
    sumTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    sumIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.accentSoft,
    },
    sumLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.muted },
    sumValue: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 26,
      letterSpacing: -0.8,
      color: C.text,
      fontVariant: ["tabular-nums"],
    },
    cpwPill: {
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: C.accentSoft,
      maxWidth: 120,
    },
    cpwPillLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: C.muted },
    cpwPillValue: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.accent, marginTop: 1 },
    sumStrip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: 20,
      borderCurve: "continuous",
      backgroundColor: C.ink,
    },
    sumStat: { flex: 1, alignItems: "center", gap: 2 },
    sumStatValue: { fontFamily: fontFamilies.sans.bold, fontSize: 21, color: C.cream, fontVariant: ["tabular-nums"] },
    sumStatLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },
    sumDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },
    sumFoot: { flexDirection: "row", alignItems: "center", gap: 10 },
    sumFootLabel: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13, color: C.muted },
    sumSyncBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minWidth: 84,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: C.ink,
    },
    sumSyncText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.cream },
    heroCard: {
      paddingTop: spacing[5],
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[3],
    },
    heroValueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing[3],
    },
    heroKicker: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 9.5,
      letterSpacing: 1.8,
      textTransform: "uppercase",
      color: LUX.goldSoft,
      marginBottom: 6,
    },
    heroValue: {
      fontFamily: fontFamilies.display.semibold,
      fontSize: 36,
      lineHeight: 42,
      letterSpacing: -0.8,
      color: LUX.cream,
    },
    cpwChip: {
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(200, 224, 138, 0.3)",
      backgroundColor: "rgba(200, 224, 138, 0.08)",
    },
    cpwLabel: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 8.5,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: "rgba(250, 248, 241, 0.55)",
    },
    cpwValue: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 15,
      color: LUX.lime,
      marginTop: 2,
    },
    heroRule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(250, 248, 241, 0.14)",
      marginVertical: spacing[4],
    },
    heroStats: {
      flexDirection: "row",
      paddingBottom: spacing[4],
    },
    heroStatCell: {
      flex: 1,
      gap: 2,
    },
    heroStatDivider: {
      paddingLeft: spacing[4],
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: "rgba(250, 248, 241, 0.14)",
    },
    heroStatValue: {
      fontFamily: fontFamilies.display.semibold,
      fontSize: 28,
      letterSpacing: -0.4,
      color: LUX.cream,
    },
    heroStatValueMuted: {
      color: "rgba(250, 248, 241, 0.32)",
    },
    heroStatLabel: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 9,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: "rgba(250, 248, 241, 0.55)",
    },
    heroFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: -spacing[2],
      backgroundColor: "rgba(250, 248, 241, 0.05)",
      borderRadius: radii.full,
      paddingLeft: spacing[4],
      paddingRight: 5,
      paddingVertical: 5,
    },
    heroFootText: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.accent,
    },
    heroFootLabel: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 11.5,
      color: "rgba(250, 248, 241, 0.65)",
    },
    heroSyncBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      minWidth: 72,
      height: 32,
      paddingHorizontal: 14,
      borderRadius: radii.full,
      backgroundColor: LUX.lime,
    },
    heroSyncText: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 12.5,
      color: LUX.ink,
    },

    /* Section Eyebrow */
    sectionEyebrow: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 10,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: "#535e2c",
      paddingHorizontal: WARDROBE_H_PAD,
      marginBottom: 8,
    },

    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: WARDROBE_H_PAD,
      marginBottom: 12,
    },
    sectionKicker: {
      fontFamily: fontFamilies.mono.semibold,
      fontSize: 10,
      letterSpacing: 1,
      color: "#535e2c",
    },
    sectionTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 19,
      letterSpacing: -0.4,
      color: LUX.ink,
    },

    /* Tabs */
    tabsScroll: { marginTop: 22 },
    tabsRow: { paddingHorizontal: WARDROBE_H_PAD, gap: 10 },
    tabButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 42,
      paddingLeft: 14,
      paddingRight: 10,
      borderRadius: 21,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: C.line,
    },
    tabButtonActive: {
      backgroundColor: LUX.ink,
      borderColor: LUX.ink,
    },
    tabButtonText: {
      fontSize: 14,
      fontFamily: fontFamilies.sans.semibold,
      color: C.text,
    },
    tabButtonTextActive: {
      color: C.cream,
    },
    tabCount: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.accentSoft,
    },
    tabCountOn: { backgroundColor: "rgba(200,224,138,0.18)" },
    tabCountText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 11.5,
      color: C.muted,
    },
    tabCountTextOn: { color: LUX.lime },

    /* Loading */
    loadingBox: {
      padding: 32,
      alignItems: "center",
      gap: 8,
    },
    loadingBoxText: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 13.5,
      color: colors.light.mutedForeground,
    },

    /* Outfits Tab */
    outfitsHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    outfitsTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 22,
      letterSpacing: -0.6,
      color: LUX.ink,
    },
    autoGenerateBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: radii.full,
      backgroundColor: LUX.olive,
    },
    autoGenerateBtnText: {
      color: LUX.cream,
      fontSize: 12.5,
      fontFamily: fontFamilies.sans.bold,
    },
    emptyOutfitsBox: {
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 24,
      paddingVertical: spacing[8],
      paddingHorizontal: spacing[6],
      borderWidth: 1,
      borderColor: HAIRLINE,
      marginTop: 8,
      gap: 6,
    },
    emptyOutfitsMedallion: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.paper.warm,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    emptyOutfitsTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 19,
      letterSpacing: -0.4,
      color: LUX.ink,
    },
    emptyOutfitsSub: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 13,
      color: colors.light.mutedForeground,
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 280,
    },
    createOutfitBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      height: 48,
      paddingLeft: 20,
      paddingRight: 5,
      borderRadius: radii.full,
      backgroundColor: LUX.olive,
      marginTop: 14,
    },
    createOutfitBtnText: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 14,
      color: LUX.cream,
    },
    clearBtn: {
      marginTop: 12,
      paddingHorizontal: 18,
      height: 38,
      justifyContent: "center",
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.light.border,
    },
    clearBtnText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 13,
      color: colors.light.foreground,
    },

    /* Stats Tab */
    spendStrip: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 26,
      paddingVertical: spacing[5],
      backgroundColor: LUX.olive,
      borderWidth: 1,
      borderColor: "rgba(200,164,74,0.22)",
      shadowColor: LUX.ink,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.22,
      shadowRadius: 22,
      elevation: 8,
    },
    spendCell: {
      flex: 1,
      alignItems: "center",
      gap: 3,
    },
    spendDivider: {
      width: 1,
      height: 34,
      backgroundColor: "rgba(250, 248, 241, 0.12)",
    },
    spendValue: {
      fontFamily: fontFamilies.display.semibold,
      fontSize: 26,
      letterSpacing: -0.5,
      color: LUX.cream,
    },
    spendLabel: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 9.5,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: LUX.goldSoft,
    },
    statPanel: {
      backgroundColor: "#FFFFFF",
      borderRadius: 24,
      padding: spacing[5],
      borderWidth: 1,
      borderColor: HAIRLINE,
      shadowColor: LUX.ink,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.05,
      shadowRadius: 16,
      elevation: 2,
    },
    panelHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    statPanelTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 18,
      letterSpacing: -0.4,
      color: LUX.ink,
    },
    panelMeta: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.light.mutedForeground,
    },
    inlineEmpty: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: spacing[1],
    },
    emptyStatText: {
      flex: 1,
      fontFamily: fontFamilies.sans.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.light.mutedForeground,
    },
    catRow: {
      paddingVertical: 10,
    },
    catRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.light.border,
    },
    statLineHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    statLineLabel: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 13.5,
      color: colors.light.foreground,
    },
    statLineValue: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 12,
      color: colors.light.mutedForeground,
    },
    statProgressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(22, 23, 15, 0.07)",
      overflow: "hidden",
    },
    statProgressFill: {
      height: "100%",
      backgroundColor: C.accent,
      borderRadius: 2,
    },
    topWornRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.light.border,
    },
    topWornRank: {
      fontFamily: fontFamilies.display.italic,
      fontSize: 16,
      color: "#535e2c",
      width: 22,
    },
    topWornThumb: {
      width: 44,
      height: 52,
      borderRadius: 10,
      backgroundColor: colors.paper.warm,
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
      fontSize: 13.5,
      color: colors.light.foreground,
    },
    topWornMeta: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 9.5,
      color: GOLD_DEEP,
      letterSpacing: 1,
    },
    topWornCount: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 12.5,
      color: colors.light.foreground,
    },

    /* Lookbook Tab */
    lookbookSubText: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 12.5,
      color: colors.light.mutedForeground,
      textAlign: "center",
      lineHeight: 18,
    },

    /* Share Pill */
    sharePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "center",
      marginTop: 16,
      backgroundColor: "rgba(200, 164, 74, 0.14)",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.full,
    },
    sharePillText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 12,
      color: LUX.goldInk,
    },

    /* Revoke Button */
    revokeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 44,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: "rgba(184, 92, 58, 0.3)",
    },
    revokeBtnText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 13,
      color: colors.accent2.rust,
    },
  }),
);
