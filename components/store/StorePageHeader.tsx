import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface StorePageHeaderProps {
  onBack: () => void;
  onShare: () => void;
}

export function StorePageHeader({ onBack, onShare }: StorePageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing[1] }]}>
      <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.75}>
        <Ionicons name="chevron-back" size={22} color={colors.light.foreground} />
      </TouchableOpacity>
      <Text style={styles.title}>BOUTIQUE</Text>
      <TouchableOpacity style={styles.iconBtn} onPress={onShare} activeOpacity={0.75}>
        <Ionicons name="share-outline" size={20} color={colors.light.foreground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.light.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 15,
    letterSpacing: 2.4,
    color: colors.light.foreground,
    textTransform: "uppercase",
  },
});
