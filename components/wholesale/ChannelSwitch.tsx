import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { isWholesaleEnabledMobile } from "@/lib/feature-flags";

/**
 * Retail ↔ Wholesale switch. Sits immediately under the masthead on every
 * main tab. Kept deliberately small so it reads as a channel tab, not a
 * primary action.
 */
export function ChannelSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const wholesale = pathname.includes("/wholesale");

  if (!isWholesaleEnabledMobile()) return null;

  const go = (target: "retail" | "wholesale") => {
    if (target === "wholesale" && !wholesale) {
      router.push("/(main)/wholesale" as never);
    } else if (target === "retail" && wholesale) {
      router.replace("/(main)" as never);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: !wholesale }}
          activeOpacity={0.8}
          onPress={() => go("retail")}
          style={[styles.tab, !wholesale && styles.tabActive]}
        >
          <Text style={[styles.tabText, !wholesale && styles.tabTextActive]}>Vestara</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: wholesale }}
          activeOpacity={0.8}
          onPress={() => go("wholesale")}
          style={[styles.tab, wholesale && styles.tabActiveWholesale]}
        >
          <Text style={[styles.tabText, wholesale && styles.tabTextWholesale]}>Wholesale</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint} numberOfLines={1}>
        {wholesale ? "B2B · MOQ pricing · WhatsApp orders" : "Retail · new season · islandwide"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22,23,15,0.06)",
    borderRadius: radii.full,
    padding: 2,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  tabActive: {
    backgroundColor: colors.ink.DEFAULT,
  },
  tabActiveWholesale: {
    backgroundColor: "#c9b27a",
  },
  tabText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  tabTextActive: {
    color: colors.paper.cream,
  },
  tabTextWholesale: {
    color: colors.ink.DEFAULT,
  },
  hint: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
});
