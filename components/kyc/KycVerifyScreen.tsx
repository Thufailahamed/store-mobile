/**
 * Identity verification (KYC) — shared by the seller and brand apps.
 *
 * Shows the current state (not started / under review / verified /
 * rejected with the reviewer's reason) and, when allowed, the submit flow:
 * pick the document type, take or choose an ID photo and a selfie holding
 * it, submit. Photos are captured as JPEG at reduced quality so they stay
 * under the backend's 5 MB limit.
 */
import React, { useState } from "react";
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  getMyKyc, submitKyc, KYC_DOC_TYPES, KYC_MAX_BYTES, type KycDocType, type KycPhoto,
} from "@/lib/api/kyc";

const INK = colors.olive[950];
const CREAM = colors.paper.cream;
const GOLD = colors.accent2.ochre;

const STATE_COPY = {
  none: { icon: "shield-checkmark-outline", title: "Verify your identity", body: "A one-time check before payouts. Takes about two minutes.", tone: GOLD },
  pending: { icon: "hourglass-outline", title: "Under review", body: "We're checking your documents — usually within one business day. We'll notify you.", tone: GOLD },
  approved: { icon: "checkmark-circle", title: "You're verified", body: "Payouts and withdrawals are enabled on your account.", tone: "#7fbf7f" },
  rejected: { icon: "alert-circle", title: "Please resubmit", body: "We couldn't verify the photos you sent.", tone: "#e9958a" },
} as const;

async function capture(source: "camera" | "library", front: boolean): Promise<KycPhoto | null> {
  const perm = source === "camera"
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") {
    Alert.alert("Permission needed", `Allow ${source === "camera" ? "camera" : "photo library"} access in Settings to continue.`);
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.6, // re-encodes to JPEG; a 12 MP photo lands around 2–3 MB
    cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (a.fileSize && a.fileSize > KYC_MAX_BYTES) {
    Alert.alert("Photo too large", "Please use a photo under 5 MB.");
    return null;
  }
  const mime = a.mimeType && /^image\/(jpeg|png|webp)$/.test(a.mimeType) ? a.mimeType : "image/jpeg";
  return { uri: a.uri, mimeType: mime, fileName: a.fileName ?? null };
}

export function KycVerifyScreen({ fallbackHref }: { fallbackHref: string }) {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["kyc", "me"],
    queryFn: async () => {
      const r = await getMyKyc();
      if (!r.ok) throw new Error(r.error);
      return r.data.submissions;
    },
  });
  const latest = q.data?.[0];
  const state: keyof typeof STATE_COPY = latest?.status ?? "none";
  const canSubmit = state === "none" || state === "rejected";

  const [docType, setDocType] = useState<KycDocType>("nic");
  const [idDoc, setIdDoc] = useState<KycPhoto | null>(null);
  const [selfie, setSelfie] = useState<KycPhoto | null>(null);
  const doc = KYC_DOC_TYPES.find((d) => d.id === docType)!;

  const submit = useMutation({
    mutationFn: async () => {
      const r = await submitKyc({ idDoc: idDoc!, selfie, docType });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      toast.success("Submitted — we'll review it shortly");
      setIdDoc(null);
      setSelfie(null);
      void qc.invalidateQueries({ queryKey: ["kyc"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't submit"),
  });

  const pick = (which: "id" | "selfie") => {
    Alert.alert(which === "id" ? "ID photo" : "Selfie with ID", undefined, [
      { text: "Take photo", onPress: async () => { const p = await capture("camera", which === "selfie"); if (p) (which === "id" ? setIdDoc : setSelfie)(p); } },
      { text: "Choose from library", onPress: async () => { const p = await capture("library", false); if (p) (which === "id" ? setIdDoc : setSelfie)(p); } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const copy = STATE_COPY[state];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: CREAM }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[3], paddingBottom: insets.bottom + spacing[10], paddingHorizontal: spacing[4] }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
    >
      <SellerBackButton fallbackHref={fallbackHref} />

      {/* Status hero */}
      <View style={styles.hero}>
        {q.isLoading ? (
          <ActivityIndicator color={CREAM} />
        ) : (
          <>
            <View style={styles.heroRow}>
              <Ionicons name={copy.icon as never} size={22} color={copy.tone} />
              <Text style={styles.kicker}>IDENTITY CHECK</Text>
            </View>
            <Text style={styles.heroTitle}>{copy.title}</Text>
            <Text style={styles.heroBody}>{copy.body}</Text>
            {state === "rejected" && latest?.rejection_reason ? (
              <View style={styles.reason}>
                <Text style={styles.reasonLabel}>Reviewer's note</Text>
                <Text style={styles.reasonText}>{latest.rejection_reason}</Text>
              </View>
            ) : null}
            {latest ? (
              <Text style={styles.heroMeta}>
                Submitted {new Date(latest.submitted_at).toLocaleDateString()}
                {latest.reviewed_at ? ` · reviewed ${new Date(latest.reviewed_at).toLocaleDateString()}` : ""}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {q.error ? <Text style={styles.error}>{(q.error as Error).message}</Text> : null}

      {canSubmit && !q.isLoading ? (
        <>
          <Text style={styles.section}>1 · Document</Text>
          <View style={styles.docRow}>
            {KYC_DOC_TYPES.map((d) => {
              const on = d.id === docType;
              return (
                <TouchableOpacity key={d.id} onPress={() => setDocType(d.id)} style={[styles.docChip, on && styles.docChipOn]}
                  accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[styles.docChipText, on && styles.docChipTextOn]}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>2 · Photos</Text>
          <PhotoSlot title="ID photo" hint={doc.hint} photo={idDoc} onPress={() => pick("id")} onClear={() => setIdDoc(null)} icon="card-outline" />
          <PhotoSlot title="Selfie holding the ID (optional)" hint={doc.selfieHint} photo={selfie} onPress={() => pick("selfie")} onClear={() => setSelfie(null)} icon="person-circle-outline" />

          <View style={styles.tips}>
            {["Good light, no flash glare", "All four corners of the ID in frame", "Your face and the ID both clearly visible"].map((t) => (
              <View key={t} style={styles.tipRow}>
                <Ionicons name="checkmark" size={14} color={colors.olive[700]} />
                <Text style={styles.tipText}>{t}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submit, (!idDoc || submit.isPending) && styles.submitOff]}
            disabled={!idDoc || submit.isPending}
            onPress={() => submit.mutate()}
            accessibilityRole="button"
          >
            {submit.isPending ? <ActivityIndicator color={CREAM} /> : (
              <Text style={styles.submitText}>{state === "rejected" ? "Resubmit for review" : "Submit for review"}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.privacy}>Your documents are stored privately and only seen by the LUXE review team.</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

function PhotoSlot({ title, hint, photo, onPress, onClear, icon }: {
  title: string; hint: string; photo: KycPhoto | null; onPress: () => void; onClear: () => void; icon: string;
}) {
  return (
    <TouchableOpacity style={styles.slot} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={title}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.slotImg} />
      ) : (
        <View style={styles.slotEmpty}><Ionicons name={icon as never} size={26} color={colors.olive[700]} /></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.slotTitle}>{title}</Text>
        <Text style={styles.slotHint}>{photo ? "Tap to retake" : hint}</Text>
      </View>
      {photo ? (
        <TouchableOpacity onPress={onClear} hitSlop={10} accessibilityLabel={`Remove ${title}`}>
          <Ionicons name="close-circle" size={22} color={colors.ink.mute} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="camera-outline" size={20} color={colors.ink.mute} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing[3], backgroundColor: INK, borderRadius: 24, padding: spacing[5], minHeight: 140, justifyContent: "center" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, letterSpacing: 2, color: "rgba(250,248,241,0.55)" },
  heroTitle: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: CREAM, marginTop: spacing[2] },
  heroBody: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: "rgba(250,248,241,0.75)", marginTop: 4 },
  heroMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: "rgba(250,248,241,0.45)", marginTop: spacing[3] },
  reason: { marginTop: spacing[3], backgroundColor: "rgba(233,149,138,0.12)", borderRadius: radii.xl, padding: spacing[3] },
  reasonLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, letterSpacing: 1, color: "#e9958a" },
  reasonText: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: CREAM, marginTop: 2 },
  error: { color: colors.accent2.rust, marginTop: spacing[3], fontFamily: fontFamilies.sans.regular },
  section: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: INK, marginTop: spacing[6], marginBottom: spacing[2] },
  docRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  docChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.full, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(22,23,15,0.1)" },
  docChipOn: { backgroundColor: INK, borderColor: INK },
  docChipText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.ink.soft },
  docChipTextOn: { color: CREAM },
  slot: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "rgba(22,23,15,0.07)" },
  slotImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.paper.warm },
  slotEmpty: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.paper.warm, alignItems: "center", justifyContent: "center" },
  slotTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  slotHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, marginTop: 2 },
  tips: { marginTop: spacing[2], gap: 6 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.soft },
  submit: { marginTop: spacing[6], backgroundColor: INK, borderRadius: radii.full, paddingVertical: 15, alignItems: "center" },
  submitOff: { opacity: 0.4 },
  submitText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: CREAM },
  privacy: { textAlign: "center", fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute, marginTop: spacing[3] },
});
