import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { BlurView } from "expo-blur";
import { Modal } from "@/components/ui/Modal";
import { Ionicons } from "@/components/ui/Icon";
import { radii } from "@/lib/theme/tokens";
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
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.94);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  const isDestructive = iconTone === "destructive" || destructive;
  const isAmber = iconTone === "amber";

  const haloBg = isDestructive
    ? "rgba(185, 45, 35, 0.08)"
    : isAmber
    ? "rgba(217, 169, 63, 0.12)"
    : "rgba(140, 148, 100, 0.12)";

  const haloBorder = isDestructive
    ? "rgba(185, 45, 35, 0.20)"
    : isAmber
    ? "rgba(217, 169, 63, 0.28)"
    : "rgba(140, 148, 100, 0.24)";

  const coreBg = isDestructive
    ? "#FCEBE8"
    : isAmber
    ? "#FBF5E6"
    : "#F1EFE6";

  const coreBorder = isDestructive
    ? "rgba(185, 45, 35, 0.25)"
    : isAmber
    ? "rgba(217, 169, 63, 0.35)"
    : "rgba(140, 148, 100, 0.28)";

  const iconColor = isDestructive
    ? "#B53023"
    : isAmber
    ? "#B58728"
    : "#4D582A";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.scrim} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Pressable style={styles.cardInner} onPress={(e) => e.stopPropagation()}>
            {/* Top gold accent jewel bar */}
            <View style={styles.topAccentBar} />

            {/* Double-Ring Crest Emblem */}
            <View style={[styles.emblemHalo, { backgroundColor: haloBg, borderColor: haloBorder }]}>
              <View style={[styles.emblemCore, { backgroundColor: coreBg, borderColor: coreBorder }]}>
                <Ionicons name={icon} size={22} color={iconColor} />
              </View>
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
                activeOpacity={0.84}
                onPress={onCancel}
                style={styles.cancelBtn}
                accessibilityRole="button"
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.84}
                onPress={onConfirm}
                style={[
                  styles.confirmBtn,
                  isDestructive ? styles.confirmBtnDestructive : styles.confirmBtnPrimary,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 20, 14, 0.48)",
  },
  card: {
    width: "100%",
    maxWidth: 340,
    shadowColor: "#0D1107",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 14,
  },
  cardInner: {
    width: "100%",
    backgroundColor: "#FAF8F2",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(100, 110, 70, 0.14)",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: "center",
  },
  topAccentBar: {
    width: 36,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(200, 164, 74, 0.35)",
    marginBottom: 16,
  },
  emblemHalo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 14,
  },
  emblemCore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: "#161A0A",
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 27,
    marginBottom: 8,
  },
  description: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    color: "rgba(22, 26, 10, 0.68)",
    textAlign: "center",
    lineHeight: 20.5,
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  btnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.18)",
    backgroundColor: "rgba(83, 94, 44, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#282E1A",
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnPrimary: {
    backgroundColor: "#161A0A",
    shadowColor: "#161A0A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnDestructive: {
    backgroundColor: "#A82E22",
    shadowColor: "#A82E22",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: "#FAF8F1",
    letterSpacing: 0.2,
  },
});
