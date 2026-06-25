import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { router } from "expo-router";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  role: "rider" | "delivery_company" | "admin";
  onClose?: () => void;
}

/**
 * Replaces the rider / delivery-company / admin delivery screens once
 * LUXE deliveries are handled by an external courier partner.
 */
export function CourierManagedExternally({ role, onClose }: Props) {
  const heading =
    role === "rider"
      ? "Rider portal disabled"
      : role === "delivery_company"
        ? "Logistics portal disabled"
        : "Internal delivery admin disabled";

  const body =
    role === "rider"
      ? "LUXE deliveries are now handled by an external delivery partner. There is no internal rider assignment — your services are no longer required."
      : role === "delivery_company"
        ? "LUXE deliveries are now fulfilled by an external delivery partner. The internal logistics portal is read-only."
        : "The internal rider / delivery-company pipeline has been retired. Use Courier Providers to manage external integrations.";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBubble}>
          <Ionicons name="bicycle-outline" size={28} color={colors.light.primary} />
        </View>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.body}>{body}</Text>

        {role === "admin" ? (
          <Pressable
            style={styles.cta}
            onPress={() => router.push("/(admin)/courier/index" as never)}
          >
            <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
            <Text style={styles.ctaText}>Open courier providers</Text>
          </Pressable>
        ) : null}

        {onClose ? (
          <Pressable style={styles.linkBtn} onPress={onClose}>
            <Text style={styles.linkText}>Back to home</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.light.primary}1A`,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.lg,
    marginTop: 4,
  },
  ctaText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },
  linkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  linkText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
  },
});