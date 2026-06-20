import React, { useMemo, useRef } from "react";
import { Modal, View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii } from "@/lib/theme/tokens";

interface PayHereCheckoutProps {
  visible: boolean;
  action: string;
  fields: Record<string, string>;
  orderId: string;
  confirming?: boolean;
  onClose: () => void;
  /** PayHere redirected to return_url — parent should poll payment_status. */
  onReturnFromGateway: () => void;
}

function isPayHereHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "payhere.lk" ||
      host.endsWith(".payhere.lk") ||
      host === "www.payhere.lk"
    );
  } catch {
    return false;
  }
}

function isPayHereSuccessReturn(url: string, orderId: string): boolean {
  // Require an exact match on the order_id query param — substring checks
  // on the raw URL are unsafe (an attacker could craft a URL containing
  // "order_id=<other>" + the target orderId).
  try {
    const parsed = new URL(url);
    if (!isPayHereHost(url)) return false;
    if (parsed.searchParams.get("success") !== "true") return false;
    return parsed.searchParams.get("order_id") === orderId;
  } catch {
    return false;
  }
}

function isPayHereCancelReturn(url: string, orderId: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isPayHereHost(url)) return false;
    if (parsed.searchParams.get("cancelled") !== "true") return false;
    return parsed.searchParams.get("order_id") === orderId;
  } catch {
    return false;
  }
}

/** HTML-escape every value interpolated into the PayHere auto-submit form. */
function htmlEscape(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}

export function PayHereCheckout({
  visible,
  action,
  fields,
  orderId,
  confirming = false,
  onClose,
  onReturnFromGateway,
}: PayHereCheckoutProps) {
  const handledRef = useRef(false);

  const html = useMemo(() => {
    const inputs = Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${htmlEscape(k)}" value="${htmlEscape(String(v))}" />`)
      .join("\n");
    return `<!DOCTYPE html><html><body onload="document.forms[0].submit()">
      <form method="post" action="${htmlEscape(action)}">${inputs}</form>
      <p style="font-family:sans-serif;text-align:center;padding:40px">Redirecting to PayHere…</p>
    </body></html>`;
  }, [action, fields]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={confirming ? undefined : onClose}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.close}
          disabled={confirming}
        >
          <Ionicons name="close" size={22} color={confirming ? colors.light.mutedForeground : colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>{confirming ? "Confirming payment…" : "Secure payment"}</Text>
        <View style={{ width: 40 }} />
      </View>
      {confirming ? (
        <View style={styles.confirming}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Text style={styles.confirmingText}>Waiting for payment confirmation…</Text>
        </View>
      ) : (
        <WebView
          source={{ html }}
          originWhitelist={["https://*.payhere.lk"]}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(req) => {
            // Only let the WebView navigate to PayHere origins. Anything
            // else (tel:, mailto:, javascript:, etc.) is dropped.
            return isPayHereHost(req.url) || req.url === "about:blank";
          }}
          onNavigationStateChange={(nav) => {
            if (handledRef.current) return;
            if (isPayHereCancelReturn(nav.url, orderId)) {
              handledRef.current = true;
              onClose();
              return;
            }
            if (isPayHereSuccessReturn(nav.url, orderId)) {
              handledRef.current = true;
              onReturnFromGateway();
            }
          }}
          startInLoadingState
        />
      )}
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
  confirming: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: colors.light.background,
  },
  confirmingText: {
    fontSize: 15,
    color: colors.light.mutedForeground,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
