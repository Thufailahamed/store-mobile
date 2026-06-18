import React, { useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SignatureScreen from "react-native-signature-canvas";
import { colors, radii, typography } from "@/lib/theme/tokens";

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Called with the base64 PNG dataURL when the rider taps Save and the
   * signature is non-empty. The parent uploads the URL via
   * `uploadDeliverySignature` and stores the public URL.
   */
  onCapture: (dataUrl: string) => void;
  /**
   * Called when the rider taps Save on an empty signature. Useful for
   * surfacing "Please sign before saving".
   */
  onEmpty?: () => void;
  descriptionText?: string;
}

/**
 * Modal signature capture backed by `react-native-signature-canvas` (which
 * renders a WebView under the hood). Provides Clear + Save buttons and a
 * Cancel button. The parent is responsible for uploading the base64 PNG
 * and persisting the public URL — this component is capture-only.
 */
export function SignatureCanvas({
  visible,
  onClose,
  onCapture,
  onEmpty,
  descriptionText = "Customer signature",
}: Props) {
  const ref = useRef<any>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    // readSignature triggers onOK (dataURL) or onEmpty when nothing was drawn.
    ref.current?.readSignature();
  };

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Capture signature</Text>
          <Text style={styles.subtitle}>{descriptionText}</Text>
        </View>

        <View style={styles.canvasWrap}>
          <SignatureScreen
            ref={ref}
            onOK={(img: string) => {
              setSaving(false);
              onCapture(img);
              onClose();
            }}
            onEmpty={() => {
              setSaving(false);
              onEmpty?.();
            }}
            onClear={() => {
              // No-op — handled by Clear button below.
            }}
            autoClear={false}
            imageType="image/png"
            backgroundColor={colors.light.card}
            penColor={colors.light.foreground}
            descriptionText={descriptionText}
            webStyle={WEB_STYLE}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleClear}>
            <Text style={styles.secondaryBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const WEB_STYLE = `
  .m-signature-pad { box-shadow: none; border: none; }
  .m-signature-pad--body { border: 1px dashed #d4d4d8; border-radius: 12px; }
  .m-signature-pad--footer { display: none; }
  body, html { background-color: ${colors.light.background}; }
`;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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
  },
  canvasWrap: {
    flex: 1,
    margin: 16,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.light.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.light.card,
    fontWeight: typography.fontWeights.bold as any,
    fontSize: typography.fontSizes.base,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    backgroundColor: colors.light.card,
  },
  secondaryBtnText: {
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.medium as any,
    fontSize: typography.fontSizes.sm,
  },
});