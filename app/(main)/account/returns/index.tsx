import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { getReturns, type MobileReturnRequest } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import {
  C,
  DottedRail,
  ParcelArt,
  routeStyles,
  shortDate,
} from "@/components/orders/parcel-track";
import {
  RETURN_ICONS,
  RETURN_RIBBON,
  RETURN_TONE,
  returnRailLabel,
  returnStage,
  type ReturnStatus,
} from "@/components/orders/return-track";

type Tab = "all" | "active" | "refunded" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "In Progress" },
  { key: "refunded", label: "Refunded" },
  { key: "rejected", label: "Declined" },
];

const ACTIVE: ReturnStatus[] = ["requested", "approved", "received"];

function inTab(status: ReturnStatus, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "active") return ACTIVE.includes(status);
  return status === tab;
}

const POLICY: { title: string; desc: string }[] = [
  {
    title: "14-day window",
    desc: "Start a return within 14 calendar days of your order being marked delivered.",
  },
  {
    title: "Unworn, tags attached",
    desc: "Pieces must be unworn and unwashed, with all designer tags and authenticity seals attached.",
  },
  {
    title: "Original packaging",
    desc: "Pack items in their original garment bags, dust bags and outer boxes.",
  },
  {
    title: "Refund to original payment",
    desc: "Once inspected, refunds go back to your original payment method within 3–5 business days.",
  },
];

export default function ReturnsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [returns, setReturns] = useState<MobileReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);

  const fetchReturnsData = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      try {
        const res = await getReturns(user.id);
        if (res.ok) setReturns(res.data);
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    fetchReturnsData();
  }, [fetchReturnsData]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, refunded: 0, rejected: 0 } as Record<
      Tab,
      number
    >;
    for (const r of returns)
      for (const t of TABS) if (inTab(r.status, t.key)) c[t.key] += 1;
    return c;
  }, [returns]);

  const filtered = useMemo(() => {
    let list = returns.filter((r) => inTab(r.status, tab));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.return_number.toLowerCase().includes(q) ||
          r.order_number.toLowerCase().includes(q) ||
          r.items.some((i) => i.product_name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [returns, tab, query]);

  const refundedTotal = useMemo(
    () =>
      returns
        .filter((r) => r.status === "refunded")
        .reduce((s, r) => s + (Number(r.refund_amount) || 0), 0),
    [returns],
  );
  const refundCurrency = returns.find((r) => r.status === "refunded")?.currency;
  const visibleTabs = TABS.filter((t) => t.key === "all" || counts[t.key] > 0);

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.headerGlow}
      />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">
            Returns
          </Text>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => setPolicyOpen(true)}
            activeOpacity={0.8}
            accessibilityLabel="Return policy"
          >
            <Ionicons name="document-text-outline" size={19} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchReturnsData(true)}
              tintColor={C.accent}
            />
          }
        >
          {returns.length > 0 ? (
            <>
              <View style={styles.search}>
                <Ionicons name="search-outline" size={20} color={C.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search return, order or item"
                  placeholderTextColor="#A1A1A6"
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setQuery("")}
                    hitSlop={8}
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle" size={18} color={C.faint} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsRow}
              >
                {visibleTabs.map((t) => {
                  const on = tab === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => setTab(t.key)}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {t.label}
                      </Text>
                      <View
                        style={[styles.chipCount, on && styles.chipCountOn]}
                      >
                        <Text
                          style={[
                            styles.chipCountText,
                            on && styles.chipCountTextOn,
                          ]}
                        >
                          {counts[t.key]}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {refundedTotal > 0 && refundCurrency ? (
            <View style={styles.refundStrip}>
              <View style={styles.refundStripIcon}>
                <MaterialCommunityIcons
                  name="cash-refund"
                  size={18}
                  color={C.lime}
                />
              </View>
              <Text style={styles.refundStripLabel}>Total refunded</Text>
              <Text style={styles.refundStripValue}>
                {formatPrice(refundedTotal, refundCurrency)}
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={232} borderRadius={26} />
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyArt}>
                <MaterialCommunityIcons
                  name="keyboard-return"
                  size={34}
                  color={C.accent}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {returns.length ? "No returns here" : "No returns yet"}
              </Text>
              <Text style={styles.emptySub}>
                {returns.length
                  ? "Try another filter or search for a different return number."
                  : "If a piece isn’t quite right, start a return from any delivered order within 14 days."}
              </Text>
              {returns.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push("/(main)/account/orders" as never)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyBtnText}>View my orders</Text>
                  <Ionicons name="arrow-forward" size={15} color={C.lime} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setPolicyOpen(true)}
                hitSlop={8}
                style={{ marginTop: 6 }}
              >
                <Text style={styles.policyLink}>How returns work</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((r, i) => (
                <Animated.View
                  key={r.return_group_id}
                  entering={FadeInDown.delay(Math.min(i, 6) * 70).duration(420)}
                >
                  <ReturnCard
                    ret={r}
                    onPress={() =>
                      router.push(
                        `/(main)/account/returns/${r.return_group_id}` as never,
                      )
                    }
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={policyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPolicyOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setPolicyOpen(false)}
          accessibilityLabel="Close policy"
        />
        <View
          style={[
            styles.policySheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <View style={styles.grabber} />
          <Text style={styles.policyTitle}>Return policy</Text>
          {POLICY.map((p, i) => (
            <View key={p.title} style={styles.policyRow}>
              <View style={styles.policyNum}>
                <Text style={styles.policyNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyRowTitle}>{p.title}</Text>
                <Text style={styles.policyRowDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.policyBtn}
            onPress={() => setPolicyOpen(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.policyBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function ReturnCard({
  ret: r,
  onPress,
}: {
  ret: MobileReturnRequest;
  onPress: () => void;
}) {
  const ribbon = RETURN_RIBBON[r.status];
  const first = r.items[0];
  const units = r.items.reduce((n, i) => n + i.quantity, 0);
  const more = r.items.length - 1;

  let toSub: string;
  if (r.status === "refunded") toSub = `Refunded ${shortDate(r.updated_at)}`;
  else if (r.status === "rejected") toSub = "Not refunded";
  else toSub = "3–5 days after inspection";

  return (
    <View style={styles.cardShadow}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Return ${r.return_number}, ${RETURN_TONE[r.status].label}`}
      >
        <ParcelArt />
        <View pointerEvents="none" style={styles.ribbonClip}>
          <View style={[styles.ribbon, { backgroundColor: ribbon.bg }]}>
            <Text
              style={[styles.ribbonText, { color: ribbon.fg }]}
              numberOfLines={1}
            >
              {ribbon.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardHead}>
          <View style={styles.thumb}>
            <MaterialCommunityIcons
              name="keyboard-return"
              size={24}
              color={C.goldSoft}
            />
            {more > 0 ? (
              <View style={styles.moreBadge}>
                <Text style={styles.moreBadgeText}>+{more}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headText}>
            <Text style={styles.retId} numberOfLines={1}>
              ID: {r.return_number}
            </Text>
            <Text style={styles.productName} numberOfLines={1}>
              {first?.product_name ?? "Return"}
            </Text>
            <Text style={styles.metaLine} numberOfLines={1}>
              Refund {formatPrice(r.refund_amount, r.currency)} · {units} item
              {units === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <DottedRail
          stage={returnStage(r.status)}
          icons={RETURN_ICONS}
          finished={r.status === "refunded"}
          closed={r.status === "rejected"}
          label={returnRailLabel(r.status)}
        />

        <View style={routeStyles.route}>
          <View style={routeStyles.routeCol}>
            <Text style={routeStyles.routeLabel}>FROM ORDER</Text>
            <Text style={routeStyles.routeValue} numberOfLines={1}>
              #{r.order_number.replace(/^LX-/, "")}
            </Text>
            <Text style={routeStyles.routeSub} numberOfLines={1}>
              {shortDate(r.created_at)}
            </Text>
          </View>
          <View style={routeStyles.routeCol}>
            <Text style={routeStyles.routeLabel}>REFUND TO</Text>
            <Text style={routeStyles.routeValue} numberOfLines={1}>
              Original payment
            </Text>
            <Text style={routeStyles.routeSub} numberOfLines={1}>
              {toSub}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    letterSpacing: -0.8,
    color: C.text,
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },

  content: { paddingHorizontal: 20, paddingTop: 4 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: C.text,
    padding: 0,
  },

  chipsScroll: { marginHorizontal: -20, marginTop: 18, marginBottom: 18 },
  chipsRow: { paddingHorizontal: 20, gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: C.text,
  },
  chipTextOn: { color: C.cream },
  chipCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  chipCountOn: { backgroundColor: "rgba(200,224,138,0.18)" },
  chipCountText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: C.muted,
  },
  chipCountTextOn: { color: C.lime },

  refundStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 56,
    paddingHorizontal: 10,
    paddingRight: 18,
    borderRadius: 28,
    backgroundColor: C.ink,
    marginBottom: 16,
  },
  refundStripIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,224,138,0.14)",
  },
  refundStripLabel: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13.5,
    color: "rgba(250,248,241,0.7)",
  },
  refundStripValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    color: C.cream,
    fontVariant: ["tabular-nums"],
  },

  list: { gap: 16 },

  cardShadow: {
    borderRadius: 26,
    backgroundColor: C.card,
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  card: {
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
  },
  cardPressed: { transform: [{ scale: 0.985 }] },

  ribbonClip: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 116,
    height: 116,
    overflow: "hidden",
  },
  ribbon: {
    position: "absolute",
    top: 24,
    right: -44,
    width: 170,
    paddingVertical: 6,
    alignItems: "center",
    transform: [{ rotate: "35deg" }],
  },
  ribbonText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 1.6,
  },

  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingRight: 64,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  moreBadge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    minWidth: 24,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: C.lime,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    color: C.ink,
  },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  retId: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: C.text,
  },
  productName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: C.muted,
  },
  metaLine: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: C.muted,
    marginTop: 1,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 28,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  emptyArt: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: C.text,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.ink,
  },
  emptyBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: C.cream,
  },
  policyLink: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: C.accent,
    textDecorationLine: "underline",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21,22,15,0.4)",
  },
  policySheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#e2e0d6",
    marginBottom: 16,
  },
  policyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: C.text,
    marginBottom: 6,
  },
  policyRow: { flexDirection: "row", gap: 14, paddingVertical: 12 },
  policyNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  policyNumText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: C.lime,
  },
  policyRowTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: C.text,
  },
  policyRowDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
    marginTop: 2,
  },
  policyBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.ink,
  },
  policyBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: C.cream,
  },
});
