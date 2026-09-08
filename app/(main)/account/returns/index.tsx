import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { getReturns, type MobileReturnRequest } from "@/lib/api";
import { type ReturnStatus } from "@/lib/account-local";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const STATUS_CONFIG: Record<
  ReturnStatus,
  {
    label: string;
    bg: string;
    fg: string;
    border: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
  }
> = {
  requested: {
    label: "REQUESTED",
    bg: "rgba(200, 164, 74, 0.12)",
    fg: "#85651b",
    border: "rgba(200, 164, 74, 0.3)",
    icon: "hourglass-outline",
    description: "Under atelier review",
  },
  approved: {
    label: "APPROVED",
    bg: "rgba(83, 94, 44, 0.12)",
    fg: "#414b22",
    border: "rgba(83, 94, 44, 0.25)",
    icon: "checkmark-circle-outline",
    description: "Ready for courier collection",
  },
  received: {
    label: "INSPECTION",
    bg: "rgba(30, 58, 138, 0.1)",
    fg: "#1e40af",
    border: "rgba(30, 58, 138, 0.25)",
    icon: "archive-outline",
    description: "Atelier intake verification",
  },
  refunded: {
    label: "SETTLED",
    bg: "rgba(22, 101, 52, 0.12)",
    fg: "#15803d",
    border: "rgba(22, 101, 52, 0.25)",
    icon: "card-outline",
    description: "Funds credited to account",
  },
  rejected: {
    label: "DECLINED",
    bg: "rgba(220, 38, 38, 0.1)",
    fg: "#dc2626",
    border: "rgba(220, 38, 38, 0.25)",
    icon: "close-circle-outline",
    description: "Policy criteria not met",
  },
};

type Tab = "all" | ReturnStatus;

export default function ReturnsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [returns, setReturns] = useState<MobileReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const fetchReturnsData = useCallback(async (isRefresh = false) => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);

    try {
      const res = await getReturns(user.id);
      if (res.ok) {
        setReturns(res.data);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReturnsData();
  }, [fetchReturnsData]);

  const onRefresh = useCallback(() => {
    fetchReturnsData(true);
  }, [fetchReturnsData]);

  const counts = useMemo(() => {
    return {
      all: returns.length,
      requested: returns.filter((r) => r.status === "requested").length,
      approved: returns.filter((r) => r.status === "approved").length,
      received: returns.filter((r) => r.status === "received").length,
      refunded: returns.filter((r) => r.status === "refunded").length,
      rejected: returns.filter((r) => r.status === "rejected").length,
    };
  }, [returns]);

  const activeCount = counts.requested + counts.approved + counts.received;

  const filteredReturns = useMemo(() => {
    let list = returns;
    if (tab !== "all") {
      list = list.filter((r) => r.status === tab);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.return_number.toLowerCase().includes(q) ||
          r.order_number.toLowerCase().includes(q) ||
          r.items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [returns, tab, query]);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Atelier Navigation Header */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>RETURNS & REFUNDS</Text>
            <Text style={styles.navSubtitle}>REVERSE LOGISTICS</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => onRefresh()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={refreshing ? "#C8A44A" : colors.light.foreground}
            />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#C8A44A" size="small" />
            <Text style={styles.loadingText}>Loading return dossiers…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#C8A44A"
              />
            }
          >
            {/* 1. Haute Couture Obsidian Hero Banner */}
            <LinearGradient
              colors={["#1c2016", "#14170e", "#0e110a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroEyebrowRow}>
                <View style={styles.heroTagBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#C8A44A" />
                  <Text style={styles.heroTagText}>CONCIERGE CARE</Text>
                </View>

                <TouchableOpacity
                  style={styles.policyPill}
                  activeOpacity={0.8}
                  onPress={() => setShowPolicyModal(true)}
                >
                  <Ionicons name="information-circle-outline" size={13} color="#E8CF8F" />
                  <Text style={styles.policyPillText}>Return Policy</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.heroTitle}>Returns & Concierge Refunds</Text>
              <Text style={styles.heroSubtitle}>
                Complimentary doorstep pickup, thorough atelier inspection, and direct settlements to your original payment method.
              </Text>

              {/* Guarantee Value Pills */}
              <View style={styles.guaranteeRow}>
                <View style={styles.guaranteePill}>
                  <Ionicons name="calendar-outline" size={12} color="#C8A44A" />
                  <Text style={styles.guaranteePillText}>14-Day Guarantee</Text>
                </View>
                <View style={styles.guaranteePill}>
                  <Ionicons name="bicycle-outline" size={12} color="#C8A44A" />
                  <Text style={styles.guaranteePillText}>Doorstep Pickup</Text>
                </View>
                <View style={styles.guaranteePill}>
                  <Ionicons name="card-outline" size={12} color="#C8A44A" />
                  <Text style={styles.guaranteePillText}>Fast Settlement</Text>
                </View>
              </View>
            </LinearGradient>

            {/* 2. Redesigned 4-Metric Grid */}
            <View style={styles.statsGrid}>
              {/* Active */}
              <View style={styles.statCard}>
                <View style={styles.statTopRow}>
                  <View
                    style={[
                      styles.statIconWrap,
                      { backgroundColor: "rgba(200, 164, 74, 0.12)" },
                    ]}
                  >
                    <Ionicons name="hourglass-outline" size={16} color="#85651b" />
                  </View>
                  <Text style={styles.statBadgeText}>IN LOGISTICS</Text>
                </View>
                <Text style={styles.statNumber}>{activeCount}</Text>
                <Text style={styles.statLabel}>Active Returns</Text>
                <Text style={styles.statSub}>Awaiting intake</Text>
              </View>

              {/* Refunded */}
              <View style={styles.statCard}>
                <View style={styles.statTopRow}>
                  <View
                    style={[
                      styles.statIconWrap,
                      { backgroundColor: "rgba(22, 101, 52, 0.12)" },
                    ]}
                  >
                    <Ionicons name="card-outline" size={16} color="#15803d" />
                  </View>
                  <Text style={[styles.statBadgeText, { color: "#15803d" }]}>
                    SETTLED
                  </Text>
                </View>
                <Text style={styles.statNumber}>{counts.refunded}</Text>
                <Text style={styles.statLabel}>Refunded</Text>
                <Text style={styles.statSub}>Credited to account</Text>
              </View>

              {/* Rejected */}
              <View style={styles.statCard}>
                <View style={styles.statTopRow}>
                  <View
                    style={[
                      styles.statIconWrap,
                      { backgroundColor: "rgba(220, 38, 38, 0.1)" },
                    ]}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
                  </View>
                  <Text style={[styles.statBadgeText, { color: "#dc2626" }]}>
                    DECLINED
                  </Text>
                </View>
                <Text style={styles.statNumber}>{counts.rejected}</Text>
                <Text style={styles.statLabel}>Rejected</Text>
                <Text style={styles.statSub}>Policy exceptions</Text>
              </View>

              {/* Lifetime */}
              <View style={styles.statCard}>
                <View style={styles.statTopRow}>
                  <View
                    style={[
                      styles.statIconWrap,
                      { backgroundColor: "rgba(83, 94, 44, 0.12)" },
                    ]}
                  >
                    <Ionicons name="archive-outline" size={16} color="#414b22" />
                  </View>
                  <Text style={[styles.statBadgeText, { color: "#414b22" }]}>
                    ARCHIVE
                  </Text>
                </View>
                <Text style={styles.statNumber}>{counts.all}</Text>
                <Text style={styles.statLabel}>Lifetime</Text>
                <Text style={styles.statSub}>Total logged cases</Text>
              </View>
            </View>

            {/* 3. Luxury Search Bar */}
            <View style={styles.searchBarWrap}>
              <Ionicons name="search" size={16} color={colors.light.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by return #, order #, or item…"
                placeholderTextColor={colors.light.mutedForeground}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                clearButtonMode="never"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            {/* 4. Filter Tabs Ribbon */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {(
                [
                  "all",
                  "requested",
                  "approved",
                  "received",
                  "refunded",
                  "rejected",
                ] as Tab[]
              ).map((t) => {
                const isActive = tab === t;
                const label = t === "all" ? "All" : STATUS_CONFIG[t].label;
                const count = counts[t];

                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                    onPress={() => setTab(t)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tabPillText,
                        isActive && styles.tabPillTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                    <View
                      style={[
                        styles.tabCountBadge,
                        isActive && styles.tabCountBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabCountBadgeText,
                          isActive && styles.tabCountBadgeTextActive,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 5. Returns List or Luxury Empty State */}
            {filteredReturns.length === 0 ? (
              <View style={styles.emptyContainer}>
                {query.trim().length > 0 ? (
                  /* Search Miss Empty */
                  <View style={styles.emptyCard}>
                    <Ionicons
                      name="search-outline"
                      size={36}
                      color={colors.light.mutedForeground}
                    />
                    <Text style={styles.emptyTitle}>No Matching Returns</Text>
                    <Text style={styles.emptySubtitle}>
                      No return cases match &quot;{query}&quot;. Check the return or order number and try again.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyResetBtn}
                      onPress={() => {
                        setQuery("");
                        setTab("all");
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.emptyResetBtnText}>Reset Filter</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Zero Returns Empty State */
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyMedallion}>
                      <Ionicons name="refresh" size={30} color="#C8A44A" />
                    </View>
                    <Text style={styles.emptyTitle}>No Active Returns</Text>
                    <Text style={styles.emptySubtitle}>
                      All your curated acquisitions are resting in your collection. If a piece doesn&apos;t meet your standards, initiate a return from your delivered orders within 14 days.
                    </Text>

                    <View style={styles.emptyActionsRow}>
                      <TouchableOpacity
                        style={styles.browseOrdersBtn}
                        activeOpacity={0.88}
                        onPress={() => router.push("/(main)/account/orders" as any)}
                      >
                        <Text style={styles.browseOrdersBtnText}>
                          VIEW DELIVERED ORDERS
                        </Text>
                        <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 6. Concierge Return Promises Card */}
                <View style={styles.promisesCard}>
                  <View style={styles.promisesHeader}>
                    <Ionicons name="sparkles" size={13} color="#85651b" />
                    <Text style={styles.promisesEyebrow}>
                      ATELIER CONCIERGE PROMISES
                    </Text>
                  </View>
                  <Text style={styles.promisesTitle}>Effortless Reverse Logistics</Text>

                  <View style={styles.promiseItem}>
                    <View style={styles.promiseIconBox}>
                      <Ionicons name="car-outline" size={16} color="#85651b" />
                    </View>
                    <View style={styles.promiseContent}>
                      <Text style={styles.promiseHeading}>
                        Complimentary Doorstep Pickup
                      </Text>
                      <Text style={styles.promiseDesc}>
                        Our insured couriers collect the package directly from your address at no extra cost.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.promiseItem}>
                    <View style={styles.promiseIconBox}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#85651b" />
                    </View>
                    <View style={styles.promiseContent}>
                      <Text style={styles.promiseHeading}>
                        24-Hour Atelier Verification
                      </Text>
                      <Text style={styles.promiseDesc}>
                        Specialists review condition and authenticity within 24 hours of warehouse arrival.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.promiseItem}>
                    <View style={styles.promiseIconBox}>
                      <Ionicons name="wallet-outline" size={16} color="#85651b" />
                    </View>
                    <View style={styles.promiseContent}>
                      <Text style={styles.promiseHeading}>
                        Direct Settlement Guarantee
                      </Text>
                      <Text style={styles.promiseDesc}>
                        Funds are promptly credited back to your original payment card or digital wallet.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              /* Populated Returns List */
              <View style={styles.listWrap}>
                {filteredReturns.map((item) => {
                  const cfg = STATUS_CONFIG[item.status];
                  return (
                    <TouchableOpacity
                      key={item.return_group_id}
                      style={styles.returnCard}
                      onPress={() =>
                        router.push(
                          `/(main)/account/returns/${item.return_group_id}` as any
                        )
                      }
                      activeOpacity={0.9}
                    >
                      {/* Return Card Header */}
                      <View style={styles.returnCardHeader}>
                        <View style={styles.returnCardHeaderLeft}>
                          <View style={styles.returnTagBadge}>
                            <Text style={styles.returnTagText}>
                              RET · #{item.return_number}
                            </Text>
                          </View>
                          <Text style={styles.returnOrderRef}>
                            Order #{item.order_number}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: cfg.bg,
                              borderColor: cfg.border,
                            },
                          ]}
                        >
                          <Ionicons name={cfg.icon} size={11} color={cfg.fg} />
                          <Text style={[styles.statusBadgeText, { color: cfg.fg }]}>
                            {cfg.label}
                          </Text>
                        </View>
                      </View>

                      {/* Item Details */}
                      <View style={styles.returnItemsSection}>
                        {item.items.slice(0, 2).map((prod, idx) => (
                          <View key={idx} style={styles.returnItemRow}>
                            <View style={styles.returnItemDot} />
                            <Text style={styles.returnItemName} numberOfLines={1}>
                              {prod.product_name}
                              {prod.variant_label
                                ? ` · ${prod.variant_label}`
                                : ""}
                            </Text>
                            <Text style={styles.returnItemQty}>
                              ×{prod.quantity}
                            </Text>
                          </View>
                        ))}
                        {item.items.length > 2 && (
                          <Text style={styles.moreItemsText}>
                            +{item.items.length - 2} additional pieces
                          </Text>
                        )}
                      </View>

                      {/* Reason Tag */}
                      {item.reason ? (
                        <View style={styles.reasonTagRow}>
                          <Text style={styles.reasonLabel}>Reason:</Text>
                          <Text style={styles.reasonValue} numberOfLines={1}>
                            {item.reason}
                          </Text>
                        </View>
                      ) : null}

                      {/* Footer Settlement & Action */}
                      <View style={styles.returnCardFooter}>
                        <View style={styles.settlementCol}>
                          <Text style={styles.settlementLabel}>REFUND VALUE</Text>
                          <Text style={styles.settlementAmount}>
                            {formatPrice(item.refund_amount, item.currency)}
                          </Text>
                        </View>

                        <View style={styles.returnCardActionCol}>
                          <Text style={styles.returnDateText}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </Text>
                          <View style={styles.returnActionArrowBtn}>
                            <Ionicons
                              name="arrow-forward"
                              size={12}
                              color="#181b12"
                            />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* 7. Return Policy Detail Modal */}
        <Modal
          visible={showPolicyModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPolicyModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>ATELIER STANDARDS</Text>
                  <Text style={styles.modalTitle}>Return & Refund Policy</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPolicyModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={18} color={colors.light.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.policyBullet}>
                  <Ionicons name="checkmark-circle" size={16} color="#85651b" />
                  <View style={styles.policyBulletContent}>
                    <Text style={styles.policyBulletTitle}>
                      14-Day Complimentary Window
                    </Text>
                    <Text style={styles.policyBulletDesc}>
                      You may initiate a return within 14 calendar days from the moment your order is marked as delivered.
                    </Text>
                  </View>
                </View>

                <View style={styles.policyBullet}>
                  <Ionicons name="checkmark-circle" size={16} color="#85651b" />
                  <View style={styles.policyBulletContent}>
                    <Text style={styles.policyBulletTitle}>
                      Pristine Atelier Condition
                    </Text>
                    <Text style={styles.policyBulletDesc}>
                      Garments and accessories must remain unworn, unwashed, with all designer tags and authenticity seals attached.
                    </Text>
                  </View>
                </View>

                <View style={styles.policyBullet}>
                  <Ionicons name="checkmark-circle" size={16} color="#85651b" />
                  <View style={styles.policyBulletContent}>
                    <Text style={styles.policyBulletTitle}>
                      Original Luxury Packaging
                    </Text>
                    <Text style={styles.policyBulletDesc}>
                      Please pack the items in their original garment bags, dustbags, and protective outer boxes.
                    </Text>
                  </View>
                </View>

                <View style={styles.policyBullet}>
                  <Ionicons name="checkmark-circle" size={16} color="#85651b" />
                  <View style={styles.policyBulletContent}>
                    <Text style={styles.policyBulletTitle}>
                      Immediate Reimbursement
                    </Text>
                    <Text style={styles.policyBulletDesc}>
                      Upon verification at our inspection center, refunds are initiated immediately to your original payment method within 3–5 business days.
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCtaBtn}
                onPress={() => setShowPolicyModal(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalCtaBtnText}>UNDERSTOOD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </PaperBackground>
  );
}

/* =========================================================================
   Styles
   ========================================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },

  /* Navigation Bar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navTitleWrap: {
    alignItems: "center",
  },
  navTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.light.foreground,
    textTransform: "uppercase",
  },
  navSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#85651b",
    marginTop: 1,
    letterSpacing: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: 40,
  },

  /* 1. Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    marginBottom: spacing[4],
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
  policyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  policyPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#E8CF8F",
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.72)",
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  guaranteeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  guaranteePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
  },
  guaranteePillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#ffffff",
    letterSpacing: 0.5,
  },

  /* 2. Metrics Grid */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: spacing[4],
  },
  statCard: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  statTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: "#85651b",
    letterSpacing: 0.6,
  },
  statNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
    marginTop: 2,
  },
  statSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },

  /* 3. Search Bar */
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.09)",
    gap: 10,
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.foreground,
  },

  /* 4. Filter Tabs Ribbon */
  tabsRow: {
    gap: 8,
    paddingBottom: spacing[4],
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
  },
  tabPillActive: {
    backgroundColor: "#181b12",
    borderColor: "#181b12",
  },
  tabPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  tabPillTextActive: {
    color: "#ffffff",
    fontFamily: fontFamilies.mono.semibold,
  },
  tabCountBadge: {
    backgroundColor: "rgba(22, 23, 15, 0.06)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  tabCountBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: colors.light.mutedForeground,
  },
  tabCountBadgeTextActive: {
    color: "#ffffff",
  },

  /* 5. Empty State */
  emptyContainer: {
    gap: 16,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[7],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  emptyMedallion: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: colors.light.foreground,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 300,
  },
  emptyActionsRow: {
    marginTop: 18,
  },
  browseOrdersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#181b12",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: radii.full,
    ...shadows.soft,
  },
  browseOrdersBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#ffffff",
    letterSpacing: 1,
  },
  emptyResetBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "#181b12",
  },
  emptyResetBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
  },

  /* 6. Concierge Promises */
  promisesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
    gap: 14,
  },
  promisesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  promisesEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  promisesTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16.5,
    color: colors.light.foreground,
    marginTop: -4,
  },
  promiseItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  promiseIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  promiseContent: {
    flex: 1,
    gap: 2,
  },
  promiseHeading: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  promiseDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },

  /* Populated Returns List */
  listWrap: {
    gap: 12,
  },
  returnCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
    gap: 12,
  },
  returnCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  returnCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  returnTagBadge: {
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  returnTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 0.5,
  },
  returnOrderRef: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  returnItemsSection: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
    gap: 6,
  },
  returnItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  returnItemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C8A44A",
  },
  returnItemName: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  returnItemQty: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  moreItemsText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
    marginLeft: 10,
  },
  reasonTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reasonLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  reasonValue: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.foreground,
  },
  returnCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  settlementCol: {
    gap: 1,
  },
  settlementLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.8,
  },
  settlementAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: "#85651b",
  },
  returnCardActionCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  returnDateText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  returnActionArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22, 23, 15, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* 7. Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[5],
  },
  modalContainer: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: spacing[6],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.editorial,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  modalEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  modalTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: colors.light.foreground,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(22, 23, 15, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    marginBottom: spacing[5],
  },
  policyBullet: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  policyBulletContent: {
    flex: 1,
    gap: 2,
  },
  policyBulletTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  policyBulletDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 17,
  },
  modalCtaBtn: {
    backgroundColor: "#181b12",
    borderRadius: radii.full,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCtaBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
});
