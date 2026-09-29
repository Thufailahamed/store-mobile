import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";

const STATUS_CONFIG: Record<
  ReturnStatus,
  {
    label: string;
    bg: string;
    fg: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
  }
> = {
  requested: {
    label: "Requested",
    bg: "rgba(200, 164, 74, 0.14)",
    fg: GOLD_DEEP,
    icon: "hourglass-outline",
    description: "Under atelier review",
  },
  approved: {
    label: "Approved",
    bg: "rgba(83, 94, 44, 0.12)",
    fg: colors.olive[700],
    icon: "checkmark-circle-outline",
    description: "Ready for courier collection",
  },
  received: {
    label: "Inspecting",
    bg: "rgba(30, 64, 175, 0.09)",
    fg: "#1e40af",
    icon: "search-outline",
    description: "Atelier intake verification",
  },
  refunded: {
    label: "Refunded",
    bg: "rgba(21, 128, 61, 0.11)",
    fg: "#15803d",
    icon: "wallet-outline",
    description: "Funds credited to account",
  },
  rejected: {
    label: "Declined",
    bg: "rgba(184, 92, 58, 0.12)",
    fg: colors.accent2.rust,
    icon: "close-circle-outline",
    description: "Policy criteria not met",
  },
};

const PROGRESS_STEPS: ReturnStatus[] = ["requested", "approved", "received", "refunded"];

const HOW_IT_WORKS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: "document-text-outline", title: "Request", sub: "From a delivered order" },
  { icon: "car-outline", title: "Pickup", sub: "Collected at your door" },
  { icon: "wallet-outline", title: "Refund", sub: "To original payment" },
];

const PROMISES: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: "car-outline",
    title: "Complimentary doorstep pickup",
    desc: "Our insured couriers collect the package directly from your address at no extra cost.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "24-hour atelier verification",
    desc: "Specialists review condition and authenticity within 24 hours of warehouse arrival.",
  },
  {
    icon: "wallet-outline",
    title: "Direct settlement guarantee",
    desc: "Funds are promptly credited back to your original payment card or digital wallet.",
  },
];

const POLICY: { title: string; desc: string }[] = [
  {
    title: "14-day complimentary window",
    desc: "You may initiate a return within 14 calendar days from the moment your order is marked as delivered.",
  },
  {
    title: "Pristine atelier condition",
    desc: "Garments and accessories must remain unworn, unwashed, with all designer tags and authenticity seals attached.",
  },
  {
    title: "Original luxury packaging",
    desc: "Please pack the items in their original garment bags, dustbags, and protective outer boxes.",
  },
  {
    title: "Immediate reimbursement",
    desc: "Upon verification at our inspection center, refunds are initiated immediately to your original payment method within 3–5 business days.",
  },
];

type Tab = "all" | ReturnStatus;
const TABS: Tab[] = ["all", "requested", "approved", "received", "refunded", "rejected"];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function ReturnsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const stats: { label: string; value: number; tab: Tab }[] = [
    { label: "Active", value: activeCount, tab: "all" },
    { label: "Refunded", value: counts.refunded, tab: "refunded" },
    { label: "Declined", value: counts.rejected, tab: "rejected" },
    { label: "Lifetime", value: counts.all, tab: "all" },
  ];

  const hasReturns = returns.length > 0;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Returns</Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={onRefresh}
            disabled={refreshing}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Refresh returns"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={colors.light.foreground} />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={GOLD} size="small" />
            <Text style={styles.loadingText}>Loading your returns…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />
            }
          >
            {/* Page heading */}
            <View style={styles.pageHead}>
              <Text style={styles.eyebrow}>Concierge care</Text>
              <Text style={styles.pageTitle}>Returns & refunds</Text>
              <Text style={styles.pageSub}>
                Free doorstep pickup and refunds straight to your original payment method.
              </Text>
            </View>

            {/* How it works */}
            <LinearGradient
              colors={["#1f2418", "#14170e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroTop}>
                <View style={styles.heroBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={GOLD} />
                  <Text style={styles.heroBadgeText}>14-day guarantee</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPolicyModal(true)}
                  activeOpacity={0.7}
                  hitSlop={8}
                  style={styles.heroPolicyLink}
                  accessibilityRole="button"
                >
                  <Text style={styles.heroPolicyText}>Return policy</Text>
                  <Ionicons name="chevron-forward" size={12} color="#E8CF8F" />
                </TouchableOpacity>
              </View>

              <View style={styles.steps}>
                {HOW_IT_WORKS.map((s, i) => (
                  <React.Fragment key={s.title}>
                    <View style={styles.step}>
                      <View style={styles.stepIcon}>
                        <Ionicons name={s.icon} size={17} color={GOLD} />
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{i + 1}</Text>
                        </View>
                      </View>
                      <Text style={styles.stepTitle}>{s.title}</Text>
                      <Text style={styles.stepSub}>{s.sub}</Text>
                    </View>
                    {i < HOW_IT_WORKS.length - 1 && <View style={styles.stepConnector} />}
                  </React.Fragment>
                ))}
              </View>
            </LinearGradient>

            {/* Stats strip */}
            <View style={styles.statsStrip}>
              {stats.map((s, i) => (
                <Pressable
                  key={s.label}
                  style={[styles.statCell, i > 0 && styles.statCellDivider]}
                  onPress={() => hasReturns && setTab(s.tab)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.value} ${s.label}`}
                >
                  <Text style={[styles.statValue, s.value === 0 && styles.statValueMuted]}>
                    {s.value}
                  </Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </Pressable>
              ))}
            </View>

            {hasReturns && (
              <>
                {/* Search */}
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color={colors.light.mutedForeground} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search return #, order # or item"
                    placeholderTextColor={colors.light.mutedForeground}
                    value={query}
                    onChangeText={setQuery}
                    returnKeyType="search"
                    clearButtonMode="never"
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filters */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabsRow}
                  style={styles.tabsScroll}
                >
                  {TABS.map((t) => {
                    const isActive = tab === t;
                    const count = counts[t];
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.tab, isActive && styles.tabActive]}
                        onPress={() => setTab(t)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                          {t === "all" ? "All" : STATUS_CONFIG[t].label}
                        </Text>
                        {count > 0 && (
                          <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>
                            {count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* List / empty states */}
            {filteredReturns.length === 0 ? (
              <View style={styles.emptyWrap}>
                {hasReturns ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="search-outline" size={24} color={colors.olive[700]} />
                    </View>
                    <Text style={styles.emptyTitle}>No matching returns</Text>
                    <Text style={styles.emptySub}>
                      {query.trim()
                        ? `Nothing matches "${query.trim()}". Check the return or order number.`
                        : "No returns with this status yet."}
                    </Text>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => {
                        setQuery("");
                        setTab("all");
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryBtnText}>Clear filters</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="return-down-back-outline" size={24} color={colors.olive[700]} />
                    </View>
                    <Text style={styles.emptyTitle}>No returns yet</Text>
                    <Text style={styles.emptySub}>
                      If a piece isn&apos;t quite right, start a return from any delivered order
                      within 14 days.
                    </Text>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      activeOpacity={0.88}
                      onPress={() => router.push("/(main)/account/orders" as any)}
                    >
                      <Text style={styles.primaryBtnText}>View my orders</Text>
                      <View style={styles.primaryBtnArrow}>
                        <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {!hasReturns && (
                  <View style={styles.promises}>
                    <Text style={styles.sectionEyebrow}>Our promise</Text>
                    {PROMISES.map((p, i) => (
                      <View key={p.title} style={[styles.promiseRow, i > 0 && styles.promiseDivider]}>
                        <View style={styles.promiseIcon}>
                          <Ionicons name={p.icon} size={16} color={GOLD_DEEP} />
                        </View>
                        <View style={styles.promiseBody}>
                          <Text style={styles.promiseTitle}>{p.title}</Text>
                          <Text style={styles.promiseDesc}>{p.desc}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.list}>
                {filteredReturns.map((item) => {
                  const cfg = STATUS_CONFIG[item.status];
                  const stepIndex = PROGRESS_STEPS.indexOf(item.status);
                  return (
                    <TouchableOpacity
                      key={item.return_group_id}
                      style={styles.card}
                      onPress={() =>
                        router.push(`/(main)/account/returns/${item.return_group_id}` as any)
                      }
                      activeOpacity={0.9}
                    >
                      <View style={styles.cardHead}>
                        <View style={styles.cardHeadLeft}>
                          <Text style={styles.cardNumber}>#{item.return_number}</Text>
                          <Text style={styles.cardMeta}>
                            Order #{item.order_number} · {formatDate(item.created_at)}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                          <Ionicons name={cfg.icon} size={11} color={cfg.fg} />
                          <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
                        </View>
                      </View>

                      {/* Progress */}
                      {item.status === "rejected" ? (
                        <View style={styles.declinedNote}>
                          <Ionicons name="information-circle-outline" size={13} color={cfg.fg} />
                          <Text style={[styles.declinedText, { color: cfg.fg }]} numberOfLines={2}>
                            {item.seller_note || cfg.description}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.progressWrap}>
                          <View style={styles.progressBar}>
                            {PROGRESS_STEPS.map((s, i) => (
                              <View
                                key={s}
                                style={[
                                  styles.progressSeg,
                                  i <= stepIndex && { backgroundColor: cfg.fg },
                                ]}
                              />
                            ))}
                          </View>
                          <Text style={styles.progressCaption}>{cfg.description}</Text>
                        </View>
                      )}

                      <View style={styles.items}>
                        {item.items.slice(0, 2).map((prod, idx) => (
                          <View key={idx} style={styles.itemRow}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {prod.product_name}
                              {prod.variant_label ? (
                                <Text style={styles.itemVariant}>  {prod.variant_label}</Text>
                              ) : null}
                            </Text>
                            <Text style={styles.itemQty}>×{prod.quantity}</Text>
                          </View>
                        ))}
                        {item.items.length > 2 && (
                          <Text style={styles.moreItems}>
                            +{item.items.length - 2} more {item.items.length - 2 === 1 ? "item" : "items"}
                          </Text>
                        )}
                        {item.reason ? (
                          <Text style={styles.reason} numberOfLines={1}>
                            <Text style={styles.reasonLabel}>Reason  </Text>
                            {item.reason}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.cardFoot}>
                        <View>
                          <Text style={styles.refundLabel}>Refund value</Text>
                          <Text style={styles.refundAmount}>
                            {formatPrice(item.refund_amount, item.currency)}
                          </Text>
                        </View>
                        <View style={styles.cardArrow}>
                          <Ionicons name="arrow-forward" size={14} color={colors.light.foreground} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* Return policy sheet */}
        <Modal
          visible={showPolicyModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPolicyModal(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPolicyModal(false)}>
            <Pressable
              style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.eyebrow}>Atelier standards</Text>
                  <Text style={styles.sheetTitle}>Return policy</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPolicyModal(false)}
                  style={styles.sheetClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close policy"
                >
                  <Ionicons name="close" size={18} color={colors.light.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                {POLICY.map((p, i) => (
                  <View key={p.title} style={[styles.policyRow, i > 0 && styles.promiseDivider]}>
                    <Text style={styles.policyNum}>{String(i + 1).padStart(2, "0")}</Text>
                    <View style={styles.promiseBody}>
                      <Text style={styles.promiseTitle}>{p.title}</Text>
                      <Text style={styles.promiseDesc}>{p.desc}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.sheetCta}
                onPress={() => setShowPolicyModal(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.sheetCtaText}>Got it</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </PaperBackground>
  );
}

const HAIRLINE = "rgba(22, 23, 15, 0.08)";

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
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: colors.light.mutedForeground,
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

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[5],
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
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 320,
  },

  /* Hero / how it works */
  hero: {
    borderRadius: 24,
    padding: spacing[5],
    marginBottom: spacing[3],
    ...shadows.editorial,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[5],
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.14)",
  },
  heroBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#E8CF8F",
  },
  heroPolicyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  heroPolicyText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#E8CF8F",
  },
  steps: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  step: {
    flex: 1,
    alignItems: "center",
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    marginBottom: 10,
  },
  stepNum: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[950],
  },
  stepTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.paper.cream,
  },
  stepSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    lineHeight: 14,
    color: "rgba(250, 248, 241, 0.6)",
    textAlign: "center",
    marginTop: 2,
    paddingHorizontal: 2,
  },
  stepConnector: {
    width: 18,
    height: 1,
    marginTop: 22,
    backgroundColor: "rgba(200, 164, 74, 0.35)",
  },

  /* Stats strip */
  statsStrip: {
    flexDirection: "row",
    backgroundColor: colors.paper.cream,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: spacing[3.5],
    marginBottom: spacing[5],
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statCellDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.light.border,
  },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
  },
  statValueMuted: {
    color: colors.olive[300],
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },

  /* Search */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[4],
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: colors.light.foreground,
    padding: 0,
  },

  /* Tabs */
  tabsScroll: {
    marginHorizontal: -spacing[5],
    marginBottom: spacing[4],
  },
  tabsRow: {
    gap: 6,
    paddingHorizontal: spacing[5],
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: colors.paper.cream,
  },
  tabActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  tabText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.ink.mute,
  },
  tabTextActive: {
    color: colors.paper.cream,
  },
  tabCount: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },
  tabCountActive: {
    color: "#E8CF8F",
  },

  /* Empty */
  emptyWrap: {
    gap: spacing[4],
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
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
    height: 48,
    paddingLeft: 20,
    paddingRight: 5,
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
  secondaryBtn: {
    marginTop: spacing[4],
    paddingHorizontal: 18,
    height: 38,
    justifyContent: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },

  /* Promises */
  promises: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: spacing[1],
  },
  promiseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  promiseDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  promiseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  promiseBody: {
    flex: 1,
    gap: 3,
  },
  promiseTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  promiseDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },

  /* Return cards */
  list: {
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[4],
    gap: spacing[3.5],
    ...shadows.soft,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  cardHeadLeft: {
    flex: 1,
    gap: 2,
  },
  cardNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
  },
  cardMeta: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
  },
  progressWrap: {
    gap: 6,
  },
  progressBar: {
    flexDirection: "row",
    gap: 4,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(22, 23, 15, 0.08)",
  },
  progressCaption: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  declinedNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: spacing[2.5],
    borderRadius: radii.lg,
    backgroundColor: "rgba(184, 92, 58, 0.07)",
  },
  declinedText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  items: {
    gap: 6,
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  itemName: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  itemVariant: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.ink.mute,
  },
  itemQty: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  moreItems: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  reason: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.foreground,
    marginTop: 2,
  },
  reasonLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  refundLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  refundAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    marginTop: 1,
  },
  cardArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Policy sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(22, 23, 15, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.paper.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2.5],
    ...shadows.editorial,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.olive[200],
    alignSelf: "center",
    marginBottom: spacing[4],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing[2],
  },
  sheetTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: colors.light.foreground,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetScroll: {
    marginBottom: spacing[4],
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  policyNum: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: GOLD_DEEP,
    marginTop: 2,
    width: 20,
  },
  sheetCta: {
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCtaText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.paper.cream,
  },
});
