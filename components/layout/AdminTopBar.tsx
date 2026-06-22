import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";

export function AdminTopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing[2] }]}>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace("/(main)" as never)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Back to store"
      >
        <Ionicons name="storefront-outline" size={16} color={colors.light.primary} />
        <Label style={styles.btnText}>Back to store</Label>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingBottom: spacing[2],
    backgroundColor: colors.light.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  btn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
  },
  btnText: {
    color: colors.light.primary,
    fontSize: 11,
  },
});
