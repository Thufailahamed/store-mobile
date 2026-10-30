import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { cancelReturn, getReturnByGroupId, type MobileReturnRequest } from "@/lib/api";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { C, DottedRail, ParcelArt, routeStyles, shortDate } from "@/components/orders/parcel-track";
import { DetailTopBar, MenuSheet, type MenuItem } from "@/components/orders/detail-chrome";
import {
  RETURN_ICONS,
  RETURN_RIBBON,
  RETURN_TONE,
  returnRailLabel,
  returnStage,
} from "@/components/orders/return-track";

export default function ReturnDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [returnReq, setReturnReq] = useState<MobileReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * Mobile parity with web: the buyer can cancel a return as long as
   * the seller hasn't received the items yet. Calls
   * /api/returns/[id]/cancel → cancel_return_by_buyer (0141) so the
   * cancel logic can't be bypassed via a direct UPDATE.
   */
  async function handleCancel() {
    if (!returnReq) return;
    if (returnReq.status !== "requested" && returnReq.status !== "approved") return;
    Alert.alert(
      "Cancel return?",
      "This will close the return request. The seller will be notified.",
      [
        { text: "Keep return", style: "cancel" },
        {
          text: "Cancel return",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              const res = await cancelReturn(returnReq.return_group_id);
              if (!res.ok) {
                Alert.alert("Couldn't cancel", res.error ?? "Please try again.");
                return;
              }
              // Refresh the local view so the status pill flips to "rejected".
              setReturnReq((prev) =>
                prev ? { ...prev, status: "rejected" as const } : prev
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  const loadReturn = useCallback(() => {
    if (!user?.id || !id) return;
    const userId = user.id;
    const groupId = id as string;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    getReturnByGroupId(userId, groupId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        // res.data is null when the return genuinely doesn't exist — kept
        // distinct from a fetch failure (res.ok === false) below.
        setReturnReq(res.data);
      } else {
        setFetchError(res.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, id]);

  useEffect(() => {
    const cleanup = loadReturn();
    return cleanup;
  }, [loadReturn]);

  if (loading || !returnReq) {
    return (
      <View style={styles.root}>
        <LinearGradient
          pointerEvents="none"
          colors={[C.glow, C.glowSoft, C.paper]}
          locations={[0, 0.55, 1]}
          style={styles.glow}
        />
        <SafeAreaView style={styles.flex} edges={["top"]}>
          <DetailTopBar title="Return Details" onBack={() => router.back()} />
          <View style={styles.loadingContainer}>
            {loading ? (
              <View style={{ width: "100%", gap: 14 }}>
                <Skeleton height={90} borderRadius={24} />
                <Skeleton height={64} borderRadius={20} />
                <Skeleton height={240} borderRadius={26} />
              </View>
            ) : (
              <>
                <Ionicons name={fetchError ? "cloud-offline-outline" : "help-circle-outline"} size={26} color={C.muted} />
                <Text style={styles.loadingText}>
                  {fetchError ? "Couldn't load this return." : "Return not found."}
                </Text>
                {fetchError ? (
                  <TouchableOpacity style={styles.retryBtn} onPress={loadReturn} activeOpacity={0.85}>
                    <Text style={styles.retryBtnText}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const r = returnReq;
  const tone = RETURN_TONE[r.status];
  const ribbon = RETURN_RIBBON[r.status];
  const canCancel = r.status === "requested" || r.status === "approved";
  const units = r.items.reduce((n, i) => n + i.quantity, 0);

  const openSupport = () =>
    router.push({
      pathname: "/(main)/contact",
      params: {
        subject: `Return #${r.return_number}`,
        message: `I need help with return #${r.return_number} (order #${r.order_number}).`,
      },
    } as never);
  const openPickup = () =>
    router.push({ pathname: "/(main)/account/returns/[id]/pickup", params: { id: r.return_group_id } } as never);
  const openLabel = () =>
    router.push({ pathname: "/(main)/account/returns/[id]/label", params: { id: r.return_group_id } } as never);

  const menu: MenuItem[] = [
    ...(r.status === "approved"
      ? [
          { icon: "navigate-outline" as const, label: "Track pickup", onPress: openPickup },
          { icon: "print-outline" as const, label: "Prepaid return label", onPress: openLabel },
        ]
      : []),
    { icon: "headset-outline", label: "Contact support", onPress: openSupport },
    ...(canCancel
      ? [{ icon: "close-circle-outline" as const, label: "Cancel return", onPress: handleCancel, danger: true }]
      : []),
  ];

  let refundSub: string;
  if (r.status === "refunded") refundSub = `Refunded ${shortDate(r.updated_at)}`;
  else if (r.status === "rejected") refundSub = "Not refunded";
  else refundSub = "3–5 days after inspection";

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.55, 1]}
        style={styles.glow}
      />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <DetailTopBar title="Return Details" onBack={() => router.back()} onMore={() => setMenuOpen(true)} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.itemsHead}>
            <Text style={styles.itemsKicker}>IN THIS RETURN</Text>
            <Text style={styles.itemsCount}>
              {units} piece{units === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.itemsCard}>
            {r.items.map((item, i) => (
              <Animated.View
                key={item.order_item_id}
                entering={FadeInDown.delay(i * 60).duration(380)}
                style={[styles.itemRow, i > 0 && styles.itemRowDivider]}
              >
                <View style={styles.itemThumb}>
                  <MaterialCommunityIcons name="hanger" size={24} color={C.goldSoft} />
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                  <View style={styles.itemMeta}>
                    {item.variant_label ? (
                      <View style={styles.variantChip}>
                        <Text style={styles.variantChipText} numberOfLines={1}>{item.variant_label}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.unitText}>Qty {item.quantity}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.itemPrice}>{formatPrice(item.refund_amount, r.currency)}</Text>
                  <Text style={styles.itemPriceSub}>refund</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.orderRow}>
              <View style={styles.orderAvatar}>
                <MaterialCommunityIcons name="shopping-outline" size={22} color={C.goldSoft} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.orderKicker}>Return for order</Text>
                <Text style={styles.orderName} numberOfLines={1}>#{r.order_number}</Text>
              </View>
              {r.status === "approved" ? (
                <TouchableOpacity
                  style={styles.roundDark}
                  onPress={openLabel}
                  activeOpacity={0.85}
                  accessibilityLabel="Prepaid return label"
                >
                  <Ionicons name="print-outline" size={18} color={C.cream} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.roundDark}
                onPress={openSupport}
                activeOpacity={0.85}
                accessibilityLabel="Contact support"
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={C.cream} />
              </TouchableOpacity>
            </View>

            <View style={styles.statusBar}>
              <View style={[styles.statusDot, { backgroundColor: r.status === "rejected" ? C.rust : C.ink }]} />
              <Text style={styles.statusText} numberOfLines={1}>{tone.line}</Text>
              <Text style={styles.statusRight}>{shortDate(r.updated_at)}</Text>
            </View>

            <View style={styles.bookShadow}>
              <View style={styles.book}>
                <ParcelArt />
                <View style={styles.bookTop}>
                  <Text style={styles.bookLabel}>Return</Text>
                  <View style={[styles.bookPill, { backgroundColor: ribbon.bg }]}>
                    <Text style={[styles.bookPillText, { color: ribbon.fg }]}>{tone.label}</Text>
                  </View>
                </View>
                <Text style={styles.bookNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {r.return_number}
                </Text>

                <DottedRail
                  stage={returnStage(r.status)}
                  icons={RETURN_ICONS}
                  finished={r.status === "refunded"}
                  closed={r.status === "rejected"}
                  label={returnRailLabel(r.status)}
                />

                <View style={routeStyles.route}>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>REQUESTED</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>{shortDate(r.created_at)}</Text>
                    <Text style={routeStyles.routeSub} numberOfLines={1}>
                      {r.received_at ? `Received ${shortDate(r.received_at)}` : "Awaiting pickup"}
                    </Text>
                  </View>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>REFUND TO</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>Original payment</Text>
                    <Text style={routeStyles.routeSub} numberOfLines={1}>{refundSub}</Text>
                  </View>
                </View>
                <View style={[routeStyles.route, { marginTop: 14 }]}>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>REFUND VALUE</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>
                      {formatPrice(r.refund_amount, r.currency)}
                    </Text>
                  </View>
                  <View style={routeStyles.routeCol}>
                    <Text style={routeStyles.routeLabel}>REASON</Text>
                    <Text style={routeStyles.routeValue} numberOfLines={1}>{r.reason || "—"}</Text>
                  </View>
                </View>
              </View>
            </View>

            {r.status === "approved" ? (
              <>
                <TouchableOpacity
                  style={styles.trackCta}
                  onPress={openPickup}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Track return pickup"
                >
                  <View style={styles.trackCtaIcon}>
                    <Ionicons name="navigate" size={16} color={C.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trackCtaTitle}>Track pickup</Text>
                    <Text style={styles.trackCtaSub}>See when the courier collects it</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={17} color={C.lime} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={openLabel} activeOpacity={0.85}>
                  <Ionicons name="print-outline" size={16} color={C.text} />
                  <Text style={styles.outlineBtnText}>Prepaid return label</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {r.seller_note ? (
              <View style={styles.block}>
                <View style={styles.noteHead}>
                  <Ionicons name="chatbubble-outline" size={15} color={C.accent} />
                  <Text style={styles.blockTitle}>Seller note</Text>
                </View>
                <Text style={styles.noteBody}>{r.seller_note}</Text>
              </View>
            ) : null}

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Refund summary</Text>
              <View style={styles.ledger}>
                {r.items.map((it) => (
                  <View key={it.order_item_id} style={styles.ledgerLine}>
                    <Text style={styles.ledgerLabel} numberOfLines={1}>
                      {it.product_name} ×{it.quantity}
                    </Text>
                    <Text style={styles.ledgerValue}>{formatPrice(it.refund_amount, r.currency)}</Text>
                  </View>
                ))}
                <View style={styles.ledgerTotal}>
                  <Text style={styles.ledgerTotalLabel}>Total refund</Text>
                  <Text style={styles.ledgerTotalValue}>{formatPrice(r.refund_amount, r.currency)}</Text>
                </View>
              </View>
            </View>

            {canCancel ? (
              <TouchableOpacity
                style={styles.cancelRow}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.75}
              >
                <Ionicons name="close-circle-outline" size={16} color={C.rust} />
                <Text style={styles.cancelText}>{cancelling ? "Cancelling…" : "Cancel this return"}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ height: Math.max(insets.bottom, 16) + 16 }} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <MenuSheet open={menuOpen} items={menu} onClose={() => setMenuOpen(false)} bottom={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },

  loadingContainer: { flex: 1, alignItems: "center", paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted },
  retryBtn: { marginTop: 4, height: 42, paddingHorizontal: 20, borderRadius: 21, backgroundColor: C.ink, justifyContent: "center" },
  retryBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.cream },

  scroll: { flexGrow: 1, paddingTop: 6 },

  itemsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  itemsKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  itemsCount: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },

  itemsCard: {
    marginHorizontal: 20,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  itemRowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: { flex: 1, minWidth: 0, gap: 4 },
  itemName: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  variantChip: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    backgroundColor: C.accentSoft,
    maxWidth: 140,
  },
  variantChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },
  unitText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  itemPrice: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text, fontVariant: ["tabular-nums"] },
  itemPriceSub: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: C.muted },

  sheet: {
    flex: 1,
    marginTop: 22,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 8,
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#e2e0d6", marginBottom: 16 },

  orderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.goldSoft,
  },
  orderKicker: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },
  orderName: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text, marginTop: 1 },
  roundDark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },

  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#efede4",
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
  statusRight: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },

  bookShadow: {
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  book: {
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  bookTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.muted },
  bookPill: { height: 30, paddingHorizontal: 14, borderRadius: 15, justifyContent: "center" },
  bookPillText: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5 },
  bookNumber: { marginTop: 6, fontFamily: fontFamilies.sans.bold, fontSize: 26, letterSpacing: -0.6, color: C.text },

  trackCta: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  trackCtaIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  trackCtaTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },
  trackCtaSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(250,248,241,0.6)", marginTop: 1 },
  outlineBtn: {
    marginTop: 10,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
  },
  outlineBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text },

  block: {
    marginTop: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#faf9f4",
    borderWidth: 1,
    borderColor: C.line,
  },
  blockTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, letterSpacing: -0.2, color: C.text },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  noteBody: { marginTop: 8, fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted },
  ledger: { marginTop: 14, gap: 10 },
  ledgerLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  ledgerLabel: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted },
  ledgerValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text, fontVariant: ["tabular-nums"] },
  ledgerTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  ledgerTotalLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.text },
  ledgerTotalValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.4, color: C.text, fontVariant: ["tabular-nums"] },

  cancelRow: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 48 },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.rust },
});
