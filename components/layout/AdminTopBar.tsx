import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";

/**
 * Admin header in the buyer Account screen's language: white circle buttons
 * on paper, a large display title on the Overview tab only (the other tab
 * roots render their own titles).
 */
export function AdminTopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const last = segments[segments.length - 1];

  const isSubRoute =
    segments.length > 1 && !["index", "approvals", "orders", "catalogue", "more"].includes(last);
  const isOverview = segments.length <= 1 || last === "index";

  const goStorefront = () => router.replace("/(main)" as never);

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top + 8, backgroundColor: isOverview ? C.glowSoft : C.paper },
      ]}
    >
      {isSubRoute ? (
        <>
          <CircleBtn
            icon="chevron-back"
            label="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(admin)"))}
          />
          <View style={{ flex: 1 }} />
          <CircleBtn icon="storefront-outline" label="Back to store" onPress={goStorefront} />
        </>
      ) : isOverview ? (
        <>
          <CircleBtn icon="storefront-outline" label="Back to store" onPress={goStorefront} />
          <Text style={styles.title} accessibilityRole="header">
            Admin
          </Text>
          <CircleBtn
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push("/(admin)/notifications" as never)}
          />
        </>
      ) : (
        <>
          <CircleBtn icon="storefront-outline" label="Back to store" onPress={goStorefront} />
          <View style={{ flex: 1 }} />
          <View style={styles.consolePill}>
            <View style={styles.consoleDot} />
            <Text style={styles.consoleText}>Console active</Text>
          </View>
        </>
      )}
    </View>
  );
}

function CircleBtn({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.circleBtn}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={19} color={C.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    letterSpacing: -0.8,
    color: C.text,
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  consolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.accentSoft,
  },
  consoleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[500] },
  consoleText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
});
