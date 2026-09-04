import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  getAdminOrders,
  riderReschedule,
  isReassignAvailable,
  reassignDelivery,
} from "@/lib/api";
import {
  ISSUE_REASON_BY_VALUE,
} from "@/lib/utils/delivery-format";
import {
  MAX_DELIVERY_ATTEMPTS,
  attemptCount,
  isRetryAllowed,
  type DeliveryFailureContext,
} from "@/lib/delivery-workflow";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Order } from "@/lib/types";

interface FailureRow {
  id: string;
  order_number: string;
  status: string;
  attempt_count: number;
  failure_reason: string | null;
  failed_at: string | null;
  delivery_person_id: string | null;
}

function pickFailureRow(order: Order): FailureRow | null {
  // We treat any order in `returned` with attempt_count > 0 as a recoverable
  // failure. Orders that went straight to `cancelled` without retry history
  // are excluded — those are seller-cancellations or out-of-scope failures.
  const attempts = attemptCount(order);
  if (order.status !== "returned" || attempts === 0) return null;
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    attempt_count: attempts,
    failure_reason: order.failure_reason ?? null,
    failed_at: order.failed_at ?? null,
    delivery_person_id: order.delivery_person_id ?? null,
  };
}

export default function AdminDeliveryFailures() {
  const router = useRouter();
  const [rows, setRows] = useState<FailureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reassignSupported, setReassignSupported] = useState<boolean | null>(null);
  const [reassignRow, setReassignRow] = useState<FailureRow | null>(null);
  const [reassignRiderId, setReassignRiderId] = useState("");
  const [reassignBusy, setReassignBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await getAdminOrders({ status: "returned" });
    if (res.ok && res.data) {
      setRows(res.data.map(pickFailureRow).filter((r): r is FailureRow => r !== null));
    } else {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    isReassignAvailable()
      .then((ok) => {
        if (!cancelled) setReassignSupported(ok);
      })
      .catch(() => {
        if (!cancelled) setReassignSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleReschedule = (row: FailureRow) => {
    Alert.alert(
      "Reschedule?",
      `Move ${row.order_number} back to out_for_delivery for another attempt.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reschedule",
          onPress: async () => {
            const res = await riderReschedule(row.id);
            if (res.ok) {
              await load();
              Alert.alert("Rescheduled", `${row.order_number} moved to out_for_delivery.`);
            } else {
              Alert.alert("Error", res.error);
            }
          },
        },
      ],
    );
  };

  const handleReassign = (row: FailureRow) => {
    setReassignRiderId("");
    setReassignRow(row);
  };

  const submitReassign = async () => {
    const row = reassignRow;
    const to = reassignRiderId.trim();
    if (!row || !to || reassignBusy) return;
    setReassignBusy(true);
    const res = await reassignDelivery(row.id, to);
    setReassignBusy(false);
    setReassignRow(null);
    if (res.ok) {
      await load();
      Alert.alert("Reassigned", `${row.order_number} handed off to ${to}.`);
    } else if (res.error === "reassign-not-supported") {
      Alert.alert("Unavailable", "Server doesn't expose the reassign endpoint yet.");
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const ctxFor = (row: FailureRow): DeliveryFailureContext => ({
    attemptCount: row.attempt_count,
    reassignAvailable: reassignSupported === true,
  });

  const renderItem = ({ item }: { item: FailureRow }) => {
    const reasonLabel = item.failure_reason
      ? ISSUE_REASON_BY_VALUE[item.failure_reason as keyof typeof ISSUE_REASON_BY_VALUE]?.label ?? item.failure_reason
      : "Unspecified";
    const ctx = ctxFor(item);
    const canReschedule = isRetryAllowed({ status: item.status }, ctx);
    const attemptsLeft = Math.max(0, MAX_DELIVERY_ATTEMPTS - item.attempt_count);
    const canReassign =
      ctx.reassignAvailable === true &&
      ctx.attemptCount > 0 &&
      item.delivery_person_id !== null;
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(admin)/orders/${item.id}` as any)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>{item.order_number}</Text>
          <Text style={styles.attempts}>
            Attempt {item.attempt_count} of {MAX_DELIVERY_ATTEMPTS}
          </Text>
        </View>
        <Text style={styles.meta}>Reason: {reasonLabel}</Text>
        {item.failed_at ? (
          <Text style={styles.meta}>Failed at: {new Date(item.failed_at).toLocaleString()}</Text>
        ) : null}
        {item.delivery_person_id ? (
          <Text style={styles.meta}>Rider: {item.delivery_person_id}</Text>
        ) : null}
        <View style={styles.actions}>
          {canReschedule && attemptsLeft > 0 ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleReschedule(item)}>
              <Text style={styles.primaryBtnText}>
                Reschedule ({attemptsLeft} left)
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.primaryBtn, styles.disabledBtn]}>
              <Text style={styles.disabledBtnText}>Max attempts reached</Text>
            </View>
          )}
          {canReassign && reassignSupported === true ? (
            <TouchableOpacity style={styles.reassignBtn} onPress={() => handleReassign(item)}>
              <Text style={styles.reassignBtnText}>Reassign</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>LOGISTICS</Text>
        <Text style={styles.title}>Failed deliveries</Text>
        <Text style={styles.subtitle}>
          Orders in <Text style={styles.mono}>returned</Text> with at least one recorded attempt.
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : (
            <Text style={styles.empty}>No failed deliveries. 🎉</Text>
          )
        }
        renderItem={renderItem}
      />

      <Modal
        visible={!!reassignRow}
        transparent
        animationType="fade"
        onRequestClose={() => setReassignRow(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReassignRow(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Reassign rider</Text>
            <Text style={styles.modalBody}>
              Enter the rider id to hand off {reassignRow?.order_number} to.
            </Text>
            <TextInput
              value={reassignRiderId}
              onChangeText={setReassignRiderId}
              placeholder="Rider id"
              autoCapitalize="none"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.reassignBtn} onPress={() => setReassignRow(null)}>
                <Text style={styles.reassignBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={submitReassign}
                disabled={reassignBusy || !reassignRiderId.trim()}
              >
                <Text style={styles.primaryBtnText}>{reassignBusy ? "Saving…" : "Reassign"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  backLink: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.primary,
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    color: colors.light.foreground,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 6,
  },
  mono: { fontFamily: fontFamilies.mono.regular },
  list: { padding: 20, paddingBottom: 100, gap: 12 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  orderNumber: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 14,
    color: colors.light.foreground,
    fontWeight: "600",
  },
  attempts: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "#92400e",
    backgroundColor: "#fef9c3",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  meta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.light.primary,
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.light.card,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
  },
  disabledBtn: {
    backgroundColor: colors.light.mutedForeground,
  },
  disabledBtnText: {
    color: colors.light.card,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
  },
  reassignBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.background,
    alignItems: "center",
  },
  reassignBtnText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
  },
  empty: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 16,
    color: colors.light.foreground,
  },
  modalBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: 12,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
});
