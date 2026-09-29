import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPriceAlerts, updatePriceAlert, unsubscribePriceAlert } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export type PriceAlert = {
  id: string;
  product_id: string;
  variant_id: string | null;
  threshold_price: number | null;
  current_price_at_signup: number;
  currency: string;
  is_active: boolean;
  cancelled_at: string | null;
  created_at?: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number | null;
    images?: Array<{ url: string; is_primary?: boolean | null }>;
  } | null;
};

type FilterTab = "all" | "drops" | "active";

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";
const GREEN = "#15803d";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "drops", label: "Drops" },
  { key: "active", label: "Watching" },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Continuous monitoring",
    desc: "We scan boutique prices for revisions around the clock.",
  },
  {
    n: "02",
    title: "Your target price",
    desc: "Set a maximum price, or get alerted on any reduction.",
  },
  {
    n: "03",
    title: "Instant alerts",
    desc: "Push and email notifications the moment a price drops.",
  },
];

export default function PriceAlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const q = useQuery({
    queryKey: ["price-alerts"],
    queryFn: async () => {
      const r = await listPriceAlerts();
      return r.ok ? (r.data.alerts as PriceAlert[]) : [];
    },
  });

  const alerts = q.data ?? [];

  // Metrics computation
  const metrics = useMemo(() => {
    const total = alerts.length;
    let drops = 0;
    let active = 0;

    for (const a of alerts) {
      if (a.is_active) active++;
      const current = a.product?.price ?? a.current_price_at_signup;
      if (current < a.current_price_at_signup) {
        drops++;
      }
    }

    return { total, drops, active };
  }, [alerts]);

  // Filtered list
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (activeTab === "drops") {
        const current = a.product?.price ?? a.current_price_at_signup;
        return current < a.current_price_at_signup;
      }
      if (activeTab === "active") {
        return a.is_active;
      }
      return true;
    });
  }, [alerts, activeTab]);

  const handleStartEditing = (alert: PriceAlert) => {
    setEditingId(alert.id);
    setEditValue(alert.threshold_price ? String(alert.threshold_price) : "");
    setEditError(null);
  };

  const handleApplyPreset = (percent: number, basePrice: number) => {
    const calculated = Math.round(basePrice * (1 - percent / 100));
    setEditValue(String(calculated));
    setEditError(null);
  };

  const onSaveThreshold = async (id: string) => {
    const num = editValue.trim() === "" ? null : Number(editValue.trim());
    if (num !== null && (!Number.isFinite(num) || num <= 0)) {
      setEditError("Please enter a valid price greater than 0");
      return;
    }
    setEditError(null);
    setIsSaving(true);
    try {
      const r = await updatePriceAlert(id, { threshold_price: num });
      if (r.ok) {
        toast("Threshold price updated", "success");
        setEditingId(null);
        qc.invalidateQueries({ queryKey: ["price-alerts"] });
      } else {
        toast(r.error || "Failed to update threshold", "error");
      }
    } catch {
      toast("Failed to update threshold", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const onCancelAlert = (id: string, productName?: string) => {
    Alert.alert(
      "Remove price watch",
      `Stop monitoring price changes for "${productName ?? "this piece"}"?`,
      [
        { text: "Keep watching", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const r = await unsubscribePriceAlert(id);
            if (r.ok) {
              toast("Price alert removed", "success");
              qc.invalidateQueries({ queryKey: ["price-alerts"] });
            } else {
              toast(r.error || "Failed to remove alert", "error");
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: PriceAlert }) => {
    const isEditing = editingId === item.id;
    const currentPrice = item.product?.price ?? item.current_price_at_signup;
    const initialPrice = item.current_price_at_signup;
    const isDropped = currentPrice < initialPrice;
    const priceDiff = initialPrice - currentPrice;
    const percentDrop = Math.round((priceDiff / initialPrice) * 100);

    const imageUrl =
      item.product?.images?.find((img) => img.is_primary)?.url ??
      item.product?.images?.[0]?.url;

    return (
      <View style={styles.alertCard}>
        {/* Status row */}
        <View style={styles.cardStatusRow}>
          {isDropped ? (
            <View style={styles.dropBadge}>
              <Ionicons name="trending-down" size={12} color={GREEN} />
              <Text style={styles.dropBadgeText}>
                Down {percentDrop}% · save {formatPrice(priceDiff, item.currency)}
              </Text>
            </View>
          ) : (
            <View style={styles.watchBadge}>
              <View style={styles.watchDot} />
              <Text style={styles.watchBadgeText}>Watching</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.trashBtn}
            onPress={() => onCancelAlert(item.id, item.product?.name)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove price alert"
          >
            <Ionicons name="trash-outline" size={16} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Product row */}
        <View style={styles.productRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => item.product?.slug && router.push(`/(main)/products/${item.product.slug}`)}
            style={styles.thumb}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons name="shirt-outline" size={22} color={colors.olive[700]} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.productInfo}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => item.product?.slug && router.push(`/(main)/products/${item.product.slug}`)}
            >
              <Text style={styles.productName} numberOfLines={2}>
                {item.product?.name ?? "Product"}
              </Text>
            </TouchableOpacity>

            <View style={styles.priceRow}>
              <Text style={styles.priceCurrent}>
                {formatPrice(currentPrice, item.currency)}
              </Text>
              {isDropped && (
                <Text style={styles.priceWas}>
                  {formatPrice(initialPrice, item.currency)}
                </Text>
              )}
            </View>

            <View style={styles.targetRow}>
              <Ionicons name="locate-outline" size={12} color={GOLD_DEEP} />
              <Text style={styles.targetText}>
                {item.threshold_price != null
                  ? `Target ${formatPrice(item.threshold_price, item.currency)}`
                  : "Alert on any drop"}
              </Text>
            </View>
          </View>
        </View>

        {/* Editor / actions */}
        {isEditing ? (
          <View style={styles.editor}>
            <View style={styles.editorHeader}>
              <Text style={styles.editorTitle}>Set target price</Text>
              <TouchableOpacity onPress={() => setEditingId(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.light.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.presetRow}>
              {[10, 15, 20].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={styles.presetChip}
                  onPress={() => handleApplyPreset(pct, currentPrice)}
                >
                  <Text style={styles.presetChipText}>−{pct}%</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => {
                  setEditValue("");
                  setEditError(null);
                }}
              >
                <Text style={styles.presetChipText}>Any drop</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editorInputRow}>
              <View style={styles.editorInputWrap}>
                <Text style={styles.currencyPrefix}>{item.currency}</Text>
                <TextInput
                  style={styles.editorInput}
                  value={editValue}
                  onChangeText={(v) => {
                    setEditValue(v);
                    setEditError(null);
                  }}
                  placeholder="Empty = any drop"
                  keyboardType="numeric"
                  placeholderTextColor={colors.light.mutedForeground}
                />
              </View>
              <TouchableOpacity
                style={[styles.editorSave, isSaving && { opacity: 0.6 }]}
                disabled={isSaving}
                onPress={() => onSaveThreshold(item.id)}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.paper.cream} />
                ) : (
                  <Text style={styles.editorSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            {editError ? (
              <Text style={styles.editError}>{editError}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.footerAction}
              onPress={() => handleStartEditing(item)}
              hitSlop={6}
            >
              <Ionicons name="options-outline" size={13} color={GOLD_DEEP} />
              <Text style={styles.footerActionText}>Adjust target</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerAction}
              onPress={() => item.product?.slug && router.push(`/(main)/products/${item.product.slug}`)}
              hitSlop={6}
            >
              <Text style={styles.footerActionTextDark}>View piece</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navBtn}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Price alerts</Text>

          <TouchableOpacity
            onPress={() => q.refetch()}
            disabled={q.isFetching}
            style={styles.navBtn}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            {q.isFetching && !q.isLoading ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={colors.light.foreground} />
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredAlerts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching && !q.isLoading}
              onRefresh={() => q.refetch()}
              tintColor={GOLD}
              colors={[GOLD]}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* Heading */}
              <View style={styles.pageHead}>
                <Text style={styles.eyebrow}>Price watch</Text>
                <Text style={styles.pageTitle}>
                  Price <Text style={styles.pageTitleAccent}>alerts.</Text>
                </Text>
                <Text style={styles.pageSub}>
                  We watch the pieces you care about and tell you the moment the
                  price drops.
                </Text>
              </View>

              {/* Stat strip */}
              <View style={styles.statsStrip}>
                <View style={styles.statCell}>
                  <Text style={[styles.statNum, metrics.total === 0 && styles.statNumMuted]}>
                    {metrics.total}
                  </Text>
                  <Text style={styles.statLabel}>Watching</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text
                    style={[
                      styles.statNum,
                      metrics.drops === 0 && styles.statNumMuted,
                      metrics.drops > 0 && { color: GREEN },
                    ]}
                  >
                    {metrics.drops}
                  </Text>
                  <Text style={styles.statLabel}>Price drops</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={[styles.statNum, metrics.active === 0 && styles.statNumMuted]}>
                    {metrics.active}
                  </Text>
                  <Text style={styles.statLabel}>Active</Text>
                </View>
              </View>

              {/* Filter tabs */}
              {alerts.length > 0 && (
                <View style={styles.segmented}>
                  {TABS.map((tab) => {
                    const count =
                      tab.key === "all"
                        ? metrics.total
                        : tab.key === "drops"
                          ? metrics.drops
                          : metrics.active;
                    const isActive = activeTab === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[styles.segment, isActive && styles.segmentActive]}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[styles.segmentText, isActive && styles.segmentTextActive]}
                        >
                          {tab.label}
                          {count > 0 ? ` ${count}` : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            q.isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={GOLD} size="small" />
                <Text style={styles.loadingText}>Loading price alerts…</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="notifications-outline" size={26} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {alerts.length > 0 ? "No matching alerts" : "No price alerts yet"}
                  </Text>
                  <Text style={styles.emptySub}>
                    {alerts.length > 0
                      ? "No alerts match this filter."
                      : "Tap “Notify on price drop” on any product and we’ll watch it for you."}
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    activeOpacity={0.88}
                    onPress={() => router.push("/(main)")}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>Browse collections</Text>
                    <View style={styles.primaryBtnArrow}>
                      <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.textLink}
                    activeOpacity={0.7}
                    onPress={() => router.push("/(main)/wishlist")}
                    hitSlop={8}
                  >
                    <Text style={styles.textLinkText}>View saved wishlist</Text>
                  </TouchableOpacity>
                </View>

                {/* How it works */}
                <View style={styles.howCard}>
                  <Text style={styles.eyebrow}>How it works</Text>
                  {HOW_IT_WORKS.map((s, i) => (
                    <View key={s.n} style={[styles.howRow, i > 0 && styles.rowDivider]}>
                      <Text style={styles.howNum}>{s.n}</Text>
                      <View style={styles.howBody}>
                        <Text style={styles.howTitle}>{s.title}</Text>
                        <Text style={styles.howDesc}>{s.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )
          }
        />
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
  },
  headerSection: {
    gap: 14,
    marginBottom: 14,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 300,
  },

  /* Stat strip */
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 14,
    ...shadows.soft,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statNum: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  statNumMuted: {
    color: "rgba(22, 23, 15, 0.35)",
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.light.border,
  },

  /* Segmented tabs */
  segmented: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.paper.warm,
    borderRadius: radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  segmentActive: {
    backgroundColor: colors.paper.cream,
    ...shadows.soft,
  },
  segmentText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  segmentTextActive: {
    color: colors.light.foreground,
  },

  /* Alert card */
  alertCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[4],
    marginBottom: 12,
    gap: spacing[3],
    ...shadows.soft,
  },
  cardStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(21, 128, 61, 0.1)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  dropBadgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: GREEN,
  },
  watchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  watchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD_DEEP,
  },
  watchBadgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: GOLD_DEEP,
  },
  trashBtn: {
    padding: 4,
  },

  productRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  thumb: {
    width: 76,
    height: 96,
    borderRadius: 14,
    backgroundColor: colors.paper.warm,
    overflow: "hidden",
  },
  thumbFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
  },
  productName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16.5,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: colors.light.foreground,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  priceCurrent: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
  },
  priceWas: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  targetText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: GOLD_DEEP,
  },

  /* Editor */
  editor: {
    backgroundColor: colors.paper.warm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[3.5],
    gap: 10,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editorTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  presetChipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11.5,
    color: colors.light.foreground,
  },
  editorInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  editorInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    marginRight: 6,
  },
  editorInput: {
    flex: 1,
    height: 42,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  editorSave: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  editorSaveText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.paper.cream,
  },
  editError: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.accent2.rust,
  },

  /* Card footer */
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  footerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
  },
  footerActionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: GOLD_DEEP,
  },
  footerActionTextDark: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
  },

  /* Loading */
  loadingWrap: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 13.5,
    color: colors.light.mutedForeground,
  },

  /* Empty */
  emptyWrap: {
    gap: 14,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 50,
    paddingLeft: 22,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginTop: spacing[5],
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  textLink: {
    marginTop: spacing[3],
    paddingVertical: 4,
  },
  textLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    textDecorationLine: "underline",
  },

  /* How it works */
  howCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  howRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[4],
    paddingVertical: spacing[3.5],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  howNum: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 16,
    color: GOLD_DEEP,
    width: 24,
  },
  howBody: {
    flex: 1,
    gap: 3,
  },
  howTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  howDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },
});
