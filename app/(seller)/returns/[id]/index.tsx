import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
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
import type { ReturnStatus } from "@/lib/account-local";

const STATUS_COLORS: Record<ReturnStatus, { bg: string; text: string }> = {
  requested: { bg: "#fef3c7", text: "#92400e" },
  approved: { bg: "#dbeafe", text: "#1e40af" },
  received: { bg: "#e0e7ff", text: "#3730a3" },
  refunded: { bg: "#dcfce7", text: "#166534" },
  rejected: { bg: "#fee2e2", text: "#b91c1c" },
};

function formatPrice(n: number, currency = "LKR") {
  return `${currency} ${n.toLocaleString("en-LK")}`;
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
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!id || !user) return;
    let sid = storeId;
    if (!sid) {
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setLoading(false);
        return;
      }
      sid = storeRes.data.id;
      setStoreId(sid);
    }
    const res = await getSellerReturnByGroupId(sid, id);
    if (res.ok && res.data) setReturnReq(res.data);
    setLoading(false);
  }, [id, user, storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = (action: SellerReturnAction, label: string) => {
    if (!user || !storeId || !returnReq) return;

    const confirmCopy =
      action === "reject"
        ? "The buyer will be notified. They can contact support if needed."
        : action === "refund"
          ? `Refund ${formatPrice(returnReq.refund_amount, returnReq.currency)} to the buyer?`
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
            setLoading(true);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.light.primary} />
        <Text style={styles.loadingText}>Loading return...</Text>
      </View>
    );
  }

  if (!returnReq) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Return not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sc = STATUS_COLORS[returnReq.status];
  const canApprove = returnReq.status === "requested";
  const canReject = returnReq.status === "requested";
  const canReceive = returnReq.status === "approved";
  const canRefund = returnReq.status === "approved" || returnReq.status === "received";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.returnNumber}>{returnReq.return_number}</Text>
            <Text style={styles.date}>{formatDate(returnReq.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{returnReq.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order</Text>
        <TouchableOpacity
          style={styles.orderLink}
          onPress={() => router.push(`/(seller)/orders/${returnReq.order_id}` as any)}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.olive[600]} />
          <Text style={styles.orderLinkText}>{returnReq.order_number}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.light.mutedForeground} />
        </TouchableOpacity>
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
                Qty {item.quantity} · {formatPrice(item.unit_price, returnReq.currency)} each
              </Text>
            </View>
            <Text style={styles.itemRefund}>
              {formatPrice(item.refund_amount, returnReq.currency)}
            </Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Refund total</Text>
          <Text style={styles.totalValue}>
            {formatPrice(returnReq.refund_amount, returnReq.currency)}
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
  header: {
    paddingTop: 56,
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
