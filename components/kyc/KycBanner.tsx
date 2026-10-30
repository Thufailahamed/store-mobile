import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const COPY = {
  none: { icon: "shield-checkmark-outline", title: "Verify your identity", body: "Required before you can withdraw earnings.", cta: "Start", bg: colors.olive[50], fg: colors.olive[800] },
  pending: { icon: "hourglass-outline", title: "Verification under review", body: "Withdrawals unlock once approved.", cta: "View", bg: "#fbf3df", fg: "#7a5a12" },
  rejected: { icon: "alert-circle-outline", title: "Verification needs resubmitting", body: "", cta: "Resubmit", bg: "#fbe9e6", fg: "#9b3426" },
} as const;

/** Prompt shown on payout screens until the merchant's KYC is approved. */
export function KycBanner({ status, reason, href }: { status: "none" | "pending" | "rejected"; reason?: string | null; href: string }) {
  const router = useRouter();
  const c = COPY[status];
  return (
    <TouchableOpacity
      onPress={() => router.push(href as never)}
      activeOpacity={0.85}
      style={[styles.wrap, { backgroundColor: c.bg }]}
      accessibilityRole="button"
      accessibilityLabel={c.title}
    >
      <Ionicons name={c.icon as never} size={20} color={c.fg} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.fg }]}>{c.title}</Text>
        <Text style={styles.body} numberOfLines={2}>{status === "rejected" && reason ? reason : c.body}</Text>
      </View>
      <Text style={[styles.cta, { color: c.fg }]}>{c.cta} ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[4] },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: 14 },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.soft, marginTop: 2 },
  cta: { fontFamily: fontFamilies.sans.semibold, fontSize: 13 },
});
