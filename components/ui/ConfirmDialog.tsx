import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconTone?: "olive" | "destructive" | "amber";
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  description,
  icon = "shield-checkmark-outline",
  iconTone = "olive",
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null;

  const iconBg =
    iconTone === "destructive" || destructive
      ? "#fae2de"
      : iconTone === "amber"
      ? "#fdf3d7"
      : "#dde4d6";

  const iconColor =
    iconTone === "destructive" || destructive
      ? colors.light.destructive
      : iconTone === "amber"
      ? "#7a5b1a"
      : colors.olive[800];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Circular Icon Emblem */}
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>

          {/* Title in Fraunces Serif */}
          <Text style={styles.title}>{title}</Text>

          {/* Description */}
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}

          {/* Action Buttons Row */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCancel}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={onConfirm}
              style={[
                styles.confirmBtn,
                destructive ? styles.confirmBtnDestructive : styles.confirmBtnPrimary,
              ]}
            >
              <Text style={styles.confirmBtnText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 19, 14, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 24,
    alignItems: "center",
    ...shadows.soft,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.6)",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  description: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  btnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  confirmBtnPrimary: {
    backgroundColor: colors.olive[700],
  },
  confirmBtnDestructive: {
    backgroundColor: colors.light.destructive,
  },
  confirmBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#fff",
  },
});
