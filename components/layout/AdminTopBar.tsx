import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export function AdminTopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const isSubRoute =
    segments.length > 1 &&
    !["index", "approvals", "orders", "catalogue", "more"].includes(segments[segments.length - 1]);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing[2] }]}>
      {isSubRoute ? (
        <View style={styles.subRow}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(admin)");
              }
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={16} color={colors.light.primary} />
            <Label style={styles.btnText}>Back</Label>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => router.replace("/(main)" as never)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Back to store"
          >
            <Ionicons name="storefront-outline" size={14} color={colors.light.mutedForeground} />
            <Label style={styles.btnGhostText}>Storefront</Label>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.subRow}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace("/(main)" as never)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Back to store"
          >
            <Ionicons name="storefront-outline" size={15} color={colors.light.primary} />
            <Label style={styles.btnText}>Storefront</Label>
          </TouchableOpacity>

          <View style={styles.consoleBadge}>
            <View style={styles.consoleDot} />
            <Text style={styles.consoleBadgeText}>CONSOLE ACTIVE</Text>
          </View>
        </View>
      )}
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
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
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
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  btnGhostText: {
    color: colors.light.mutedForeground,
    fontSize: 11,
  },
  consoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  consoleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
  consoleBadgeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.olive[800],
    letterSpacing: 0.8,
  },
});

