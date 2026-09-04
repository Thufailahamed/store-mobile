import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

interface Props {
  store: Store;
}

export function StoreInfoCard({ store }: Props) {
  const rows: Array<{ icon: string; label: string; value: string }> = [
    { icon: "storefront-outline", label: "Name", value: store.name },
    { icon: "link-outline", label: "Slug", value: store.slug ?? "—" },
    { icon: "document-text-outline", label: "Description", value: store.description ?? "—" },
    { icon: "call-outline", label: "Phone", value: (store as Store & { contact_phone?: string | null }).contact_phone ?? "—" },
    { icon: "mail-outline", label: "Email", value: (store as Store & { contact_email?: string | null }).contact_email ?? "—" },
  ];
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Store info</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Ionicons name={r.icon as any} size={16} color={colors.light.mutedForeground} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowValue} numberOfLines={2}>
              {r.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[4],
    gap: spacing[3],
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3] },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowValue: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    marginTop: 2,
  },
});
