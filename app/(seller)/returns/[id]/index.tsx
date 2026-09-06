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
import { colors, typography, radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { formatReturnStatusLabel, returnRefundAmount } from "@/lib/returns/seller-list";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  requested: { bg: "rgba(200,164,74,0.18)", text: "#8a6a2a" },
  approved: { bg: "rgba(83,94,44,0.12)", text: colors.olive[800] },
  received: { bg: "rgba(83,94,44,0.16)", text: colors.olive[900] },
  refunded: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  rejected: { bg: "rgba(184,92,58,0.12)", text: colors.accent2.rust },
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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color={colors.light.primary} />
        <Text style={styles.loadingText}>Loading return...</Text>
      </SafeAreaView>
    );
  }

  if (!returnReq) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <Text style={styles.errorTitle}>Couldn’t load this return</Text>
        <Text style={styles.loadingText}>{loadError ?? "Return not found"}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={retry} accessibilityRole="button">
          <Text style={styles.retryLabel}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sc = STATUS_COLORS[returnReq.status] ?? STATUS_COLORS.requested;
  const canApprove = returnReq.status === "requested";
  const canReject = returnReq.status === "requested";
  const canReceive = returnReq.status === "approved";
  const canRefund = returnReq.status === "approved" || returnReq.status === "received";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.returnNumber}>{returnReq.order_number || returnReq.return_number || "Return"}</Text>
            <Text style={styles.date}>{formatDate(returnReq.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{formatReturnStatusLabel(returnReq.status)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order</Text>
        {returnReq.order_id ? (
          <TouchableOpacity
            style={styles.orderLink}
            onPress={() => router.push(`/(seller)/orders/${returnReq.order_id}` as const)}
          >
            <Ionicons name="receipt-outline" size={18} color={colors.olive[600]} />
            <Text style={styles.orderLinkText}>{returnReq.order_number || "—"}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.orderLinkText}>{returnReq.order_number || "—"}</Text>
        )}
        {returnReq.buyer_name ? (
          <Text style={styles.buyer}>Buyer: {returnReq.buyer_name}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reason</Text>
        <Text style={styles.reason}>{returnReq.reason}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {returnReq.items.map((item) => (
          <View key={item.return_id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              {item.variant_label ? (
                <Text style={styles.itemVariant}>{item.variant_label}</Text>
              ) : null}
              <Text style={styles.itemQty}>
                Qty {item.quantity} · {money(item.unit_price, returnReq.currency)} each
              </Text>
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

      {returnReq.seller_note ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.noteText}>{returnReq.seller_note}</Text>
        </View>
      ) : null}

      {(canApprove || canReject || canReceive || canRefund) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note to buyer (optional)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Add a message the buyer will see..."
            placeholderTextColor={colors.light.mutedForeground}
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
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleAction("approve", "Approve")}
            disabled={acting}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>
        ) : null}
        {canReceive ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.receiveBtn]}
            onPress={() => handleAction("receive", "Mark received")}
            disabled={acting}
          >
            <Ionicons name="archive-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Mark received</Text>
          </TouchableOpacity>
        ) : null}
        {canRefund ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.refundBtn]}
            onPress={() => handleAction("refund", "Process refund")}
            disabled={acting}
          >
            <Ionicons name="card-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Process refund</Text>
          </TouchableOpacity>
        ) : null}
        {canReject ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleAction("reject", "Reject")}
            disabled={acting}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.light.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.light.destructive }]}>Reject</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {acting ? (
        <View style={styles.actingOverlay}>
          <ActivityIndicator color={colors.light.primary} />
        </View>
      ) : null}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light.background,
    gap: 12,
  },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },
  backLink: { fontSize: typography.fontSizes.base, color: colors.light.primary },
  errorTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.olive[600],
  },
  retryLabel: {
    color: "#fff",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  header: {
    // Top inset comes from SafeAreaView, not a hardcoded notch guess.
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  backButton: {
    fontSize: typography.fontSizes.base,
    color: colors.light.primary,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  returnNumber: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  date: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.full },
  statusText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },
  section: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  orderLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  orderLinkText: {
    flex: 1,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  buyer: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  reason: { fontSize: typography.fontSizes.base, color: colors.light.foreground, lineHeight: 22 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  itemInfo: { flex: 1, paddingRight: 12 },
  itemName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  itemVariant: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  itemQty: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 4 },
  itemRefund: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  totalValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  noteText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 20,
  },
  noteInput: {
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    minHeight: 80,
    textAlignVertical: "top",
  },
  actions: { marginHorizontal: 24, marginTop: 24, gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.lg,
  },
  approveBtn: { backgroundColor: colors.olive[700] },
  receiveBtn: { backgroundColor: "#4f46e5" },
  refundBtn: { backgroundColor: "#059669" },
  rejectBtn: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.destructive + "40",
  },
  actionBtnText: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: "#fff",
  },
  actingOverlay: { alignItems: "center", marginTop: 16 },
});
