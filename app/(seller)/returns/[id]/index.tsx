import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerReturnByGroupId,
  decideSellerReturnGroup,
  type SellerReturnRequest,
  type SellerReturnAction,
} from "@/lib/api";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Skeleton } from "@/components/ui/Skeleton";
import { C } from "@/components/orders/parcel-track";
import { DetailTopBar } from "@/components/orders/detail-chrome";
import { formatPrice } from "@/lib/utils";
import { formatReturnStatusLabel, returnRefundAmount } from "@/lib/returns/seller-list";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  requested: { bg: C.ink, text: C.goldSoft },
  approved: { bg: colors.olive[700], text: C.lime },
  received: { bg: colors.olive[700], text: C.lime },
  refunded: { bg: C.lime, text: C.ink },
  rejected: { bg: C.rust, text: C.cream },
};

function money(n: number | null | undefined, currency = "LKR") {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPrice(n, currency);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SellerReturnDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [returnReq, setReturnReq] = useState<SellerReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState("");

  // Held in a ref as well as state: keeping `storeId` out of `load`'s deps
  // stops the resolved store from retriggering the effect and double-fetching.
  const storeIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !user) return;
    let sid = storeIdRef.current;
    if (!sid) {
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setLoadError(storeRes.ok ? "No store found" : storeRes.error);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      sid = storeRes.data.id;
      storeIdRef.current = sid;
      setStoreId(sid);
    }
    const res = await getSellerReturnByGroupId(sid, id);
    if (res.ok && res.data) {
      setReturnReq(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.ok ? "Return not found" : res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    load();
  }, [load]);

  const handleAction = (action: SellerReturnAction, label: string) => {
    if (!user || !storeId || !returnReq) return;

    const confirmCopy =
      action === "reject"
        ? "The buyer will be notified. They can contact support if needed."
        : action === "refund"
          ? `Refund ${money(returnReq.refund_amount, returnReq.currency)} to the buyer?`
          : `Mark this return as "${label}"?`;

    Alert.alert(`${label} return?`, confirmCopy, [
      { text: "Cancel", style: "cancel" },
      {
        text: label,
        style: action === "reject" ? "destructive" : "default",
        onPress: async () => {
          setActing(true);
          const res = await decideSellerReturnGroup(user.id, storeId, returnReq.return_group_id, action, {
            note: note.trim() || undefined,
          });
          setActing(false);
          if (res.ok) {
            setNote("");
            // Refresh in place — a full-screen loading flash after every
            // decision made the screen feel like it had reset.
            setRefreshing(true);
            load();
          } else {
            Alert.alert("Error", res.error);
          }
        },
      },
    ]);
  };

  const glow = (
    <LinearGradient
      pointerEvents="none"
      colors={[C.glow, C.glowSoft, C.paper]}
      locations={[0, 0.55, 1]}
      style={styles.glow}
    />
  );

  if (loading || !returnReq) {
    return (
      <View style={styles.container}>
        {glow}
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <DetailTopBar title="Return Details" onBack={() => router.back()} />
          <View style={styles.loadingContainer}>
            {loading ? (
              <View style={{ width: "100%", gap: 14 }}>
                <Skeleton height={190} borderRadius={26} />
                <Skeleton height={120} borderRadius={24} />
                <Skeleton height={220} borderRadius={24} />
              </View>
            ) : (
              <>
                <Ionicons name="cloud-offline-outline" size={26} color={C.muted} />
                <Text style={styles.errorTitle}>Couldn’t load this return</Text>
                <Text style={styles.loadingText}>{loadError ?? "Return not found"}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={retry} accessibilityRole="button">
                  <Text style={styles.retryLabel}>Try again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const sc = STATUS_COLORS[returnReq.status] ?? STATUS_COLORS.requested;
  const canApprove = returnReq.status === "requested";
  const canReject = returnReq.status === "requested";
  const canReceive = returnReq.status === "approved";
  const canRefund = returnReq.status === "approved" || returnReq.status === "received";
  const buyer = returnReq.buyer_name?.trim() || "Buyer";

  return (
    <View style={styles.container}>
      {glow}
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <DetailTopBar title="Return Details" onBack={() => router.back()} />
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
        >
          <View style={styles.bookShadow}>
            <View style={styles.book}>
              <View style={styles.bookTop}>
                <Text style={styles.bookLabel}>Return</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{formatReturnStatusLabel(returnReq.status)}</Text>
                </View>
              </View>
              <Text style={styles.returnNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {returnReq.order_number || returnReq.return_number || "Return"}
              </Text>
              <Text style={styles.date}>Requested {formatDate(returnReq.created_at)}</Text>

              <View style={styles.route}>
                <View style={styles.routeCol}>
                  <Text style={styles.routeLabel}>BUYER</Text>
                  <Text style={styles.routeValue} numberOfLines={1}>{buyer}</Text>
                </View>
                <View style={styles.routeCol}>
                  <Text style={styles.routeLabel}>REFUND</Text>
                  <Text style={styles.routeValue} numberOfLines={1}>
                    {money(returnRefundAmount(returnReq), returnReq.currency)}
                  </Text>
                </View>
              </View>

              {returnReq.order_id ? (
                <TouchableOpacity
                  style={styles.orderLink}
                  onPress={() => router.push(`/(seller)/orders/${returnReq.order_id}` as const)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Open the original order"
                >
                  <View style={styles.orderLinkIcon}>
                    <Ionicons name="receipt-outline" size={16} color={C.ink} />
                  </View>
                  <Text style={styles.orderLinkText} numberOfLines={1}>View original order</Text>
                  <Ionicons name="arrow-forward" size={16} color={C.lime} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Reason</Text>
            <Text style={styles.reason}>{returnReq.reason}</Text>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Items</Text>
            <View style={styles.ledger}>
              {returnReq.items.map((item) => (
                <View key={item.return_id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                    <View style={styles.itemMeta}>
                      {item.variant_label ? (
                        <View style={styles.variantChip}>
                          <Text style={styles.variantChipText} numberOfLines={1}>{item.variant_label}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.itemQty}>
                        Qty {item.quantity} · {money(item.unit_price, returnReq.currency)} each
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.itemRefund}>
                    {money(item.refund_amount, returnReq.currency)}
                  </Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Refund total</Text>
                <Text style={styles.totalValue}>
                  {money(returnRefundAmount(returnReq), returnReq.currency)}
                </Text>
              </View>
            </View>
          </View>

          {returnReq.seller_note ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Notes</Text>
              <Text style={styles.noteText}>{returnReq.seller_note}</Text>
            </View>
          ) : null}

          {(canApprove || canReject || canReceive || canRefund) && (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Note to buyer</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Optional — add a message the buyer will see"
                placeholderTextColor={C.muted}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          <View style={styles.actions}>
            {canApprove ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={() => handleAction("approve", "Approve")}
                disabled={acting}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={C.lime} />
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
            ) : null}
            {canReceive ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={() => handleAction("receive", "Mark received")}
                disabled={acting}
                accessibilityRole="button"
              >
                <Ionicons name="archive-outline" size={18} color={C.lime} />
                <Text style={styles.actionBtnText}>Mark received</Text>
              </TouchableOpacity>
            ) : null}
            {canRefund ? (
              <TouchableOpacity
                style={[styles.actionBtn, canReceive ? styles.secondaryBtn : styles.primaryBtn]}
                onPress={() => handleAction("refund", "Process refund")}
                disabled={acting}
                accessibilityRole="button"
              >
                <Ionicons name="card-outline" size={18} color={canReceive ? C.text : C.lime} />
                <Text style={[styles.actionBtnText, canReceive && { color: C.text }]}>Process refund</Text>
              </TouchableOpacity>
            ) : null}
            {canReject ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleAction("reject", "Reject")}
                disabled={acting}
                accessibilityRole="button"
              >
                <Ionicons name="close-circle-outline" size={18} color={C.rust} />
                <Text style={[styles.actionBtnText, { color: C.rust }]}>Reject</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {acting ? (
            <View style={styles.actingOverlay}>
              <ActivityIndicator color={C.accent} />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  scroller: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 48 },
  loadingContainer: { flex: 1, alignItems: "center", paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted, textAlign: "center" },
  errorTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text },
  retryBtn: { marginTop: 4, height: 42, paddingHorizontal: 20, borderRadius: 21, backgroundColor: C.ink, justifyContent: "center" },
  retryLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.cream },

  bookShadow: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  book: { borderRadius: 26, borderWidth: 1, borderColor: C.line, padding: 20, backgroundColor: "#FFFFFF" },
  bookTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.muted },
  statusBadge: { height: 30, paddingHorizontal: 14, borderRadius: 15, justifyContent: "center" },
  statusText: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5, textTransform: "capitalize" },
  returnNumber: { marginTop: 6, fontFamily: fontFamilies.sans.bold, fontSize: 26, letterSpacing: -0.6, color: C.text },
  date: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted },
  route: { flexDirection: "row", gap: 14, marginTop: 18 },
  routeCol: { flex: 1, minWidth: 0 },
  routeLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.6, color: C.muted },
  routeValue: { marginTop: 4, fontFamily: fontFamilies.sans.bold, fontSize: 15.5, letterSpacing: -0.2, color: C.text },
  orderLink: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    paddingRight: 16,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  orderLinkIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.lime, alignItems: "center", justifyContent: "center" },
  orderLinkText: { flex: 1, fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },

  block: {
    marginTop: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  blockTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, letterSpacing: -0.2, color: C.text },
  reason: { marginTop: 8, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: C.text },
  ledger: { marginTop: 6 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  variantChip: { paddingHorizontal: 10, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: C.accentSoft, maxWidth: 130 },
  variantChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },
  itemQty: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  itemRefund: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.text, fontVariant: ["tabular-nums"] },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 14 },
  totalLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.text },
  totalValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.4, color: C.text, fontVariant: ["tabular-nums"] },
  noteText: { marginTop: 8, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: C.muted },
  noteInput: {
    marginTop: 10,
    backgroundColor: "#faf9f4",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: C.text,
    minHeight: 84,
    textAlignVertical: "top",
  },
  actions: { marginTop: 20, gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 27,
  },
  primaryBtn: { backgroundColor: C.ink },
  secondaryBtn: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(22,23,15,0.12)" },
  rejectBtn: { backgroundColor: "rgba(184,92,58,0.05)", borderWidth: 1, borderColor: "rgba(184,92,58,0.3)" },
  actionBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },
  actingOverlay: { alignItems: "center", marginTop: 16 },
});
