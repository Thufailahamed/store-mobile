import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Avatar, Button, Input, useToast } from "@/components/ui";
import { Body, Display, Label, Price } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { useTrackEvent } from "@/lib/recommender";
import {
  createReturnRequest,
  getOrderById,
  type CreateReturnResult,
} from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Order, OrderItem } from "@/lib/types";

const REASONS: { key: string; label: string; copy: string }[] = [
  { key: "defective", label: "Damaged / defective", copy: "Item arrived broken or unusable" },
  { key: "wrong_item", label: "Wrong item received", copy: "Not what was ordered" },
  { key: "size_fit", label: "Size or fit", copy: "Doesn't fit as expected" },
  { key: "not_as_described", label: "Not as described", copy: "Material, color, or quality differs" },
  { key: "changed_mind", label: "Changed my mind", copy: "No longer needed" },
  { key: "other", label: "Other", copy: "Tell us in the notes" },
];

type Selection = Record<string, { selected: boolean; quantity: number }>;

export default function NewReturnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const tracker = useTrackEvent();

  // Screen-view: only fire once per order id.
  useEffect(() => {
    if (!orderId) return;
    tracker.screen("returns_new", { orderId });
  }, [orderId]);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selection, setSelection] = useState<Selection>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<CreateReturnResult | null>(null);

  const loadOrder = useCallback(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    getOrderById(orderId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        // res.data is null when the order genuinely doesn't exist — kept
        // distinct from a fetch failure (res.ok === false) below.
        setOrder(res.data);
      } else {
        setFetchError(res.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    const cleanup = loadOrder();
    return cleanup;
  }, [loadOrder]);

  // Initialize selection: pre-select all items, quantity = ordered qty.
  useEffect(() => {
    if (!order?.items) return;
    const init: Selection = {};
    for (const it of order.items) {
      init[it.id] = { selected: true, quantity: it.quantity };
    }
    setSelection(init);
  }, [order?.id]);

  const eligibleItems = useMemo(
    () => (order?.items ?? []).filter((it) => it.quantity > 0),
    [order?.items]
  );

  const refundEstimate = useMemo(() => {
    let total = 0;
    for (const it of order?.items ?? []) {
      const sel = selection[it.id];
      if (sel?.selected) total += Number(it.unit_price ?? 0) * Math.min(sel.quantity, it.quantity);
    }
    return total;
  }, [selection, order?.items]);

  const toggleItem = (itemId: string) => {
    setSelection((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return { ...prev, [itemId]: { ...cur, selected: !cur.selected } };
    });
  };

  const setQty = (itemId: string, qty: number, max: number) => {
    setSelection((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return { ...prev, [itemId]: { ...cur, quantity: Math.max(1, Math.min(qty, max)) } };
    });
  };

  const selectedCount = Object.values(selection).filter((s) => s.selected).length;
  const canSubmit =
    !!user && !!order && !!reason && selectedCount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!user || !order) return;
    setSubmitting(true);
    const items = eligibleItems
      .filter((it) => selection[it.id]?.selected)
      .map((it) => ({
        orderItemId: it.id,
        quantity: Math.min(selection[it.id].quantity, it.quantity),
      }));
    if (items.length === 0) {
      setSubmitting(false);
      toast("Select at least one item", "error");
      return;
    }
    const finalReason = notes.trim()
      ? `${REASONS.find((r) => r.key === reason)?.label ?? reason}: ${notes.trim()}`
      : REASONS.find((r) => r.key === reason)?.label ?? reason;

    const res = await createReturnRequest(user.id, {
      orderId: order.id,
      reason: finalReason,
      items,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setSuccess(res.data);
    toast("Return request submitted", "success");
    tracker.action("return_submitted", {
      orderId: order.id,
      reason: finalReason,
      itemCount: items.length,
    });
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Request return" onBack={() => router.back()} />
        <View style={styles.center}>
          {loading ? (
            <Body muted>Loading order…</Body>
          ) : fetchError ? (
            <>
              <Body muted style={{ textAlign: "center", marginBottom: spacing[4] }}>
                Couldn't load this order — check your connection
              </Body>
              <Button variant="outline" onPress={loadOrder}>Retry</Button>
            </>
          ) : (
            <Body muted>Order not found</Body>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Return requested" />
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.olive[600]} />
          </View>
          <Display size="xl" style={styles.successTitle}>
            Return #{success.returnNumber}
          </Display>
          <Body muted style={styles.successCopy}>
            We notified the seller. You'll get updates as they review and process your refund.
          </Body>
          <View style={styles.successActions}>
            <Button variant="brand" onPress={() => router.replace("/(main)/account/returns" as never)}>
              View all returns
            </Button>
            <Button variant="ghost" onPress={() => router.replace("/(main)/account/orders" as never)}>
              Back to orders
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Request return" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[4] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <Label style={styles.kicker}>RETURNING FROM</Label>
          <Display size="lg">Order #{order.order_number}</Display>
          <Body muted size="xs">
            Placed {new Date(order.placed_at).toLocaleDateString()} ·{" "}
            {formatPrice(order.total, order.currency)}
          </Body>
        </View>

        <Section title="What's wrong?" subtitle="Pick the reason that best describes it.">
          <View style={styles.reasons}>
            {REASONS.map((r) => {
              const active = reason === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.reason, active && styles.reasonActive]}
                  activeOpacity={0.85}
                  onPress={() => setReason(r.key)}
                >
                  <View style={styles.reasonBody}>
                    <Body size="sm" style={styles.reasonLabel}>
                      {r.label}
                    </Body>
                    <Body muted size="xs">
                      {r.copy}
                    </Body>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="Items to return" subtitle="Adjust quantities if you're keeping part of an order.">
          {eligibleItems.map((it: OrderItem) => {
            const sel = selection[it.id];
            if (!sel) return null;
            const img =
              it.product?.images?.find((i) => i.is_primary)?.url ??
              it.product?.images?.[0]?.url;
            return (
              <View key={it.id} style={styles.item}>
                <TouchableOpacity
                  style={[styles.itemHead, !sel.selected && styles.itemHeadDim]}
                  onPress={() => toggleItem(it.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.checkbox, sel.selected && styles.checkboxOn]}>
                    {sel.selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  {img ? (
                    <Avatar uri={img} size={48} style={{ borderRadius: radii.lg }} />
                  ) : (
                    <View style={styles.itemPlaceholder}>
                      <Ionicons name="cube-outline" size={20} color={colors.light.mutedForeground} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Body size="sm" numberOfLines={2} style={styles.itemName}>
                      {it.product_name}
                    </Body>
                    {it.variant_label ? (
                      <Body muted size="xs">
                        {it.variant_label}
                      </Body>
                    ) : null}
                    <Body muted size="xs">
                      Unit {formatPrice(it.unit_price, order.currency)}
                    </Body>
                  </View>
                </TouchableOpacity>
                {sel.selected && (
                  <View style={styles.qtyRow}>
                    <Label style={styles.qtyLabel}>Return qty</Label>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        onPress={() => setQty(it.id, sel.quantity - 1, it.quantity)}
                        style={styles.qtyBtn}
                      >
                        <Ionicons name="remove" size={14} color={colors.light.foreground} />
                      </TouchableOpacity>
                      <Label style={styles.qtyValue}>{sel.quantity}</Label>
                      <TouchableOpacity
                        onPress={() => setQty(it.id, sel.quantity + 1, it.quantity)}
                        style={styles.qtyBtn}
                      >
                        <Ionicons name="add" size={14} color={colors.light.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </Section>

        <Section title="Anything else?">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Add serial numbers or context for the seller"
            multiline
            numberOfLines={4}
            style={styles.notes}
          />
        </Section>

        <View style={styles.estimateCard}>
          <View>
            <Label style={styles.estimateKicker}>ESTIMATED REFUND</Label>
            <Body muted size="xs">
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </Body>
          </View>
          <Price style={styles.estimateValue}>
            {formatPrice(refundEstimate, order.currency)}
          </Price>
        </View>

        <Button variant="brand" onPress={handleSubmit} disabled={!canSubmit} loading={submitting}>
          Submit return
        </Button>
        <Body muted size="xs" style={styles.disclaimer}>
          Refund amount is finalised by the seller after they review the items.
        </Body>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Display size="lg" style={styles.sectionTitle}>
        {title}
      </Display>
      {subtitle ? (
        <Body muted size="sm" style={styles.sectionSubtitle}>
          {subtitle}
        </Body>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[5] },
  summaryCard: {
    backgroundColor: colors.olive[50],
    borderRadius: radii["2xl"],
    padding: spacing[4],
    gap: 4,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[700],
    letterSpacing: 1,
  },
  section: { gap: spacing[3] },
  sectionTitle: {},
  sectionSubtitle: { marginTop: -spacing[2] },
  reasons: { gap: spacing[2] },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  reasonActive: { borderColor: colors.light.primary, backgroundColor: colors.olive[50] },
  reasonBody: { flex: 1, gap: 2 },
  reasonLabel: { fontFamily: fontFamilies.sans.semibold },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.light.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.light.primary,
  },
  item: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[3],
    gap: spacing[2],
  },
  itemHead: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  itemHeadDim: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { borderColor: colors.light.primary, backgroundColor: colors.light.primary },
  itemPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: { fontFamily: fontFamilies.sans.semibold },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  qtyLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 0.5,
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: { minWidth: 18, textAlign: "center", fontFamily: fontFamilies.sans.semibold },
  notes: { minHeight: 100, textAlignVertical: "top" },
  estimateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.olive[100],
    padding: spacing[4],
    borderRadius: radii["2xl"],
  },
  estimateKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[800],
    letterSpacing: 1,
  },
  estimateValue: { fontSize: typography.fontSizes.xl, color: colors.olive[800] },
  disclaimer: { textAlign: "center" },
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    gap: spacing[3],
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  successTitle: { textAlign: "center" },
  successCopy: { textAlign: "center" },
  successActions: { width: "100%", gap: spacing[2], marginTop: spacing[4] },
});
