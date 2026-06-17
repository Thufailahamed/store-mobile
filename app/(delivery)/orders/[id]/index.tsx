import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import {
  getOrderById,
  riderStartDelivery,
  riderVerifyDelivery,
  riderReportIssue,
  deliveryProofUpload,
  getOrderPackage,
  hasStoreApi,
} from "@/lib/api";
import { takePhoto, uploadDeliveryProof } from "@/lib/upload";
import { colors, typography, radii } from "@/lib/theme/tokens";
import {
  formatPrice,
  formatDate,
  mapsUrl,
  STATUS_COLORS,
  ISSUE_REASONS,
} from "@/lib/utils/delivery-format";
import type { Order } from "@/lib/types";

export default function DeliveryDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [issueReason, setIssueReason] = useState("");
  const [issueNote, setIssueNote] = useState("");
  const [reporting, setReporting] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const res = await getOrderById(id);
      if (res.ok && res.data) setOrder(res.data);
      setLoading(false);
    })();
  }, [id]);

  const handleStartDelivery = async () => {
    if (!order) return;
    setStarting(true);
    const res = await riderStartDelivery(order.id);
    setStarting(false);
    if (res.ok) {
      setOrder({ ...order, status: "out_for_delivery" } as any);
      Alert.alert("Out for delivery", `OTP: ${res.data.otp}`);
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleVerify = async () => {
    if (!order || !otp.trim()) return;
    setVerifying(true);
    const res = await riderVerifyDelivery(order.id, otp.trim());
    setVerifying(false);
    if (res.ok) {
      Alert.alert("Delivered!", `${order.order_number} marked as delivered`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert("Verification failed", res.error);
    }
  };

  const handleReportIssue = async () => {
    if (!order || !issueReason) return;
    setReporting(true);
    const status = issueReason === "customer_absent" ? "returned" : "cancelled";
    const reasonText = ISSUE_REASONS.find((r) => r.value === issueReason)?.label ?? issueReason;
    const fullReason = issueNote.trim() ? `${reasonText} — ${issueNote.trim()}` : reasonText;
    const res = await riderReportIssue(order.id, fullReason, status);
    setReporting(false);
    if (res.ok) {
      setOrder({ ...order, status, notes: fullReason });
      setShowReport(false);
      setIssueReason("");
      setIssueNote("");
      Alert.alert("Issue reported", reasonText);
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleOpenScan = async () => {
    if (!order || !hasStoreApi()) {
      router.push("/(delivery)/scan" as any);
      return;
    }
    const res = await getOrderPackage(order.id);
    if (res.ok && res.data.signed_token) {
      router.push(`/(delivery)/scan?token=${encodeURIComponent(res.data.signed_token)}` as any);
    } else {
      router.push("/(delivery)/scan" as any);
    }
  };

  const handleUploadProof = async () => {
    if (!order || !user?.id) return;
    const pick = await takePhoto({ quality: 0.8 });
    if (!pick || pick.canceled || !pick.assets?.[0]?.uri) return;

    setUploadingProof(true);
    const uploaded = await uploadDeliveryProof(user.id, order.id, pick.assets[0].uri);
    if (uploaded.error || !uploaded.url) {
      setUploadingProof(false);
      Alert.alert("Upload failed", uploaded.error ?? "Could not upload photo");
      return;
    }

    if (hasStoreApi()) {
      const res = await deliveryProofUpload(order.id, uploaded.url, "Delivery proof photo");
      setUploadingProof(false);
      if (res.ok) {
        Alert.alert("Proof saved", "Delivery photo uploaded successfully.");
      } else {
        Alert.alert("Error", res.error);
      }
      return;
    }

    setUploadingProof(false);
    Alert.alert("Proof saved locally", "Configure EXPO_PUBLIC_STORE_API_URL to sync proof to the server.");
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Order not found</Text>
      </View>
    );
  }

  const ship = order.shipping_address;
  const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
  const isCOD = order.payment_method === "cod";
  const isCODUnpaid = isCOD && order.payment_status !== "paid";
  const canStart = ["shipped", "processing", "confirmed"].includes(order.status);
  const canVerify = order.status === "out_for_delivery";
  const isCompleted = ["delivered", "returned", "cancelled", "refunded"].includes(order.status);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
              <Text style={styles.orderDate}>{formatDate(order.placed_at)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.text }]}>{order.status.replace(/_/g, " ")}</Text>
            </View>
          </View>
        </View>

        {/* Customer Card */}
        {ship && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <View style={styles.customerCard}>
              <Text style={styles.customerName}>{ship.full_name}</Text>
              <Text style={styles.customerPhone}>{ship.phone}</Text>
              <Text style={styles.customerAddress}>
                {ship.line1}{ship.line2 ? `, ${ship.line2}` : ""}, {ship.city}, {ship.state} {ship.postal_code}
              </Text>
              <View style={styles.customerActions}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => {
                    if (ship.phone) {
                      const cleaned = ship.phone.replace(/[^0-9+]/g, "");
                      Linking.openURL(`tel:${cleaned}`);
                    }
                  }}
                >
                  <Text style={styles.contactBtnText}>📞 Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => {
                    if (ship.phone) {
                      const cleaned = ship.phone.replace(/[^0-9+]/g, "");
                      const text = encodeURIComponent(`Hi ${ship.full_name?.split(" ")[0] ?? ""}, I'm your LUXE delivery rider.`);
                      Linking.openURL(`https://wa.me/${cleaned.replace(/^\+/, "")}?text=${text}`);
                    }
                  }}
                >
                  <Text style={styles.contactBtnText}>💬 WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(mapsUrl(ship))}
                >
                  <Text style={styles.contactBtnText}>📍 Navigate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                {item.variant_label && <Text style={styles.itemVariant}>{item.variant_label}</Text>}
                <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatPrice(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.summaryCard}>
            <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
            {order.discount > 0 && <SummaryRow label="Discount" value={`-${formatPrice(order.discount)}`} />}
            <SummaryRow label="Shipping" value={formatPrice(order.shipping_fee)} />
            {order.tax > 0 && <SummaryRow label="Tax" value={formatPrice(order.tax)} />}
            <View style={styles.summaryDivider} />
            <SummaryRow label="Total" value={formatPrice(order.total)} bold />
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Method</Text>
            <Text style={styles.paymentValue}>{order.payment_method?.toUpperCase() ?? "—"}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Status</Text>
            <Text style={[styles.paymentValue, order.payment_status === "paid" ? { color: "#16a34a" } : { color: "#d97706" }]}>
              {order.payment_status}
            </Text>
          </View>
          {isCODUnpaid && (
            <View style={styles.codAlert}>
              <Text style={styles.codAlertText}>💰 Collect {formatPrice(order.total)} on delivery</Text>
            </View>
          )}
        </View>

        {/* OTP Entry (for out_for_delivery) */}
        {canVerify && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verify Delivery</Text>
            <Text style={styles.otpHint}>Ask customer for their 6-digit OTP code</Text>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter 6-digit OTP"
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor={colors.light.mutedForeground}
            />
            <TouchableOpacity
              style={[styles.verifyButton, (verifying || otp.length < 6) && { opacity: 0.5 }]}
              onPress={handleVerify}
              disabled={verifying || otp.length < 6}
            >
              <Text style={styles.verifyButtonText}>
                {verifying ? "Verifying..." : "Verify & Mark Delivered"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {order.route_id ? (
            <TouchableOpacity
              style={[styles.scanButton, { backgroundColor: colors.light.primary + "15" }]}
              onPress={() => router.push(`/(delivery)/route-map?routeId=${order.route_id}` as any)}
            >
              <Text style={[styles.scanButtonText, { color: colors.light.primary }]}>
                🗺️ View route on map
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.scanButton} onPress={handleOpenScan}>
            <Text style={styles.scanButtonText}>📷 Scan package QR</Text>
          </TouchableOpacity>

          {canStart && (
            <TouchableOpacity
              style={[styles.startButton, starting && { opacity: 0.6 }]}
              onPress={handleStartDelivery}
              disabled={starting}
            >
              <Text style={styles.startButtonText}>
                {starting ? "Starting..." : "🚀 Start Delivery"}
              </Text>
            </TouchableOpacity>
          )}

          {!isCompleted && (
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => setShowReport(!showReport)}
            >
              <Text style={styles.reportButtonText}>⚠️ Report Issue</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Report Issue Form */}
        {showReport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Report Issue</Text>
            {ISSUE_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.issueOption, issueReason === r.value && styles.issueOptionActive]}
                onPress={() => setIssueReason(r.value)}
              >
                <Text style={[styles.issueOptionText, issueReason === r.value && styles.issueOptionTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              value={issueNote}
              onChangeText={setIssueNote}
              placeholder="Additional notes (optional)"
              placeholderTextColor={colors.light.mutedForeground}
            />
            <View style={styles.issueActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReport(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!issueReason || reporting) && { opacity: 0.5 }]}
                onPress={handleReportIssue}
                disabled={!issueReason || reporting}
              >
                <Text style={styles.submitBtnText}>{reporting ? "Submitting..." : "Submit"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Delivery Proof */}
        {order.delivered_at && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Info</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivered at</Text>
              <Text style={styles.infoValue}>{formatDate(order.delivered_at)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.verifyButton, uploadingProof && { opacity: 0.6 }]}
              onPress={handleUploadProof}
              disabled={uploadingProof}
            >
              <Text style={styles.verifyButtonText}>
                {uploadingProof ? "Uploading…" : "📸 Upload delivery proof"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: colors.light.mutedForeground },

  header: { marginBottom: 16 },
  backButton: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium as any,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    fontFamily: "monospace",
  },
  orderDate: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "capitalize",
  },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginBottom: 10,
  },

  customerCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
  },
  customerName: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  customerPhone: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  customerAddress: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    marginTop: 6,
    lineHeight: 20,
  },
  customerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  contactBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  contactBtnText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.medium as any,
  },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
    marginBottom: 8,
  },
  itemName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  itemVariant: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    textTransform: "capitalize",
    marginTop: 2,
  },
  itemQty: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },

  summaryCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  summaryLabelBold: { fontWeight: typography.fontWeights.bold as any, color: colors.light.foreground },
  summaryValue: { fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  summaryValueBold: { fontWeight: typography.fontWeights.bold as any },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    marginVertical: 8,
  },

  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  paymentLabel: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  paymentValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
    textTransform: "capitalize",
  },

  codAlert: {
    marginTop: 10,
    backgroundColor: "#fef9c3",
    borderRadius: radii.lg,
    padding: 12,
  },
  codAlertText: {
    fontSize: typography.fontSizes.sm,
    color: "#92400e",
    fontWeight: typography.fontWeights.semibold as any,
  },

  otpHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginBottom: 10,
  },
  otpInput: {
    backgroundColor: colors.light.card,
    borderWidth: 2,
    borderColor: colors.light.primary,
    borderRadius: radii.lg,
    padding: 16,
    fontSize: 24,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    textAlign: "center",
    fontFamily: "monospace",
    letterSpacing: 8,
  },
  verifyButton: {
    backgroundColor: "#16a34a",
    padding: 16,
    borderRadius: radii.lg,
    alignItems: "center",
    marginTop: 12,
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
  },

  actionSection: { gap: 10, marginBottom: 16 },
  scanButton: {
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    backgroundColor: colors.light.card,
  },
  scanButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  startButton: {
    backgroundColor: colors.light.primary,
    padding: 16,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  startButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
  },
  reportButton: {
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
  },
  reportButtonText: {
    color: "#dc2626",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },

  issueOption: {
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 8,
  },
  issueOptionActive: {
    borderColor: colors.light.primary,
    backgroundColor: "#f0f1e8",
  },
  issueOptionText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  issueOptionTextActive: {
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.primary,
  },

  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },

  issueActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  submitBtn: {
    flex: 1,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  submitBtnText: {
    fontSize: typography.fontSizes.sm,
    color: "#fff",
    fontWeight: typography.fontWeights.bold as any,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  infoLabel: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  infoValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
});
