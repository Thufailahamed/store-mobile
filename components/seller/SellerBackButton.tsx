import React from "react";
import { TouchableOpacity, Text, View, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Props = {
  label?: string;
  fallbackHref?: string;
  onPress?: () => void;
  style?: ViewStyle;
  light?: boolean;
};

export function SellerBackButton({
  label = "Back",
  fallbackHref = "/(seller)",
  onPress,
  style,
  light = false,
}: Props) {
  const router = useRouter();
  const tint = light ? colors.paper.cream : colors.olive[800];

  return (
    <TouchableOpacity
      style={[styles.row, style]}
      onPress={() => {
        if (onPress) {
          onPress();
          return;
        }
        if (router.canGoBack()) router.back();
        else router.push(fallbackHref as any);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <View style={[styles.iconDisk, light && styles.iconDiskLight]}>
        <Ionicons name="chevron-back" size={18} color={tint} />
      </View>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 44,
    marginLeft: -2,
    paddingRight: 8,
  },
  iconDisk: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(83,94,44,0.08)",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
  },
  iconDiskLight: {
    backgroundColor: "rgba(250,248,241,0.12)",
    borderColor: "rgba(250,248,241,0.18)",
  },
  label: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
  },
});
