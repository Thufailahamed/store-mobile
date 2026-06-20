import React, { useCallback, useEffect, useState } from "react";
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
  Modal,
  Platform,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import {
  getOrderById,
  riderStartDelivery,
  riderVerifyDelivery,
  riderReportIssue,
  riderReschedule,
  deliveryProofUpload,
  getOrderPackage,
  hasStoreApi,
  isReassignAvailable,
  reassignDelivery,
} from "@/lib/api";
import {
  takePhoto,
  uploadDeliveryProof,
  uploadDeliverySignature,
  uploadDeliveryFailureEvidence,
} from "@/lib/upload";
import { SignatureCanvas } from "@/components/delivery/SignatureCanvas";
import {
  FailureEvidenceSheet,
  type FailureEvidencePayload,
} from "@/components/delivery/FailureEvidenceSheet";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { safeOpenUrl } from "@/lib/utils/safe-open-url";
import {
  MAX_DELIVERY_ATTEMPTS,
  attemptCount,
  canReassign,
  canReschedule,
  canStartDelivery,
  canVerifyDelivery,
  isDeliveryTerminal,
  isRetryAllowed,
  isValidOtp,
  targetStatusForReason,
  type DeliveryFailureContext,
} from "@/lib/delivery-workflow";
import {
  formatPrice,
  formatDate,
  mapsUrl,
  STATUS_COLORS,
} from "@/lib/utils/delivery-format";
import { formatWarehouseAddress } from "@/lib/utils/warehouse-address";
import { notifyDeliveryFailure } from "@/lib/notifications/assignments";
import type { Order } from "@/lib/types";
import {
  ISSUE_REASON_BY_VALUE,
  type IssueReason,
} from "@/lib/utils/delivery-format";

const ISSUE_REASON_LABEL_LOOKUP = (r: IssueReason) =>
  ISSUE_REASON_BY_VALUE[r].label;

export default function DeliveryDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [starting, setStarting] = useState(false);
  // Phase 14 — failure reporting now goes through FailureEvidenceSheet.
  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [reassignAvailable, setReassignAvailable] = useState<boolean | null>(null);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignRiderId, setReassignRiderId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  // Proof-of-delivery photo state. Required before handleVerify.
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [capturingProof, setCapturingProof] = useState(false);
  // Signature state. Recommended (not server-enforced) for verify_*; gated by
  // canSubmitVerify so the buyer tracking page surfaces both photo + signature.
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const refetchOrder = useCallback(async () => {
    if (!id) return;
    const res = await getOrderById(id);
    if (res.ok && res.data) setOrder(res.data);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // Reset proof + OTP state when the order id changes so we don't carry
    // state from a previous order (e.g. back-nav then open another).
    setProofUrl(null);
    setSignatureUrl(null);
    setOtp("");
    setShowReport(false);
    (async () => {
      const res = await getOrderById(id);
      if (res.ok && res.data) setOrder(res.data);
      setLoading(false);
    })();
  }, [id]);

  // Probe /api/delivery/reassign support once when the screen mounts so the
  // "Reassign" button is only rendered when the server can accept the call.
  useEffect(() => {
    let cancelled = false;
    isReassignAvailable()
      .then((ok: boolean) => {
        if (!cancelled) setReassignAvailable(ok);
      })
      .catch(() => {
        if (!cancelled) setReassignAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartDelivery = async () => {
    if (!order) return;
    // Workflow guard: can only start from "shipped".
    if (!canStartDelivery(order.status)) {
      Alert.alert(
        "Cannot start",
        `Order must be shipped before delivery can start (current: ${order.status}).`,
      );
      return;
    }
    setStarting(true);
    const res = await riderStartDelivery(order.id);
    setStarting(false);
    if (res.ok) {
      // Refetch from server to get the canonical post-transition state.
      await refetchOrder();
      Alert.alert("Out for delivery", `OTP: ${res.data.otp}`);
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleCaptureProof = async () => {
    if (!order || !user?.id) return;
    const pick = await takePhoto({ quality: 0.8 });
    if (!pick || pick.canceled || !pick.assets?.[0]?.uri) return;

    setCapturingProof(true);
    const uploaded = await uploadDeliveryProof(user.id, order.id, pick.assets[0].uri);
    if (uploaded.error || !uploaded.url) {
      setCapturingProof(false);
      Alert.alert("Upload failed", uploaded.error ?? "Could not upload proof");
      return;
    }
    setProofUrl(uploaded.url);
    // Sync the proof URL to the server-side proof record so verify RPCs can
    // enforce proof-required-at-deliver. Awaited — we surface failures so
    // the rider can retry before verifying.
    if (hasStoreApi()) {
      const res = await deliveryProofUpload(order.id, uploaded.url, "Delivery proof photo");
      setCapturingProof(false);
      if (!res.ok) {
        Alert.alert(
          "Proof record sync failed",
          `${res.error}\n\nYou can retry the photo or contact support.`,
        );
        // Drop the URL — without the server record the verify would reject.
        setProofUrl(null);
        return;
      }
    } else {
      setCapturingProof(false);
    }
  };

  const handleCaptureSignature = async (dataUrl: string) => {
    if (!order || !user?.id) return;
    setUploadingSignature(true);
    const uploaded = await uploadDeliverySignature(user.id, order.id, dataUrl);
    setUploadingSignature(false);
    if (uploaded.error || !uploaded.url) {
      Alert.alert("Signature upload failed", uploaded.error ?? "Try again");
      return;
    }
    setSignatureUrl(uploaded.url);
  };

  const handleOpenSignaturePad = () => setSignatureModalOpen(true);

  const handleVerify = async () => {
    if (!order) return;
    if (!isValidOtp(otp)) {
      Alert.alert("OTP required", "Enter the 6-digit code from the customer.");
      return;
    }
    if (!proofUrl) {
      Alert.alert(
        "Proof required",
        "Upload a delivery proof photo before verifying delivery.",
      );
      return;
    }
    if (!canVerifyDelivery(order.status)) {
      Alert.alert(
        "Cannot verify",
        `Order must be out_for_delivery before verify (current: ${order.status}).`,
      );
      return;
    }
    setVerifying(true);
    const res = await riderVerifyDelivery(order.id, otp.trim(), proofUrl, signatureUrl);
    setVerifying(false);
    if (res.ok) {
      // Refetch so local state matches the canonical post-transition state.
      await refetchOrder();
      Alert.alert("Delivered!", `${order.order_number} marked as delivered`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert("Verification failed", res.error);
    }
  };

  const handleReportFailure = async (payload: FailureEvidencePayload) => {
    if (!order) return;
    setReporting(true);
    const status = targetStatusForReason(payload.reason);
    const reasonText = ISSUE_REASON_LABEL_LOOKUP(payload.reason);
    const notesWithReason = payload.notes
      ? `${reasonText} — ${payload.notes}`
      : reasonText;
    const attempts = attemptCount(order) + 1;

    // The sheet captures the photo as a local URI only; the canonical
    // upload happens here so the storage path encodes the order id.
    let evidenceUrl: string | null = null;
    if (payload.evidenceLocalUri && user?.id) {
      const uploaded = await uploadDeliveryFailureEvidence(
        user.id,
        order.id,
        payload.evidenceLocalUri,
        { reason: payload.reason },
      );
      if (!uploaded.error && uploaded.url) evidenceUrl = uploaded.url;
    }

    const res = await riderReportIssue(
      order.id,
      notesWithReason,
      status,
      {
        failure_reason: payload.reason,
        failure_notes: payload.notes || undefined,
        failure_evidence_url: evidenceUrl,
        attempt_count: attempts,
      },
    );
    setReporting(false);
    if (res.ok) {
      // Real buyer notification now fires — only after server success.
      await notifyDeliveryFailure(order, payload.reason).catch(() => {
        // Swallow: the order already transitioned; notification is best-effort.
      });
      await refetchOrder();
      setShowReport(false);
      Alert.alert("Issue reported", reasonText);
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleReschedule = async () => {
    if (!order) return;
    setRescheduling(true);
    const res = await riderReschedule(order.id);
    setRescheduling(false);
    if (res.ok) {
      await refetchOrder();
      Alert.alert(
        "Rescheduled",
        "Order moved back to out_for_delivery for another attempt.",
      );
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const openReassignModal = () => {
    if (!order) return;
    setReassignRiderId("");
    setReassignModalOpen(true);
  };

  const closeReassignModal = () => {
    if (reassigning) return;
    setReassignModalOpen(false);
    setReassignRiderId("");
  };

  const submitReassign = async () => {
    if (!order) return;
    const toRiderId = reassignRiderId.trim();
    if (!toRiderId) {
      Alert.alert("Rider id required", "Enter the rider id to hand off to.");
      return;
    }
    setReassigning(true);
    const res = await reassignDelivery(order.id, toRiderId);
    setReassigning(false);
    if (res.ok) {
      setReassignModalOpen(false);
      setReassignRiderId("");
      await refetchOrder();
      Alert.alert("Reassigned", `Package handed off to ${toRiderId}.`);
    } else if (res.error === "reassign-not-supported") {
      Alert.alert(
        "Reassign unavailable",
        "The server doesn't expose the reassign endpoint yet. Contact admin.",
      );
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleReassign = openReassignModal;

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
  // Strict no-skip enforcement via the workflow module.
  const canStart = canStartDelivery(order.status);
  const canVerify = canVerifyDelivery(order.status);
  const isCompleted = isDeliveryTerminal(order.status);
  const otpValid = isValidOtp(otp);
  const canSubmitVerify = canVerify && Boolean(proofUrl) && otpValid;
  // Phase 14 — failure-recovery context. The order's most recent failure_reason
  // (categorical) is the source of truth for what the rider can do next.
  const orderAttempts = attemptCount(order);
  const failureCtx: DeliveryFailureContext = {
    attemptCount: orderAttempts,
    failureReason: order.failure_reason ?? null,
    failureEvidenceUrl: order.failure_evidence_url ?? null,
    previousRiderId: order.handoff_rider_id ?? null,
    lastFailedAt: order.failed_at ?? null,
    reassignAvailable: reassignAvailable === true,
  };
  const lastReason = order.failure_reason ?? null;
  const canRescheduleNow = canReschedule(order, lastReason) && isRetryAllowed(order, failureCtx);
  const canReassignNow = canReassign(order, failureCtx);
  const attemptsRemaining = Math.max(0, MAX_DELIVERY_ATTEMPTS - orderAttempts);
  const showRecoveryBanner = order.status === "returned" && orderAttempts > 0;

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

        {/* Pickup hub (store pickup leg) */}
        {(order as { pickup_warehouse?: { name?: string; address?: string | Record<string, unknown> } }).pickup_warehouse?.name ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned hub</Text>
            <View style={styles.hubCard}>
              <Text style={styles.hubName}>
                {(order as { pickup_warehouse?: { name?: string } }).pickup_warehouse!.name}
              </Text>
              {formatWarehouseAddress(
                (order as { pickup_warehouse?: { address?: string | Record<string, unknown> } }).pickup_warehouse?.address,
              ) ? (
                <Text style={styles.hubAddress}>
                  {formatWarehouseAddress(
                    (order as { pickup_warehouse?: { address?: string | Record<string, unknown> } }).pickup_warehouse!.address,
                  )}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

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
                      safeOpenUrl(`tel:${cleaned}`);
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
                      safeOpenUrl(`https://wa.me/${cleaned.replace(/^\+/, "")}?text=${text}`);
                    }
                  }}
                >
                  <Text style={styles.contactBtnText}>💬 WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => safeOpenUrl(mapsUrl(ship))}
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

            {/* Step 1: proof photo (required). */}
            {proofUrl ? (
              <View style={styles.proofOkCard}>
                <Text style={styles.proofOkText}>✓ Delivery proof uploaded</Text>
                <TouchableOpacity onPress={handleCaptureProof} disabled={capturingProof}>
                  <Text style={styles.proofReplace}>Replace photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.proofCaptureBtn, capturingProof && { opacity: 0.6 }]}
                onPress={handleCaptureProof}
                disabled={capturingProof}
              >
                <Text style={styles.proofCaptureBtnText}>
                  {capturingProof ? "Uploading…" : "📸 Take delivery proof photo (required)"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Step 2: signature (recommended). */}
            {signatureUrl ? (
              <View style={styles.proofOkCard}>
                <Text style={styles.proofOkText}>✓ Signature captured</Text>
                <TouchableOpacity onPress={handleOpenSignaturePad} disabled={uploadingSignature}>
                  <Text style={styles.proofReplace}>Re-sign</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.signatureBtn, uploadingSignature && { opacity: 0.6 }]}
                onPress={handleOpenSignaturePad}
                disabled={uploadingSignature}
              >
                <Text style={styles.signatureBtnText}>✍️ Capture customer signature</Text>
              </TouchableOpacity>
            )}

            {/* Step 3: OTP. */}
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
              style={[styles.verifyButton, (!canSubmitVerify || verifying) && { opacity: 0.5 }]}
              onPress={handleVerify}
              disabled={!canSubmitVerify || verifying}
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
              onPress={() => setShowReport(true)}
            >
              <Text style={styles.reportButtonText}>⚠️ Report Issue</Text>
            </TouchableOpacity>
          )}

          {/* Reschedule — only for recoverable reasons under the attempt cap. */}
          {canRescheduleNow && (
            <TouchableOpacity
              style={[styles.rescheduleButton, rescheduling && { opacity: 0.6 }]}
              onPress={handleReschedule}
              disabled={rescheduling}
            >
              <Text style={styles.rescheduleButtonText}>
                {rescheduling ? "Rescheduling…" : `🔁 Reschedule (${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} left)`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Reassign — hidden until isReassignAvailable() returns true. */}
          {canReassignNow && reassignAvailable === true && (
            <TouchableOpacity style={styles.reassignButton} onPress={handleReassign}>
              <Text style={styles.reassignButtonText}>🤝 Hand off to another rider</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Phase 14 — recovery banner when the order is recoverable. */}
        {showRecoveryBanner && (
          <View
            style={[
              styles.recoveryBanner,
              !canRescheduleNow && styles.recoveryBannerWarn,
            ]}
          >
            <Text style={styles.recoveryBannerTitle}>
              {canRescheduleNow
                ? `Recoverable — attempt ${orderAttempts} of ${MAX_DELIVERY_ATTEMPTS}`
                : "Max delivery attempts reached"}
            </Text>
            <Text style={styles.recoveryBannerBody}>
              {lastReason
                ? `Last reason: ${ISSUE_REASON_BY_VALUE[lastReason].label}.`
                : "Previous attempt failed."}
              {!canRescheduleNow
                ? " Escalate to admin before scheduling another attempt."
                : ""}
            </Text>
          </View>
        )}

        {/* Failure-evidence sheet — controlled, single source of truth for
            the reason picker + notes + photo + optional signature. */}
        <FailureEvidenceSheet
          visible={showReport}
          onClose={() => setShowReport(false)}
          onSubmit={handleReportFailure}
          mode="delivery"
          submitLabel={reporting ? "Submitting…" : "Submit failure"}
        />

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

      <SignatureCanvas
        visible={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        onCapture={handleCaptureSignature}
        onEmpty={() => Alert.alert("Signature empty", "Please sign before saving.")}
        descriptionText="Customer signature"
      />

      <Modal
        visible={reassignModalOpen}
        animationType="fade"
        transparent
        onRequestClose={closeReassignModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reassign rider</Text>
            <Text style={styles.modalHint}>
              Enter the rider id to hand off {order.order_number} to.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reassignRiderId}
              onChangeText={setReassignRiderId}
              placeholder="rider-uuid"
              placeholderTextColor={colors.light.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!reassigning}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={closeReassignModal}
                disabled={reassigning}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  (reassigning || !reassignRiderId.trim()) && { opacity: 0.5 },
                ]}
                onPress={submitReassign}
                disabled={reassigning || !reassignRiderId.trim()}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {reassigning ? "Reassigning…" : "Reassign"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

  hubCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
  },
  hubName: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  hubAddress: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
    lineHeight: 20,
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

  proofCaptureBtn: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
    padding: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    marginBottom: 12,
  },
  proofCaptureBtnText: {
    color: "#92400e",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  proofOkCard: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#16a34a",
    padding: 12,
    borderRadius: radii.lg,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  proofOkText: {
    color: "#166534",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  proofReplace: {
    color: "#166534",
    fontSize: typography.fontSizes.xs,
    textDecorationLine: "underline",
  },

  signatureBtn: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    marginBottom: 12,
  },
  signatureBtnText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
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

  rescheduleButton: {
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: "#f0f1e8",
    borderWidth: 1,
    borderColor: colors.light.primary,
    alignItems: "center",
  },
  rescheduleButtonText: {
    color: colors.light.primary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
  },

  reassignButton: {
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
  },
  reassignButtonText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },

  recoveryBanner: {
    backgroundColor: "#fef9c3",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#facc15",
    padding: 12,
    marginBottom: 16,
  },
  recoveryBannerWarn: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },
  recoveryBannerTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: "#92400e",
  },
  recoveryBannerBody: {
    fontSize: typography.fontSizes.xs,
    color: "#78350f",
    marginTop: 4,
    lineHeight: 18,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.light.background,
    borderRadius: radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  modalTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  modalHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 6,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: 12,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    fontFamily: "monospace",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: radii.md,
    alignItems: "center",
  },
  modalBtnGhost: {
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  modalBtnGhostText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
  },
  modalBtnPrimary: {
    backgroundColor: colors.light.primary,
  },
  modalBtnPrimaryText: {
    color: colors.light.primaryForeground,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
});
