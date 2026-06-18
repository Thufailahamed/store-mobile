import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { takePhoto } from "@/lib/upload";
import {
  ISSUE_REASONS,
  type IssueReason,
  type IssueReasonMeta,
} from "@/lib/utils/delivery-format";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { SignatureCanvas } from "@/components/delivery/SignatureCanvas";

export interface FailureEvidencePayload {
  reason: IssueReason;
  notes: string;
  /** Local file URI captured in the sheet — parent does the canonical upload. */
  evidenceLocalUri: string | null;
  /** Signature data URL captured but not uploaded (rare for failure cases). */
  signatureUrl: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: FailureEvidencePayload) => void;
  /** Visual variant — currently no behavioural difference; reserved. */
  mode?: "delivery" | "pickup";
  defaultReason?: IssueReason;
  /** Submit-button label (e.g. "Mark failed" for pickup). */
  submitLabel?: string;
}

/**
 * Controlled sheet for capturing failure metadata:
 *  - categorical reason (chip list from ISSUE_REASONS)
 *  - free-text notes
 *  - optional failure-evidence photo (recommended, not required)
 *  - optional signature (rare for failure cases but supported)
 *
 * The photo is captured here as a local URI; the parent does the canonical
 * `uploadDeliveryFailureEvidence` after pairing the photo with the
 * order/pickup id (same `review-media` bucket, distinct
 * `failure-{reason}-{orderId}-{ts}` path).
 */
export function FailureEvidenceSheet({
  visible,
  onClose,
  onSubmit,
  mode = "delivery",
  defaultReason,
  submitLabel,
}: Props) {
  const [reason, setReason] = useState<IssueReason | "">(
    defaultReason ?? "",
  );
  const [notes, setNotes] = useState("");
  const [evidenceLocalUri, setEvidenceLocalUri] = useState<string | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  // Reset whenever the sheet is opened so state doesn't carry across orders.
  useEffect(() => {
    if (visible) {
      setReason(defaultReason ?? "");
      setNotes("");
      setEvidenceLocalUri(null);
      setSignatureUrl(null);
    }
  }, [visible, defaultReason]);

  const handleCaptureEvidence = async () => {
    const pick = await takePhoto({ quality: 0.8 });
    if (!pick || pick.canceled || !pick.assets?.[0]?.uri) return;
    setCapturingPhoto(true);
    setEvidenceLocalUri(pick.assets[0].uri);
    setCapturingPhoto(false);
  };

  const handleCaptureSignature = (dataUrl: string) => {
    // We don't upload signatures for failure cases — capture-only.
    setSignatureUrl(dataUrl);
    setSignatureModalOpen(false);
  };

  const submitDisabled = !reason;

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit({
      reason,
      notes: notes.trim(),
      evidenceLocalUri,
      signatureUrl,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Report delivery issue</Text>
            <Text style={styles.subtitle}>
              Pick a reason. Evidence is recommended but not required — submit works without a photo.
            </Text>

            <Text style={styles.sectionLabel}>Reason</Text>
            <View style={styles.chipsWrap}>
              {ISSUE_REASONS.map((r: IssueReasonMeta) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.chip, reason === r.value && styles.chipActive]}
                  onPress={() => setReason(r.value)}
                >
                  <Text style={[styles.chipText, reason === r.value && styles.chipTextActive]}>
                    {r.label}
                  </Text>
                  {r.evidenceRecommended ? (
                    <Text style={styles.chipMeta}>📸</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Anything that helps the next rider or admin…"
              placeholderTextColor={colors.light.mutedForeground}
            />

            <Text style={styles.sectionLabel}>Evidence photo (recommended)</Text>
            {evidenceLocalUri ? (
              <View style={styles.evidenceOk}>
                <Text style={styles.evidenceOkText}>✓ Photo attached (will upload on submit)</Text>
                <TouchableOpacity onPress={handleCaptureEvidence} disabled={capturingPhoto}>
                  <Text style={styles.evidenceReplace}>Replace</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.evidenceBtn, capturingPhoto && { opacity: 0.6 }]}
                onPress={handleCaptureEvidence}
                disabled={capturingPhoto}
              >
                <Text style={styles.evidenceBtnText}>
                  {capturingPhoto ? "Capturing…" : "📸 Take evidence photo"}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>Customer / witness signature (rare)</Text>
            {signatureUrl ? (
              <View style={styles.evidenceOk}>
                <Text style={styles.evidenceOkText}>✓ Signature captured</Text>
                <TouchableOpacity onPress={() => setSignatureModalOpen(true)}>
                  <Text style={styles.evidenceReplace}>Re-sign</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signatureBtn}
                onPress={() => setSignatureModalOpen(true)}
              >
                <Text style={styles.signatureBtnText}>✍️ Capture signature</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitDisabled && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={submitDisabled}
              >
                <Text style={styles.submitBtnText}>
                  {submitLabel ?? (mode === "pickup" ? "Mark pickup failed" : "Submit failure")}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      <SignatureCanvas
        visible={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        onCapture={handleCaptureSignature}
        descriptionText="Witness / customer signature"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "90%",
    paddingTop: 8,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.semibold as any,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipActive: {
    borderColor: colors.light.primary,
    backgroundColor: "#f0f1e8",
  },
  chipText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  chipTextActive: {
    color: colors.light.primary,
    fontWeight: typography.fontWeights.semibold as any,
  },
  chipMeta: {
    fontSize: 11,
  },
  notes: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    minHeight: 70,
    color: colors.light.foreground,
    textAlignVertical: "top",
    fontSize: typography.fontSizes.sm,
  },
  evidenceBtn: {
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
  },
  evidenceBtnText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  evidenceOk: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  evidenceOkText: {
    color: "#166534",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  evidenceReplace: {
    color: "#166534",
    fontSize: typography.fontSizes.xs,
    textDecorationLine: "underline",
  },
  signatureBtn: {
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
  },
  signatureBtnText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
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
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
  },
});
