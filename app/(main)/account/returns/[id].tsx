import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { Body, Display, Label, Price } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { getReturnByGroupId, type MobileReturnRequest } from "@/lib/api";
import { type ReturnStatus } from "@/lib/account-local";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const STATUS_TONE: Record<ReturnStatus, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; copy: string }> = {
  requested: {
    label: "Requested",
    bg: colors.accent2.ochre + "20",
    fg: colors.accent2.ochre,
    icon: "hourglass-outline",
    copy: "We have received your return request and notified the seller.",
  },
  approved: {
    label: "Approved",
    bg: colors.olive[100],
    fg: colors.olive[700],
    icon: "checkmark-circle-outline",
    copy: "Approved. Send the package back with the prepaid label.",
  },
  received: {
    label: "Received",
    bg: colors.olive[100],
    fg: colors.olive[700],
    icon: "archive-outline",
    copy: "Warehouse received the parcel. Refund is being processed.",
  },
  refunded: {
    label: "Refunded",
    bg: colors.olive[200],
    fg: colors.olive[800],
    icon: "card-outline",
    copy: "Refund issued to your original payment method.",
  },
  rejected: {
    label: "Rejected",
    bg: colors.light.destructive + "20",
    fg: colors.light.destructive,
    icon: "close-circle-outline",
    copy: "This return was rejected. Review the seller note for details.",
  },
};

const TIMELINE: ReturnStatus[] = ["requested", "approved", "received", "refunded"];

export default function ReturnDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [returnReq, setReturnReq] = useState<MobileReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !id) return;
    const userId = user.id;
    const groupId = id as string;
    let cancelled = false;
    getReturnByGroupId(userId, groupId).then((res) => {
      if (cancelled) return;
      if (res.ok) setReturnReq(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, id]);

  if (loading || !returnReq) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Return" />
        <View style={styles.loading}>
          <Body muted>{loading ? "Loading return…" : "Return not found"}</Body>
        </View>
      </SafeAreaView>
    );
  }

  const tone = STATUS_TONE[returnReq.status];
  const currentStepIndex = TIMELINE.indexOf(returnReq.status);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={`Return #${returnReq.return_number}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusCard, { backgroundColor: tone.bg }]}>
          <View style={styles.statusIconWrap}>
            <Ionicons name={tone.icon} size={26} color={tone.fg} />
          </View>
          <Display size="xl" style={{ color: tone.fg }}>{tone.label}</Display>
          <Body size="sm" style={{ color: tone.fg, opacity: 0.85, textAlign: "center" }}>
            {tone.copy}
          </Body>
        </View>

        {returnReq.status !== "rejected" && (
          <View style={styles.timeline}>
            <Display size="lg" style={styles.timelineTitle}>Progress</Display>
            <View style={styles.steps}>
              {TIMELINE.map((step, i) => {
                const isDone = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <View key={step} style={styles.step}>
                    <View style={[styles.stepDot, isDone && styles.stepDotDone, isCurrent && styles.stepDotCurrent]}>
                      {isDone ? (
                        <Ionicons name="checkmark" size={12} color={colors.light.primaryForeground} />
                      ) : (
                        <View style={styles.stepDotEmpty} />
                      )}
                    </View>
                    <View style={styles.stepInfo}>
                      <Body size="sm" style={[styles.stepLabel, isDone && styles.stepLabelDone]}>
                        {STATUS_TONE[step].label}
                      </Body>
                      {isCurrent && (
                        <Body muted size="xs">In progress</Body>
                      )}
                    </View>
                    {i < TIMELINE.length - 1 && (
                      <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Display size="lg" style={styles.cardTitle}>Order</Display>
          <View style={styles.cardRow}>
            <Body muted size="xs">Order number</Body>
            <Body size="sm">#{returnReq.order_number}</Body>
          </View>
          <View style={styles.cardRow}>
            <Body muted size="xs">Reason</Body>
            <Body size="sm" style={styles.cardRowEnd}>{returnReq.reason || "—"}</Body>
          </View>
          <View style={styles.cardRow}>
            <Body muted size="xs">Requested</Body>
            <Body size="sm">{new Date(returnReq.created_at).toLocaleString()}</Body>
          </View>
          {returnReq.received_at && (
            <View style={styles.cardRow}>
              <Body muted size="xs">Received</Body>
              <Body size="sm">{new Date(returnReq.received_at).toLocaleString()}</Body>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Display size="lg" style={styles.cardTitle}>Items</Display>
          {returnReq.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Body size="sm" numberOfLines={2}>{item.product_name}</Body>
                {item.variant_label && <Body muted size="xs">{item.variant_label}</Body>}
                <Body muted size="xs">Qty {item.quantity} · Unit {item.unit_price.toLocaleString()}</Body>
              </View>
              <View style={styles.itemRefund}>
                <Label style={styles.kicker}>Refund</Label>
                <Price style={styles.itemRefundValue}>{formatPrice(item.refund_amount, returnReq.currency)}</Price>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Label style={styles.kicker}>Total refund</Label>
            <Price style={styles.refundTotal}>{formatPrice(returnReq.refund_amount, returnReq.currency)}</Price>
          </View>
        </View>

        {returnReq.seller_note && (
          <View style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.olive[700]} />
              <Label style={styles.noteTitle}>Seller note</Label>
            </View>
            <Body size="sm" style={styles.noteBody}>{returnReq.seller_note}</Body>
          </View>
        )}

        <TouchableOpacity style={styles.supportBtn} onPress={() => router.push("/(main)/contact" as never)} activeOpacity={0.85}>
          <Ionicons name="headset-outline" size={16} color={colors.olive[950]} />
          <Label style={styles.supportBtnText}>Contact support</Label>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  statusCard: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[5],
    borderRadius: radii["2xl"],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  statusIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  timeline: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
  },
  timelineTitle: { marginBottom: spacing[3] },
  steps: { gap: 0 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[2],
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.border,
    zIndex: 2,
  },
  stepDotDone: { backgroundColor: colors.light.primary },
  stepDotCurrent: { backgroundColor: colors.accent2.ochre },
  stepDotEmpty: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light.mutedForeground, opacity: 0.4 },
  stepInfo: { flex: 1, marginLeft: spacing[3] },
  stepLabel: { color: colors.light.mutedForeground },
  stepLabelDone: { color: colors.light.foreground, fontWeight: typography.fontWeights.semibold },
  stepLine: {
    position: "absolute",
    left: 12,
    top: 36,
    width: 2,
    height: 26,
    backgroundColor: colors.light.border,
    zIndex: 1,
  },
  stepLineDone: { backgroundColor: colors.light.primary },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  cardTitle: { marginBottom: spacing[3] },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing[2],
  },
  cardRowEnd: { flex: 1, textAlign: "right", marginLeft: spacing[3] },
  itemRow: {
    flexDirection: "row",
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  itemRefund: { alignItems: "flex-end" },
  itemRefundValue: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.sm, color: colors.olive[700] },
  summaryCard: {
    backgroundColor: colors.olive[50],
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.olive[200],
    marginBottom: spacing[4],
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refundTotal: { fontFamily: fontFamilies.mono.semibold, fontSize: typography.fontSizes.xl, color: colors.olive[800] },
  noteCard: {
    backgroundColor: colors.olive[50],
    borderRadius: radii.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.olive[200],
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  noteHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  noteTitle: { color: colors.olive[700] },
  noteBody: { color: colors.light.foreground },
  supportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.olive[300],
  },
  supportBtnText: {
    color: colors.olive[950],
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.sm,
  },
  kicker: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
});
