import React, { useMemo } from "react";
import { Modal, View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { WebView } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii } from "@/lib/theme/tokens";

interface PayHereCheckoutProps {
  visible: boolean;
  action: string;
  fields: Record<string, string>;
  onClose: () => void;
  onComplete?: () => void;
}

export function PayHereCheckout({ visible, action, fields, onClose, onComplete }: PayHereCheckoutProps) {
  const html = useMemo(() => {
    const inputs = Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, "&quot;")}" />`)
      .join("\n");
    return `<!DOCTYPE html><html><body onload="document.forms[0].submit()">
      <form method="post" action="${action}">${inputs}</form>
      <p style="font-family:sans-serif;text-align:center;padding:40px">Redirecting to PayHere…</p>
    </body></html>`;
  }, [action, fields]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Secure payment</Text>
        <View style={{ width: 40 }} />
      </View>
      <WebView
        source={{ html }}
        onNavigationStateChange={(nav) => {
          if (nav.url.includes("success=true") || nav.url.includes("return_url")) {
            onComplete?.();
          }
        }}
        startInLoadingState
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.light.foreground,
  },
});
