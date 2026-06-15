import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrderById, transitionOrderStatus } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { colors, typography } from "@/lib/theme/tokens";

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await getOrderById(id);
      return res.ok ? res.data : null;
    },
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: (status: string) => transitionOrderStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  const order = orderQuery.data;

  if (orderQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={styles.card}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Order not found.</Text>
          <Button onPress={() => router.back()} variant="outline">
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button onPress={() => router.back()} variant="ghost" style={styles.backBtn}>
        ← Back
      </Button>

      <View style={styles.header}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>
        <Badge
          variant={order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"}
        >
          {order.status}
        </Badge>
      </View>

      <Text style={styles.date}>
        Placed {new Date(order.placed_at).toLocaleDateString("en-LK", { dateStyle: "full" })}
      </Text>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Status Progress</Text>
        <View style={styles.progressRow}>
          {STATUS_FLOW.map((s, i) => (
            <React.Fragment key={s}>
              <View style={[styles.dot, i <= currentIdx && styles.dotActive]} />
              {i < STATUS_FLOW.length - 1 && (
                <View style={[styles.line, i < currentIdx && styles.lineActive]} />
              )}
            </React.Fragment>
          ))}
        </View>
        <View style={styles.progressLabels}>
          {STATUS_FLOW.map((s) => (
            <Text key={s} style={[styles.progressLabel, s === order.status && styles.progressLabelActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          ))}
        </View>
      </Card>

      {nextStatus && (
        <Button
          onPress={() => transitionMutation.mutate(nextStatus)}
          disabled={transitionMutation.isPending}
          style={styles.actionBtn}
        >
          {`Mark as ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`}
        </Button>
      )}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {(order.items ?? []).map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
              {item.variant_label && <Text style={styles.itemVariant}>{item.variant_label}</Text>}
            </View>
            <Text style={styles.itemQty}>×{item.quantity}</Text>
            <Text style={styles.itemPrice}>LKR {item.total.toLocaleString()}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Payment</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>LKR {order.subtotal.toLocaleString()}</Text>
        </View>
        {order.discount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <Text style={[styles.summaryValue, { color: colors.olive[300] }]}>-LKR {order.discount.toLocaleString()}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping</Text>
          <Text style={styles.summaryValue}>LKR {order.shipping_fee.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>LKR {order.tax.toLocaleString()}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>LKR {order.total.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Payment Method</Text>
          <Text style={styles.summaryValue}>{(order.payment_method ?? "—").toUpperCase()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Payment Status</Text>
          <Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>
            {order.payment_status}
          </Badge>
        </View>
      </Card>

      {order.address && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Shipping Address</Text>
          <Text style={styles.addressText}>{order.address.full_name}</Text>
          <Text style={styles.addressText}>{order.address.line1}</Text>
          {order.address.line2 && <Text style={styles.addressText}>{order.address.line2}</Text>}
          <Text style={styles.addressText}>{order.address.city}, {order.address.state} {order.address.postal_code}</Text>
          <Text style={styles.addressText}>{order.address.country}</Text>
          <Text style={styles.addressText}>📞 {order.address.phone}</Text>
        </Card>
      )}

      {order.notes && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Notes</Text>
          <Text style={styles.noteText}>{order.notes}</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  list: { padding: 24 },
  backBtn: { alignSelf: "flex-start", marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  orderNumber: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground },
  date: { fontSize: typography.fontSizes.sm, color: colors.light.muted, marginBottom: 24 },
  card: { padding: 24, marginBottom: 16 },
  cardTitle: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 16 },
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.light.border },
  dotActive: { backgroundColor: colors.light.primary },
  line: { flex: 1, height: 2, backgroundColor: colors.light.border },
  lineActive: { backgroundColor: colors.light.primary },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: typography.fontSizes.xs, color: colors.light.muted, textTransform: "capitalize" },
  progressLabelActive: { color: colors.light.primary, fontWeight: "600" },
  actionBtn: { marginBottom: 16 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: typography.fontSizes.base, color: colors.light.foreground },
  itemVariant: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  itemQty: { fontSize: typography.fontSizes.base, color: colors.light.muted, marginHorizontal: 16 },
  itemPrice: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  summaryLabel: { fontSize: typography.fontSizes.base, color: colors.light.muted },
  summaryValue: { fontSize: typography.fontSizes.base, color: colors.light.foreground },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.light.border, marginTop: 8, paddingTop: 16 },
  totalLabel: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  totalValue: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.semibold, color: colors.light.primary },
  addressText: { fontSize: typography.fontSizes.base, color: colors.light.foreground, lineHeight: 22 },
  noteText: { fontSize: typography.fontSizes.base, color: colors.light.foreground, fontStyle: "italic" },
  emptyText: { fontSize: typography.fontSizes.base, color: colors.light.muted, marginBottom: 16 },
});
