import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton, useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { useTrackEvent } from "@/lib/recommender";
import {
  createReturnRequest,
  getOrderById,
  RETURNS_NOT_ACCEPTED_MESSAGE,
  type CreateReturnResult,
  type ReturnReasonCode,
} from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";
import { C, DottedRail, shortDate } from "@/components/orders/parcel-track";
import { ParcelScreen } from "@/components/orders/detail-chrome";
import { RETURN_ICONS } from "@/components/orders/return-track";
import type { Order, OrderItem } from "@/lib/types";

// Keys are the backend's return reason enum (CreateReturnSchema).
const REASONS: { key: ReturnReasonCode; label: string; copy: string }[] = [
  { key: "defective", label: "Damaged / defective", copy: "Item arrived broken or unusable" },
  { key: "wrong_item", label: "Wrong item received", copy: "Not what was ordered" },
  { key: "size_issue", label: "Size or fit", copy: "Doesn't fit as expected" },
  { key: "not_as_described", label: "Not as described", copy: "Material, color, or quality differs" },
  { key: "changed_mind", label: "Changed my mind", copy: "No longer needed" },
  { key: "other", label: "Other", copy: "Tell us in the notes" },
];

type Selection = Record<string, { selected: boolean; quantity: number }>;

export default function NewReturnScreen() {
  const router = useRouter();
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
  const [reason, setReason] = useState<ReturnReasonCode | "">("");
  // Set when the backend refuses because the store is final-sale (0357).
  const [finalSaleMessage, setFinalSaleMessage] = useState<string | null>(null);
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
    if (!user || !order || !reason) return;
    setSubmitting(true);
    const items = eligibleItems
      .filter((it) => selection[it.id]?.selected)
      .map((it) => ({
        productId: it.product_id,
        variantId: it.variant_id,
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
      reason,
      description: notes.trim() || undefined,
      items,
    });
    setSubmitting(false);
    if (!res.ok) {
      if (res.error.includes(RETURNS_NOT_ACCEPTED_MESSAGE)) {
        setFinalSaleMessage(res.error);
        return;
      }
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

  const goBack = () => router.back();

  if (loading || !order) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ParcelScreen title="Request Return" onBack={goBack}>
          {loading ? (
            <>
              <Skeleton height={110} borderRadius={24} />
              <Skeleton height={260} borderRadius={24} />
            </>
          ) : (
            <View style={styles.stateCard}>
              <Ionicons name={fetchError ? "cloud-offline-outline" : "help-circle-outline"} size={26} color={C.muted} />
              <Text style={styles.stateTitle}>{fetchError ? "Couldn’t load this order" : "Order not found"}</Text>
              {fetchError ? (
                <TouchableOpacity style={styles.darkBtn} onPress={loadOrder} activeOpacity={0.85}>
                  <Text style={styles.darkBtnText}>Try again</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </ParcelScreen>
      </>
    );
  }

  if (finalSaleMessage || success) {
    const ok = !!success;
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ParcelScreen title={ok ? "Return Requested" : "Request Return"} onBack={goBack}>
          <View style={styles.resultCard}>
            <View style={[styles.resultIcon, !ok && { backgroundColor: C.rust }]}>
              <MaterialCommunityIcons name={ok ? "check-decagram" : "cancel"} size={34} color={ok ? C.ink : C.cream} />
            </View>
            <Text style={styles.resultKicker}>{ok ? "REQUEST SENT" : "NOT RETURNABLE"}</Text>
            <Text style={styles.resultTitle}>{ok ? `Return #${success.returnNumber}` : "Final sale"}</Text>
            <Text style={styles.resultCopy}>
              {ok
                ? "We notified the seller. You’ll get updates as they review it and process your refund."
                : finalSaleMessage}
            </Text>
            {ok ? (
              <View style={styles.resultRail}>
                <DottedRail stage={0} icons={RETURN_ICONS} label="In review" />
              </View>
            ) : null}
          </View>
          {ok ? (
            <TouchableOpacity
              style={styles.darkBtnWide}
              onPress={() => router.replace("/(main)/account/returns" as never)}
              activeOpacity={0.88}
            >
              <Text style={styles.darkBtnText}>View all returns</Text>
              <Ionicons name="arrow-forward" size={16} color={C.lime} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={ok ? styles.outlineBtn : styles.darkBtnWide}
            onPress={() => router.replace("/(main)/account/orders" as never)}
            activeOpacity={0.85}
          >
            <Text style={ok ? styles.outlineBtnText : styles.darkBtnText}>Back to orders</Text>
          </TouchableOpacity>
        </ParcelScreen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ParcelScreen
        title="Request Return"
        onBack={goBack}
        footer={
          <View>
            <View style={styles.footRow}>
              <View>
                <Text style={styles.footKicker}>ESTIMATED REFUND</Text>
                <Text style={styles.footSub}>
                  {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
                </Text>
              </View>
              <Text style={styles.footValue}>{formatPrice(refundEstimate, order.currency)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={C.cream} />
              ) : (
                <>
                  <Text style={styles.submitText}>{reason ? "Submit return" : "Choose a reason"}</Text>
                  <Ionicons name="arrow-forward" size={16} color={canSubmit ? C.lime : C.cream} />
                </>
              )}
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.orderCard}>
          <View style={styles.orderIcon}>
            <MaterialCommunityIcons name="shopping-outline" size={22} color={C.goldSoft} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.orderKicker}>Returning from</Text>
            <Text style={styles.orderNumber} numberOfLines={1}>#{order.order_number}</Text>
            <Text style={styles.orderMeta}>
              Placed {shortDate(order.placed_at)} · {formatPrice(order.total, order.currency)}
            </Text>
          </View>
        </View>

        <SectionHead step={1} title="What’s wrong?" sub="Pick the reason that fits best." />
        <View style={styles.reasonGrid}>
          {REASONS.map((r) => {
            const active = reason === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.reason, active && styles.reasonOn]}
                activeOpacity={0.85}
                onPress={() => setReason(r.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.reasonIcon, active && styles.reasonIconOn]}>
                  <MaterialCommunityIcons name={REASON_ICON[r.key]} size={18} color={active ? C.ink : C.accent} />
                </View>
                <Text style={[styles.reasonLabel, active && { color: C.cream }]} numberOfLines={2}>
                  {r.label}
                </Text>
                <Text style={[styles.reasonCopy, active && { color: "rgba(250,248,241,0.6)" }]} numberOfLines={2}>
                  {r.copy}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SectionHead step={2} title="Items to return" sub="Untick anything you’re keeping." />
        <View style={styles.itemsCard}>
          {eligibleItems.map((it: OrderItem, i) => {
            const sel = selection[it.id];
            if (!sel) return null;
            const img =
              it.image_url ?? it.product?.images?.find((im) => im.is_primary)?.url ?? it.product?.images?.[0]?.url;
            return (
              <View key={it.id} style={[styles.itemRow, i > 0 && styles.itemDivider]}>
                <TouchableOpacity
                  style={[styles.itemMain, !sel.selected && { opacity: 0.45 }]}
                  onPress={() => toggleItem(it.id)}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sel.selected }}
                >
                  <View style={[styles.check, sel.selected && styles.checkOn]}>
                    {sel.selected ? <Ionicons name="checkmark" size={14} color={C.lime} /> : null}
                  </View>
                  <View style={styles.thumb}>
                    {img ? (
                      <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Ionicons name="shirt-outline" size={20} color={C.muted} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{it.product_name}</Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {[it.variant_label, formatPrice(it.unit_price, order.currency)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </TouchableOpacity>
                {sel.selected && it.quantity > 1 ? (
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => setQty(it.id, sel.quantity - 1, it.quantity)}
                      style={styles.stepBtn}
                      hitSlop={6}
                      accessibilityLabel="Decrease quantity"
                    >
                      <Ionicons name="remove" size={14} color={C.text} />
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{sel.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => setQty(it.id, sel.quantity + 1, it.quantity)}
                      style={styles.stepBtn}
                      hitSlop={6}
                      accessibilityLabel="Increase quantity"
                    >
                      <Ionicons name="add" size={14} color={C.text} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.qtyFixed}>×{it.quantity}</Text>
                )}
              </View>
            );
          })}
        </View>

        <SectionHead step={3} title="Anything else?" sub="Optional — helps the seller review faster." />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the issue, or add serial numbers"
          placeholderTextColor="#A1A1A6"
          multiline
          style={styles.notes}
          textAlignVertical="top"
        />
        <Text style={styles.disclaimer}>The final refund is confirmed by the seller after they inspect the items.</Text>
      </ParcelScreen>
    </>
  );
}

type McIcon = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const REASON_ICON: Record<ReturnReasonCode, McIcon> = {
  defective: "package-down",
  wrong_item: "swap-horizontal",
  size_issue: "tape-measure",
  not_as_described: "image-off-outline",
  changed_mind: "thought-bubble-outline",
  other: "dots-horizontal",
};

function SectionHead({ step, title, sub }: { step: number; title: string; sub: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.stepDot}>
        <Text style={styles.stepDotText}>{step}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 26,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  stateTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text, textAlign: "center" },

  resultCard: {
    alignItems: "center",
    paddingTop: 30,
    paddingBottom: 22,
    paddingHorizontal: 22,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  resultKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  resultTitle: {
    marginTop: 6,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.5,
    color: C.text,
    textAlign: "center",
  },
  resultCopy: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
  },
  resultRail: { alignSelf: "stretch", paddingLeft: 78, marginTop: 4 },

  darkBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.ink,
  },
  darkBtnWide: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.ink,
  },
  darkBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.cream },
  outlineBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#FFFFFF",
  },
  outlineBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.text },

  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  orderIcon: {
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
  orderNumber: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text, marginTop: 1 },
  orderMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.lime },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
  sectionSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },

  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reason: {
    width: "48.4%",
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    gap: 4,
  },
  reasonOn: { backgroundColor: C.ink, borderColor: C.ink },
  reasonIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  reasonIconOn: { backgroundColor: C.lime },
  reasonLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 14, letterSpacing: -0.2, color: C.text },
  reasonCopy: { fontFamily: fontFamilies.sans.regular, fontSize: 12, lineHeight: 16, color: C.muted },

  itemsCard: {
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  itemDivider: { borderTopWidth: 1, borderTopColor: C.line },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: C.ink, borderColor: C.ink },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f0ede2",
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.text },
  itemMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 2 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 4,
    borderRadius: 17,
    backgroundColor: C.accentSoft,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 16, textAlign: "center", fontFamily: fontFamilies.sans.bold, fontSize: 13.5, color: C.text },
  qtyFixed: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.muted },

  notes: {
    minHeight: 110,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: C.text,
  },
  disclaimer: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted, textAlign: "center", marginTop: 2 },

  footRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  footKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.6, color: C.muted },
  footSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 2 },
  footValue: { fontFamily: fontFamilies.sans.bold, fontSize: 22, letterSpacing: -0.5, color: C.text, fontVariant: ["tabular-nums"] },
  submitBtn: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.ink,
  },
  submitBtnOff: { opacity: 0.4 },
  submitText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.cream },
});
