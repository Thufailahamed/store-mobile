import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/supabase/auth";
import {
  deliveryPickupVerify,
  getReturnPickups,
  type ReturnPickup,
} from "@/lib/api";
import { takePhoto, uploadDeliveryFailureEvidence } from "@/lib/upload";
import { useTheme } from "@/lib/hooks/useTheme";
import { typography, radii } from "@/lib/theme/tokens";
import { isValidOtp, MAX_PICKUP_ATTEMPTS } from "@/lib/delivery-workflow";
import { ISSUE_REASONS, type IssueReason } from "@/lib/utils/delivery-format";

export default function ReturnPickupDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [pickup, setPickup] = useState<ReturnPickup | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [otp, setOtp] = useState("");
  // Phase 14 — pickup failure now uses categorical reasons + optional evidence.
  const [failReason, setFailReason] = useState<IssueReason | "">("");
  const [failNotes, setFailNotes] = useState("");
  const [failEvidenceUrl, setFailEvidenceUrl] = useState<string | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const styles = makeStyles(colors, isDark);

  const load = useCallback(async () => {
    const res = await getReturnPickups();
    if (res.ok) {
      setPickup(res.data.pickups.find((p) => p.id === id) ?? null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCaptureEvidence = async () => {
    if (!user?.id || !pickup) return;
    const pick = await takePhoto({ quality: 0.8 });
    if (!pick || pick.canceled || !pick.assets?.[0]?.uri) return;
    setUploadingEvidence(true);
    const uploaded = await uploadDeliveryFailureEvidence(
      user.id,
      pickup.id,
      pick.assets[0].uri,
      { reason: failReason || undefined },
    );
    setUploadingEvidence(false);
    if (uploaded.error || !uploaded.url) {
      // Soft fail — evidence is recommended, not required.
      return;
    }
    setFailEvidenceUrl(uploaded.url);
  };

  const runAction = (action: "start" | "verify" | "complete" | "fail") => {
    if (!pickup || !user) return;

    const confirmAndRun = async () => {
      setActing(true);
      // Phase 14 — categorical reason + evidence for fail; free-text reason
      // is the legacy fallback for older servers.
      const reasonText = failReason
        ? ISSUE_REASONS.find((r) => r.value === failReason)?.label ?? failReason
        : "";
      const composedReason =
        action === "fail"
          ? failNotes.trim()
            ? `${reasonText} — ${failNotes.trim()}`
            : reasonText || "Pickup failed"
          : undefined;
      const res = await deliveryPickupVerify(pickup.id, action, {
        otp: action === "verify" ? otp.trim() : undefined,
        reason: composedReason,
        failure_reason: action === "fail" ? (failReason || undefined) : undefined,
        failure_evidence_url: action === "fail" ? failEvidenceUrl : undefined,
        photo_url: action === "fail" ? failEvidenceUrl ?? undefined : undefined,
      });
      setActing(false);
      if (res.ok) {
        Alert.alert("Updated", `Pickup marked as ${res.data.status}.`);
        setFailReason("");
        setFailNotes("");
        setFailEvidenceUrl(null);
        load();
      } else {
        Alert.alert("Error", res.error);
      }
    };

    if (action === "fail") {
      if (!failReason) {
        Alert.alert("Reason required", "Pick a failure reason before submitting.");
        return;
      }
      Alert.alert(
        "Mark failed?",
        "The pickup will be marked failed and the buyer notified.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Fail", style: "destructive", onPress: confirmAndRun },
        ],
      );
      return;
    }

    if (action === "verify" && !isValidOtp(otp)) {
      Alert.alert("OTP required", "Enter the 6-digit pickup verification code.");
      return;
    }

    confirmAndRun();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!pickup) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Pickup not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const addr = pickup.pickup_address;
  const mapsUrl = addr
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        [addr.line1, addr.city, addr.postal_code].filter(Boolean).join(", "),
      )}`
    : null;

  const canStart = pickup.status === "scheduled";
  const canVerify = pickup.status === "out_for_pickup";
  const canComplete = pickup.status === "picked_up";
  const pickupAttempts =
    (pickup as { attempt_count?: number | null }).attempt_count ?? 0;
  const canFail =
    !["completed", "cancelled", "failed"].includes(pickup.status) &&
    pickupAttempts < MAX_PICKUP_ATTEMPTS;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backLink}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Return pickup</Text>
      <Text style={styles.status}>{pickup.status.replace(/_/g, " ")}</Text>

      {addr ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup address</Text>
          <Text style={styles.body}>
            {addr.full_name ? `${addr.full_name}\n` : ""}
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ""}
            {"\n"}
            {addr.city}, {addr.state} {addr.postal_code}
          </Text>
          {addr.phone ? (
            <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(`tel:${addr.phone}`)}>
              <Text style={styles.linkBtnText}>Call {addr.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {mapsUrl ? (
            <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(mapsUrl)}>
              <Text style={styles.linkBtnText}>Navigate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {canVerify ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verify pickup OTP</Text>
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      ) : null}

      {canFail ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Failure reason</Text>
          <View style={styles.chipRow}>
            {ISSUE_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[
                  styles.chip,
                  failReason === r.value && styles.chipActive,
                ]}
                onPress={() => setFailReason(r.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    failReason === r.value && styles.chipTextActive,
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.notesInput, { marginTop: 8 }]}
            value={failNotes}
            onChangeText={setFailNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.mutedForeground}
          />
          {failEvidenceUrl ? (
            <Text style={styles.evidenceOk}>✓ Evidence photo attached</Text>
          ) : (
            <TouchableOpacity
              style={[styles.evidenceBtn, uploadingEvidence && { opacity: 0.5 }]}
              onPress={handleCaptureEvidence}
              disabled={uploadingEvidence}
            >
              <Text style={styles.evidenceBtnText}>
                {uploadingEvidence ? "Uploading…" : "📸 Evidence photo (recommended)"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <View style={styles.actions}>
        {canStart ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => runAction("start")} disabled={acting}>
            <Text style={styles.primaryBtnText}>Start pickup run</Text>
          </TouchableOpacity>
        ) : null}
        {canVerify ? (
          <TouchableOpacity
            style={[styles.primaryBtn, (!isValidOtp(otp) || acting) && { opacity: 0.5 }]}
            onPress={() => runAction("verify")}
            disabled={!isValidOtp(otp) || acting}
          >
            <Text style={styles.primaryBtnText}>Verify & collect items</Text>
          </TouchableOpacity>
        ) : null}
        {canComplete ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => runAction("complete")} disabled={acting}>
            <Text style={styles.primaryBtnText}>Complete at hub</Text>
          </TouchableOpacity>
        ) : null}
        {canFail ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={() => runAction("fail")} disabled={acting}>
            <Text style={styles.dangerBtnText}>Mark failed</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const makeStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  isDark: boolean,
) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 24, paddingBottom: 40 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    muted: { color: colors.mutedForeground },
    backLink: { color: colors.primary, marginBottom: 16 },
    title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold as any, color: colors.foreground },
    status: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground, marginTop: 4, textTransform: "capitalize", marginBottom: 20 },
    section: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold as any, color: colors.mutedForeground, textTransform: "uppercase", marginBottom: 8 },
    body: { fontSize: typography.fontSizes.sm, lineHeight: 22, color: colors.foreground },
    linkBtn: { marginTop: 10, paddingVertical: 10, alignItems: "center", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
    linkBtnText: { color: colors.primary, fontWeight: typography.fontWeights.medium as any },
    otpInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 14,
      fontSize: 20,
      textAlign: "center",
      letterSpacing: 6,
      color: colors.foreground,
    },
    notesInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 12,
      color: colors.foreground,
    },
    actions: { gap: 10, marginTop: 8 },
    primaryBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radii.lg, alignItems: "center" },
    primaryBtnText: { color: colors.primaryForeground, fontWeight: typography.fontWeights.semibold as any },
    dangerBtn: {
      padding: 14,
      borderRadius: radii.lg,
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDark ? "#7f1d1d" : "#fecaca",
    },
    dangerBtnText: { color: isDark ? "#fca5a5" : "#dc2626", fontWeight: typography.fontWeights.semibold as any },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipActive: {
      borderColor: "#dc2626",
      backgroundColor: "#fef2f2",
    },
    chipText: {
      fontSize: typography.fontSizes.xs,
      color: colors.foreground,
    },
    chipTextActive: {
      color: "#dc2626",
      fontWeight: typography.fontWeights.semibold as any,
    },
    evidenceBtn: {
      marginTop: 10,
      padding: 10,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    evidenceBtnText: {
      color: colors.foreground,
      fontSize: typography.fontSizes.xs,
    },
    evidenceOk: {
      marginTop: 10,
      fontSize: typography.fontSizes.xs,
      color: "#16a34a",
    },
  });
