import React, { useEffect, useRef, useState } from "react";
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
import {
  dismissThemedAlert,
  subscribeThemedAlert,
  type ThemedAlertButton,
  type ThemedAlertRequest,
} from "@/lib/themed-alert";

type AlertTone = "destructive" | "success" | "ai" | "info";

interface ToneConfig {
  tone: AlertTone;
  icon: keyof typeof Ionicons.glyphMap;
  haloBg: string;
  haloBorder: string;
  coreBg: string;
  coreBorder: string;
  iconColor: string;
}

function resolveToneConfig(
  title: string,
  message?: string,
  hasDestructiveButton?: boolean,
): ToneConfig {
  if (hasDestructiveButton) {
    return {
      tone: "destructive",
      icon: "alert-circle-outline",
      haloBg: "rgba(185, 45, 35, 0.08)",
      haloBorder: "rgba(185, 45, 35, 0.20)",
      coreBg: "#FCEBE8",
      coreBorder: "rgba(185, 45, 35, 0.25)",
      iconColor: "#B53023",
    };
  }

  const combined = `${title} ${message ?? ""}`.toLowerCase();

  if (
    combined.includes("delete") ||
    combined.includes("remove") ||
    combined.includes("cancel") ||
    combined.includes("error") ||
    combined.includes("failed") ||
    combined.includes("discard") ||
    combined.includes("reject") ||
    combined.includes("danger")
  ) {
    return {
      tone: "destructive",
      icon: "alert-circle-outline",
      haloBg: "rgba(185, 45, 35, 0.08)",
      haloBorder: "rgba(185, 45, 35, 0.20)",
      coreBg: "#FCEBE8",
      coreBorder: "rgba(185, 45, 35, 0.25)",
      iconColor: "#B53023",
    };
  }

  if (
    combined.includes("success") ||
    combined.includes("saved") ||
    combined.includes("done") ||
    combined.includes("copied") ||
    combined.includes("ready") ||
    combined.includes("approved") ||
    combined.includes("complete") ||
    combined.includes("published")
  ) {
    return {
      tone: "success",
      icon: "checkmark-circle-outline",
      haloBg: "rgba(50, 130, 65, 0.08)",
      haloBorder: "rgba(50, 130, 65, 0.20)",
      coreBg: "#EDF5EC",
      coreBorder: "rgba(50, 130, 65, 0.25)",
      iconColor: "#2B7A35",
    };
  }

  if (
    combined.includes("ai") ||
    combined.includes("sparkle") ||
    combined.includes("magic") ||
    combined.includes("generate") ||
    combined.includes("analyze") ||
    combined.includes("draft")
  ) {
    return {
      tone: "ai",
      icon: "sparkles",
      haloBg: "rgba(217, 169, 63, 0.12)",
      haloBorder: "rgba(217, 169, 63, 0.28)",
      coreBg: "#FBF5E6",
      coreBorder: "rgba(217, 169, 63, 0.35)",
      iconColor: "#B58728",
    };
  }

  return {
    tone: "info",
    icon: "information-outline",
    haloBg: "rgba(140, 148, 100, 0.12)",
    haloBorder: "rgba(140, 148, 100, 0.24)",
    coreBg: "#F1EFE6",
    coreBorder: "rgba(140, 148, 100, 0.28)",
    iconColor: "#4D582A",
  };
}

/** Mount once in the root layout. Renders whatever themedAlert() last requested with luxury styling. */
export function ThemedAlertHost() {
  const [request, setRequest] = useState<ThemedAlertRequest | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeThemedAlert(setRequest), []);

  useEffect(() => {
    if (request) {
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
  }, [request?.id, scaleAnim, opacityAnim]);

  if (!request) return null;

  const { buttons } = request;
  const destructive = buttons.some((b) => b.style === "destructive");
  const cancel = buttons.find((b) => b.style === "cancel");
  const stacked = buttons.length > 2;

  const press = (button: ThemedAlertButton) => {
    dismissThemedAlert();
    button.onPress?.();
  };

  const dismiss = () => {
    dismissThemedAlert();
    cancel?.onPress?.();
  };

  const tone = resolveToneConfig(request.title, request.message, destructive);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
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
            {/* Top gold ambient jewel bar */}
            <View style={styles.topAccentBar} />

            {/* Double-Ring Crest Emblem */}
            <View style={[styles.emblemHalo, { backgroundColor: tone.haloBg, borderColor: tone.haloBorder }]}>
              <View style={[styles.emblemCore, { backgroundColor: tone.coreBg, borderColor: tone.coreBorder }]}>
                <Ionicons name={tone.icon} size={22} color={tone.iconColor} />
              </View>
            </View>

            <Text style={styles.title}>{request.title}</Text>
            {request.message ? <Text style={styles.message}>{request.message}</Text> : null}

            <View style={[styles.btnRow, stacked && styles.btnColumn]}>
              {buttons.map((button, index) => {
                const label = button.text ?? "OK";
                const isCancel = button.style === "cancel";
                const isDestructive = button.style === "destructive";
                const isPrimary = !isCancel && !isDestructive;

                return (
                  <TouchableOpacity
                    key={`${index}-${label}`}
                    activeOpacity={0.84}
                    onPress={() => press(button)}
                    accessibilityRole="button"
                    style={[
                      styles.btn,
                      stacked || buttons.length === 1 ? styles.btnFull : styles.btnHalf,
                      isCancel && styles.btnCancel,
                      isDestructive && styles.btnDestructive,
                      isPrimary && styles.btnPrimary,
                    ]}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isCancel && styles.btnTextCancel,
                        (isPrimary || isDestructive) && styles.btnTextLuxe,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
  message: {
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
  btnColumn: {
    flexDirection: "column",
    gap: 8,
  },
  btn: {
    height: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  btnHalf: { flex: 1 },
  btnFull: { width: "100%" },
  btnPrimary: {
    backgroundColor: "#161A0A",
    shadowColor: "#161A0A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDestructive: {
    backgroundColor: "#A82E22",
    shadowColor: "#A82E22",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  btnCancel: {
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.18)",
    backgroundColor: "rgba(83, 94, 44, 0.08)",
  },
  btnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
  },
  btnTextLuxe: {
    color: "#FAF8F1",
    fontFamily: fontFamilies.sans.bold,
    letterSpacing: 0.2,
  },
  btnTextCancel: {
    color: "#282E1A",
  },
});
