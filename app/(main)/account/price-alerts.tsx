import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
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

export default function PriceAlertsScreen() {
  const router = useRouter();
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
      "Remove Price Watch",
      `Stop monitoring price adjustments for "${productName ?? "this piece"}"?`,
      [
        { text: "Keep Monitoring", style: "cancel" },
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
        {/* Card Header Status Pill */}
        <View style={styles.cardStatusRow}>
          {isDropped ? (
            <View style={styles.dropBadge}>
              <Ionicons name="trending-down" size={13} color="#2b6e3f" />
              <Text style={styles.dropBadgeText}>
                PRICE DROPPED · SAVE {formatPrice(priceDiff, item.currency)} (-{percentDrop}%)
              </Text>
            </View>
          ) : (
            <View style={styles.monitoringBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.monitoringBadgeText}>ACTIVE RADAR</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.trashIconButton}
            onPress={() => onCancelAlert(item.id, item.product?.name)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color="#8F8B82" />
          </TouchableOpacity>
        </View>

        {/* Product Details Row */}
        <View style={styles.productRow}>
          {/* 3:4 Thumbnail Image */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => item.product?.slug && router.push(`/(main)/products/${item.product.slug}`)}
            style={styles.thumbnailContainer}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.thumbnailImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.thumbnailFallback}>
                <Ionicons name="shirt-outline" size={24} color="#C8A44A" />
              </View>
            )}
          </TouchableOpacity>

          {/* Info Details */}
          <View style={styles.productInfo}>
            <Text style={styles.brandTag}>ATELIER ARCHIVE</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => item.product?.slug && router.push(`/(main)/products/${item.product.slug}`)}
            >
              <Text style={styles.productName} numberOfLines={2}>
                {item.product?.name ?? "Archival Garment"}
              </Text>
            </TouchableOpacity>

            {/* Price Matrix */}
            <View style={styles.priceMatrix}>
              <View style={styles.priceCurrentRow}>
                <Text style={styles.priceCurrent}>
                  {formatPrice(currentPrice, item.currency)}
                </Text>
                {isDropped && (
                  <Text style={styles.priceStrikethrough}>
                    {formatPrice(initialPrice, item.currency)}
                  </Text>
                )}
              </View>

              <View style={styles.thresholdMetaRow}>
                <Ionicons name="shield-checkmark-outline" size={13} color="#85651B" />
                <Text style={styles.thresholdMetaText}>
                  {item.threshold_price != null
                    ? `Target: ≤ ${formatPrice(item.threshold_price, item.currency)}`
                    : "Alert on any price reduction"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Expandable Threshold Editor */}
        {isEditing ? (
          <View style={styles.editorContainer}>
            <View style={styles.editorHeaderRow}>
              <Text style={styles.editorTitle}>SET BESPOKE TARGET PRICE</Text>
              <TouchableOpacity onPress={() => setEditingId(null)}>
                <Ionicons name="close" size={18} color="#8F8B82" />
              </TouchableOpacity>
            </View>

            {/* Quick Percentage Presets */}
            <Text style={styles.presetLabel}>Quick Targets Below Current Price:</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(10, currentPrice)}
              >
                <Text style={styles.presetChipText}>-10%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(15, currentPrice)}
              >
                <Text style={styles.presetChipText}>-15%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handleApplyPreset(20, currentPrice)}
              >
                <Text style={styles.presetChipText}>-20%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChipSecondary}
                onPress={() => {
                  setEditValue("");
                  setEditError(null);
                }}
              >
                <Text style={styles.presetChipSecondaryText}>Any Drop</Text>
              </TouchableOpacity>
            </View>

            {/* Input & Save Action */}
            <View style={styles.inputActionRow}>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>{item.currency}</Text>
                <TextInput
                  style={styles.thresholdInput}
                  value={editValue}
                  onChangeText={(v) => {
                    setEditValue(v);
                    setEditError(null);
                  }}
                  placeholder="e.g. 240 (Leave empty for any drop)"
                  keyboardType="numeric"
                  placeholderTextColor="#9C988F"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveThresholdButton, isSaving && { opacity: 0.7 }]}
                disabled={isSaving}
                onPress={() => onSaveThreshold(item.id)}
              >
                <Text style={styles.saveThresholdButtonText}>
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>

            {editError && (
              <Text style={styles.editErrorText}>{editError}</Text>
            )}
          </View>
        ) : (
          /* Bottom Action Bar */
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.editThresholdTrigger}
              onPress={() => handleStartEditing(item)}
            >
              <Ionicons name="options-outline" size={14} color="#85651B" />
              <Text style={styles.editThresholdTriggerText}>Adjust Target</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewPieceButton}
              onPress={() => item.product?.slug && router.push(`/(main)/products/${item.product.slug}`)}
            >
              <Text style={styles.viewPieceButtonText}>View Piece</Text>
              <Ionicons name="arrow-forward" size={13} color="#141311" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* 1. Custom Atelier Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="#141311" />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerEyebrow}>ACQUISITION RADAR</Text>
          <Text style={styles.headerTitle}>Price Alerts</Text>
        </View>

        <TouchableOpacity
          onPress={() => q.refetch()}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={q.isFetching ? "#C8A44A" : "#141311"}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredAlerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => q.refetch()}
            tintColor="#C8A44A"
            colors={["#C8A44A"]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSectionContainer}>
            {/* 2. Velvet Obsidian Hero Card */}
            <LinearGradient
              colors={["#141311", "#1E1C18", "#0F0E0D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroTagBadge}>
                  <Ionicons name="sparkles" size={10} color="#C8A44A" />
                  <Text style={styles.heroTagText}>ATELIER ACQUISITIONS</Text>
                </View>

                {/* Radar Pulse Seal Medallion */}
                <View style={styles.radarMedallion}>
                  <View style={styles.radarMedallionInner}>
                    <Ionicons name="radio-outline" size={18} color="#E8CF8F" />
                  </View>
                </View>
              </View>

              <Text style={styles.heroTitle}>Archival Price Radar</Text>
              <Text style={styles.heroSubtitle}>
                Autonomous surveillance of archival garments. Set bespoke reserve prices or receive
                real-time alerts when private sales and boutique markdowns are triggered.
              </Text>

              {/* 3-Metric Intelligence Strip */}
              <View style={styles.heroMetricsStrip}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{metrics.total}</Text>
                  <Text style={styles.metricLabel}>WATCHES</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, metrics.drops > 0 && { color: "#54B870" }]}>
                    {metrics.drops}
                  </Text>
                  <Text style={styles.metricLabel}>PRICE DROPS</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>24/7</Text>
                  <Text style={styles.metricLabel}>RADAR STATUS</Text>
                </View>
              </View>
            </LinearGradient>

            {/* 3. Segmented Filter Tabs (When alerts exist) */}
            {alerts.length > 0 && (
              <View style={styles.filterTabsRow}>
                <TouchableOpacity
                  style={[styles.filterTab, activeTab === "all" && styles.filterTabActive]}
                  onPress={() => setActiveTab("all")}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      activeTab === "all" && styles.filterTabTextActive,
                    ]}
                  >
                    All Watches ({alerts.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, activeTab === "drops" && styles.filterTabActive]}
                  onPress={() => setActiveTab("drops")}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      activeTab === "drops" && styles.filterTabTextActive,
                    ]}
                  >
                    Price Drops ({metrics.drops})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, activeTab === "active" && styles.filterTabActive]}
                  onPress={() => setActiveTab("active")}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      activeTab === "active" && styles.filterTabTextActive,
                    ]}
                  >
                    Active Radar ({metrics.active})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="pulse-outline" size={32} color="#C8A44A" />
              <Text style={styles.loadingText}>Calibrating price radar...</Text>
            </View>
          ) : (
            /* 4. Editorial Empty State (Replaces the bare card) */
            <View style={styles.emptyStateWrapper}>
              <View style={styles.emptyCard}>
                {/* Double-Ring Gold Medallion */}
                <View style={styles.emptyMedallionOuter}>
                  <View style={styles.emptyMedallionInner}>
                    <Ionicons name="notifications-outline" size={28} color="#C8A44A" />
                    <View style={styles.emptyMedallionSparkle}>
                      <Ionicons name="sparkles" size={10} color="#E8CF8F" />
                    </View>
                  </View>
                </View>

                <Text style={styles.emptyTitle}>Radar Currently Clear</Text>
                <Text style={styles.emptyBody}>
                  You have no active price alerts. While exploring archival collections and runway
                  pieces, tap "Notify on price drop" to establish autonomous price tracking.
                </Text>

                {/* Primary Action Button */}
                <TouchableOpacity
                  style={styles.emptyPrimaryButton}
                  activeOpacity={0.85}
                  onPress={() => router.push("/(main)")}
                >
                  <LinearGradient
                    colors={["#1C1A17", "#141311"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emptyPrimaryButtonGradient}
                  >
                    <Text style={styles.emptyPrimaryButtonText}>Explore The Collections</Text>
                    <Ionicons name="arrow-forward" size={15} color="#E8CF8F" />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Secondary Wishlist Button */}
                <TouchableOpacity
                  style={styles.emptySecondaryButton}
                  activeOpacity={0.7}
                  onPress={() => router.push("/(main)/wishlist")}
                >
                  <Ionicons name="heart-outline" size={14} color="#85651B" />
                  <Text style={styles.emptySecondaryButtonText}>Review Saved Wishlist</Text>
                </TouchableOpacity>
              </View>

              {/* 5. How Price Radar Operates (3-Step Luxury Feature Cards) */}
              <View style={styles.protocolsSection}>
                <View style={styles.protocolsHeaderRow}>
                  <Ionicons name="shield-outline" size={14} color="#85651B" />
                  <Text style={styles.protocolsEyebrow}>ACQUISITION PROTOCOLS</Text>
                </View>
                <Text style={styles.protocolsTitle}>How Price Watch Operates</Text>

                <View style={styles.protocolCardsList}>
                  {/* Step 1 */}
                  <View style={styles.protocolCard}>
                    <View style={styles.protocolNumberBadge}>
                      <Text style={styles.protocolNumberText}>01</Text>
                    </View>
                    <View style={styles.protocolCardContent}>
                      <Text style={styles.protocolCardTitle}>Continuous Archival Surveillance</Text>
                      <Text style={styles.protocolCardDesc}>
                        Automated monitoring across boutique and private collections scans for price
                        revisions every 15 minutes.
                      </Text>
                    </View>
                  </View>

                  {/* Step 2 */}
                  <View style={styles.protocolCard}>
                    <View style={styles.protocolNumberBadge}>
                      <Text style={styles.protocolNumberText}>02</Text>
                    </View>
                    <View style={styles.protocolCardContent}>
                      <Text style={styles.protocolCardTitle}>Bespoke Reserve Targets</Text>
                      <Text style={styles.protocolCardDesc}>
                        Calibrate notifications for any price revision or lock in a strict maximum
                        strike price tailored to your acquisitions budget.
                      </Text>
                    </View>
                  </View>

                  {/* Step 3 */}
                  <View style={styles.protocolCard}>
                    <View style={styles.protocolNumberBadge}>
                      <Text style={styles.protocolNumberText}>03</Text>
                    </View>
                    <View style={styles.protocolCardContent}>
                      <Text style={styles.protocolCardTitle}>First-Access Priority Dispatch</Text>
                      <Text style={styles.protocolCardDesc}>
                        Receive instantaneous push and email dispatches to your device before pieces
                        are indexed for the general public.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Concierge Guarantee Callout */}
                <View style={styles.guaranteeBanner}>
                  <Ionicons name="ribbon-outline" size={16} color="#C8A44A" />
                  <Text style={styles.guaranteeText}>
                    Atelier Concierge Promise: Instantaneous notification transmissions with zero
                    promotional spam.
                  </Text>
                </View>
              </View>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F4EF",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F5F4EF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "#85651B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#141311",
    letterSpacing: -0.3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSectionContainer: {
    marginBottom: 16,
  },

  /* Velvet Obsidian Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    ...shadows.glow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#E8CF8F",
  },
  radarMedallion: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    padding: 3,
  },
  radarMedallionInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#201E1A",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 23,
    color: "#FAF8F5",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#B3AFA5",
    marginBottom: 18,
  },
  heroMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    color: "#FAF8F5",
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#8F8B82",
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },

  /* Segmented Filter Tabs */
  filterTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#EBE8DF",
    borderWidth: 1,
    borderColor: "#DFDBCF",
  },
  filterTabActive: {
    backgroundColor: "#141311",
    borderColor: "#141311",
  },
  filterTabText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "#6B675E",
  },
  filterTabTextActive: {
    color: "#FAF8F5",
    fontFamily: fontFamilies.sans.semibold,
  },

  /* Price Alert Cards */
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 16,
    marginBottom: 14,
    ...shadows.soft,
  },
  cardStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dropBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C5E6CC",
  },
  dropBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#2B6E3F",
    letterSpacing: 0.5,
  },
  monitoringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F7F5EE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6E2D4",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C8A44A",
  },
  monitoringBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651B",
    letterSpacing: 0.8,
  },
  trashIconButton: {
    padding: 4,
  },

  productRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  thumbnailContainer: {
    width: 64,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#F9F8F5",
    borderWidth: 1,
    borderColor: "#EBE7DE",
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: {
    flex: 1,
  },
  brandTag: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9,
    letterSpacing: 1.2,
    color: "#8F8B82",
    marginBottom: 3,
  },
  productName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: "#141311",
    lineHeight: 20,
    marginBottom: 6,
  },
  priceMatrix: {
    gap: 3,
  },
  priceCurrentRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  priceCurrent: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    color: "#141311",
  },
  priceStrikethrough: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 13,
    color: "#9C988F",
    textDecorationLine: "line-through",
  },
  thresholdMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  thresholdMetaText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "#736F65",
  },

  /* Expandable Threshold Editor */
  editorContainer: {
    backgroundColor: "#FAF9F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E1D5",
    padding: 14,
    marginTop: 14,
  },
  editorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  editorTitle: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#85651B",
  },
  presetLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#736F65",
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ECE8DD",
    borderWidth: 1,
    borderColor: "#DCD7CA",
  },
  presetChipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: "#414A23",
  },
  presetChipSecondary: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#E4DFD3",
  },
  presetChipSecondaryText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: "#575349",
  },
  inputActionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCD7CA",
    paddingHorizontal: 10,
  },
  currencyPrefix: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 13,
    color: "#8F8B82",
    marginRight: 6,
  },
  thresholdInput: {
    flex: 1,
    height: 38,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 13,
    color: "#141311",
  },
  saveThresholdButton: {
    backgroundColor: "#141311",
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveThresholdButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#E8CF8F",
  },
  editErrorText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#C0392B",
    marginTop: 6,
  },

  /* Bottom Action Bar */
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0EEE8",
  },
  editThresholdTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editThresholdTriggerText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#85651B",
  },
  viewPieceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewPieceButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#141311",
  },

  /* Loading State */
  loadingContainer: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#8F8B82",
  },

  /* Editorial Empty State */
  emptyStateWrapper: {
    gap: 20,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 26,
    alignItems: "center",
    ...shadows.soft,
  },
  emptyMedallionOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    padding: 4,
    marginBottom: 16,
  },
  emptyMedallionInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#141311",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emptyMedallionSparkle: {
    position: "absolute",
    top: 6,
    right: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: "#141311",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 20,
    color: "#787469",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emptyPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
    ...shadows.soft,
  },
  emptyPrimaryButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  emptyPrimaryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
  },
  emptySecondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  emptySecondaryButtonText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: "#85651B",
  },

  /* Acquisition Protocols Section */
  protocolsSection: {
    backgroundColor: "#FAF9F5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBE7DD",
    padding: 20,
  },
  protocolsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  protocolsEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#85651B",
  },
  protocolsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: "#141311",
    marginBottom: 16,
  },
  protocolCardsList: {
    gap: 12,
    marginBottom: 18,
  },
  protocolCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAE6DB",
    padding: 14,
  },
  protocolNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F2EFE6",
    borderWidth: 1,
    borderColor: "#E0DCcf",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolNumberText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#85651B",
  },
  protocolCardContent: {
    flex: 1,
  },
  protocolCardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
    marginBottom: 3,
  },
  protocolCardDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#787469",
  },
  guaranteeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(200, 164, 74, 0.08)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.2)",
  },
  guaranteeText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    lineHeight: 16,
    color: "#6B5219",
  },
});
