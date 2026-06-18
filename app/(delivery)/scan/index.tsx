import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/supabase/auth";
import {
  extractPackageToken,
  resolvePackageQr,
  scanPackage,
  verifyPackageDelivery,
  type PackageMeta,
  type PackageScanAction,
} from "@/lib/api/delivery-api";
import { resolveScanAction } from "@/lib/api/scan-action";
import { takePhoto, uploadDeliveryProof } from "@/lib/upload";
import { useTheme } from "@/lib/hooks/useTheme";
import { typography, radii } from "@/lib/theme/tokens";
import {
  isProofRequired,
  isScanActionLegal,
  isValidOtp,
  legalActions,
  type DeliveryAction,
  type ProofContext,
} from "@/lib/delivery-workflow";

const ACTION_LABELS: Record<string, string> = {
  pickup: "Pick up",
  "pickup:direct": "Pick up & deliver",
  "pickup:transit_to_warehouse": "Pick up → warehouse",
  receive: "Receive at hub",
  dispatch: "Dispatch",
  start_delivery: "Start delivery",
  verify_otp: "Verify OTP",
  verify_customer_qr: "Verify customer QR",
  fail_delivery: "Delivery failed",
  pack: "Mark packed",
};

export default function DeliveryScanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { token: deepToken } = useLocalSearchParams<{ token?: string }>();
  const { colors, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(!deepToken);
  const [token, setToken] = useState<string | null>(null);
  const [meta, setMeta] = useState<PackageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [otp, setOtp] = useState("");
  const [notes, setNotes] = useState("");
  const [scannedOnce, setScannedOnce] = useState(false);
  // Proof-of-delivery photo state. Required before any verify_* action.
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  // Customer-QR sub-scan: when true, the camera is shown waiting for a QR.
  const [awaitingCustomerQr, setAwaitingCustomerQr] = useState(false);

  const styles = makeStyles(colors, isDark);

  const proofCtx: ProofContext = {
    hasProofPhoto: Boolean(proofUrl),
    proofUrl,
  };

  const refreshMeta = useCallback(async (pkgToken: string) => {
    const res = await resolvePackageQr(pkgToken);
    if (res.ok) setMeta(res.data);
  }, []);

  const resolveToken = useCallback(
    async (raw: string) => {
      const pkgToken = extractPackageToken(raw);
      if (!pkgToken || pkgToken.length < 8) {
        Alert.alert("Invalid QR", "Could not read a package token from that code.");
        return;
      }
      setLoading(true);
      setScanning(false);
      const res = await resolvePackageQr(pkgToken);
      setLoading(false);
      if (!res.ok) {
        Alert.alert("Package not found", res.error);
        setScanning(true);
        setScannedOnce(false);
        return;
      }
      setToken(pkgToken);
      setMeta(res.data);
      // Reset transient state on new package.
      setProofUrl(null);
      setOtp("");
      setAwaitingCustomerQr(false);
    },
    [],
  );

  useEffect(() => {
    if (deepToken && typeof deepToken === "string") {
      resolveToken(deepToken);
    }
  }, [deepToken, resolveToken]);

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scannedOnce || loading) return;
      setScannedOnce(true);
      // Customer-QR sub-scan: forward the scanned token as customer_qr_token.
      if (awaitingCustomerQr && token) {
        setAwaitingCustomerQr(false);
        setActing(true);
        verifyPackageDelivery(token, {
          customer_qr_token: data.trim(),
          proof_url: proofUrl,
        })
          .then((res) => {
            setActing(false);
            if (res.ok) {
              Alert.alert("Delivered", "Customer QR verified.", [
                { text: "OK", onPress: () => router.replace("/(delivery)/orders") },
              ]);
            } else {
              Alert.alert("Verification failed", res.error);
              setScannedOnce(false);
              setAwaitingCustomerQr(true);
            }
          })
          .catch((e) => {
            setActing(false);
            Alert.alert("Verification failed", e?.message ?? "Network error");
            setScannedOnce(false);
            setAwaitingCustomerQr(true);
          });
        return;
      }
      resolveToken(data);
    },
    [awaitingCustomerQr, token, loading, scannedOnce, resolveToken, router],
  );

  const handleCaptureProof = async () => {
    if (!token || !user?.id) return;
    const pick = await takePhoto({ quality: 0.8 });
    if (!pick || pick.canceled || !pick.assets?.[0]?.uri) return;
    setUploadingProof(true);
    const uploaded = await uploadDeliveryProof(user.id, token, pick.assets[0].uri);
    setUploadingProof(false);
    if (uploaded.error || !uploaded.url) {
      Alert.alert("Upload failed", uploaded.error ?? "Could not upload proof");
      return;
    }
    setProofUrl(uploaded.url);
  };

  const runAction = async (action: DeliveryAction) => {
    if (!token) return;

    // Workflow guard: refuse illegal transitions client-side.
    if (meta) {
      const legality = isScanActionLegal(
        action,
        meta.package_status,
        meta.order_status,
        proofCtx,
      );
      if (!legality.ok) {
        Alert.alert("Action blocked", legality.reason);
        return;
      }
    }

    if (action === "verify_otp") {
      if (!isValidOtp(otp)) {
        Alert.alert("OTP required", "Enter the 6-digit code from the customer.");
        return;
      }
      if (!proofUrl) {
        Alert.alert("Proof required", "Upload a delivery proof photo before verifying.");
        return;
      }
      setActing(true);
      const res = await verifyPackageDelivery(token, { otp: otp.trim(), proof_url: proofUrl });
      setActing(false);
      if (res.ok) {
        Alert.alert("Delivered", "Package verified successfully.", [
          { text: "OK", onPress: () => router.replace("/(delivery)/orders") },
        ]);
      } else {
        Alert.alert("Verification failed", res.error);
      }
      return;
    }

    if (action === "verify_customer_qr") {
      if (!proofUrl) {
        Alert.alert("Proof required", "Upload a delivery proof photo before scanning the customer QR.");
        return;
      }
      // Switch the camera back on and wait for the customer QR.
      setAwaitingCustomerQr(true);
      setScanning(true);
      setScannedOnce(false);
      return;
    }

    setActing(true);
    const { bareAction, pickupDecision } = resolveScanAction(action);

    const res = await scanPackage(token, bareAction as PackageScanAction, {
      pickup_decision: pickupDecision,
      notes: notes.trim() || undefined,
    });
    setActing(false);

    if (res.ok) {
      Alert.alert("Success", `${ACTION_LABELS[action] ?? action} recorded.`, [
        {
          text: "OK",
          onPress: async () => {
            // Refetch package meta so the next action set reflects new state.
            await refreshMeta(token);
            setScanning(true);
            setScannedOnce(false);
          },
        },
      ]);
    } else {
      Alert.alert("Action failed", res.error);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={48} color={colors.mutedForeground} />
        <Text style={styles.permText}>Camera access is required to scan package QR codes.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Compute the visible action set using the workflow guard.
  const candidateActions: DeliveryAction[] = meta
    ? (
        (meta.next_action_options ?? meta.next_actions_for_role.map((a) => ({ action: a, decision: null })))
          .map((opt) => (opt.decision ? `${opt.action}:${opt.decision}` : opt.action) as DeliveryAction)
      )
    : [];
  const visibleActions = meta
    ? legalActions(candidateActions, meta.package_status, meta.order_status, proofCtx)
    : [];

  const proofRequiredFor = candidateActions.find((a) => isProofRequired(a));
  const needsProof = Boolean(proofRequiredFor);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan package</Text>
        <Text style={styles.subtitle}>
          {awaitingCustomerQr
            ? "Scan the buyer's delivery QR"
            : "Scan a package label to advance delivery status"}
        </Text>
      </View>

      {scanning && (!meta || awaitingCustomerQr) ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>
              {awaitingCustomerQr ? "Align customer QR within the frame" : "Align QR code within the frame"}
            </Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Resolving package…</Text>
        </View>
      ) : null}

      {meta && token ? (
        <ScrollView style={styles.metaScroll} contentContainerStyle={styles.metaContent}>
          <View style={styles.metaCard}>
            <Text style={styles.orderNumber}>{meta.order_number}</Text>
            <Text style={styles.metaLine}>Package · {meta.package_status}</Text>
            <Text style={styles.metaLine}>Order · {meta.order_status}</Text>
            {meta.buyer?.name ? <Text style={styles.metaLine}>Buyer · {meta.buyer.name}</Text> : null}
          </View>

          {needsProof ? (
            <View style={styles.proofCard}>
              <Text style={styles.proofTitle}>Proof of delivery (required)</Text>
              {proofUrl ? (
                <Text style={styles.proofOk}>✓ Photo uploaded</Text>
              ) : (
                <TouchableOpacity
                  style={styles.proofBtn}
                  onPress={handleCaptureProof}
                  disabled={uploadingProof}
                >
                  <Text style={styles.proofBtnText}>
                    {uploadingProof ? "Uploading…" : "📸 Take proof photo"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {visibleActions.length === 0 ? (
            <View style={styles.blockedCard}>
              <Text style={styles.blockedText}>
                No actions available. Verify order status and proof requirements.
              </Text>
            </View>
          ) : (
            visibleActions.map((action) => {
              const key = action as string;
              const needsOtp = action === "verify_otp";
              return (
                <View key={key}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      (acting || (needsOtp && (!isValidOtp(otp) || !proofUrl))) && { opacity: 0.5 },
                    ]}
                    onPress={() => runAction(action)}
                    disabled={acting || (needsOtp && (!isValidOtp(otp) || !proofUrl))}
                  >
                    <Text style={styles.actionBtnText}>
                      {ACTION_LABELS[key] ?? key.replace(/_/g, " ")}
                    </Text>
                  </TouchableOpacity>
                  {needsOtp ? (
                    <View style={styles.otpSection}>
                      <Text style={styles.otpLabel}>Customer OTP</Text>
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
                </View>
              );
            })
          )}

          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setMeta(null);
              setToken(null);
              setScanning(true);
              setScannedOnce(false);
              setProofUrl(null);
              setOtp("");
              setAwaitingCustomerQr(false);
            }}
          >
            <Text style={styles.secondaryBtnText}>Scan another</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {!meta && !loading ? (
        <View style={styles.manualSection}>
          <Text style={styles.manualLabel}>Or paste token manually</Text>
          <TextInput
            style={styles.manualInput}
            value={manualToken}
            onChangeText={setManualToken}
            placeholder="Package token"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => resolveToken(manualToken)}
            disabled={!manualToken.trim()}
          >
            <Text style={styles.primaryBtnText}>Look up</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  isDark: boolean,
) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
    header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 12 },
    title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold as any, color: colors.foreground },
    subtitle: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground, marginTop: 4 },
    cameraWrap: { marginHorizontal: 24, borderRadius: radii.xl, overflow: "hidden", height: 280 },
    camera: { flex: 1 },
    cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
    scanFrame: { width: 200, height: 200, borderWidth: 2, borderColor: "#fff", borderRadius: radii.lg },
    scanHint: { color: "#fff", marginTop: 16, fontSize: typography.fontSizes.sm },
    loadingText: { color: colors.mutedForeground },
    metaScroll: { flex: 1 },
    metaContent: { padding: 24, gap: 10, paddingBottom: 40 },
    metaCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 8,
    },
    orderNumber: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold as any, color: colors.foreground },
    metaLine: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground, marginTop: 4 },
    proofCard: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: 14,
      marginTop: 8,
    },
    proofTitle: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold as any, color: colors.foreground, marginBottom: 8 },
    proofOk: { fontSize: typography.fontSizes.sm, color: "#16a34a" },
    proofBtn: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: radii.lg,
      alignItems: "center",
    },
    proofBtnText: { color: colors.primaryForeground, fontWeight: typography.fontWeights.semibold as any },
    blockedCard: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    blockedText: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground, textAlign: "center" },
    actionBtn: {
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: radii.lg,
      alignItems: "center",
      marginTop: 6,
    },
    actionBtnText: { color: colors.primaryForeground, fontWeight: typography.fontWeights.semibold as any },
    otpSection: { marginTop: 8 },
    otpLabel: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground, marginBottom: 6 },
    otpInput: {
      backgroundColor: colors.card,
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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 12,
      marginTop: 8,
      color: colors.foreground,
    },
    manualSection: { padding: 24, gap: 10 },
    manualLabel: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground },
    manualInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: 12,
      color: colors.foreground,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: radii.lg,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.primaryForeground, fontWeight: typography.fontWeights.semibold as any },
    secondaryBtn: {
      padding: 14,
      borderRadius: radii.lg,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    secondaryBtnText: { color: colors.foreground },
    permText: { textAlign: "center", color: colors.mutedForeground, paddingHorizontal: 24 },
  });