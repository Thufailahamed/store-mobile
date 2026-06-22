import React from "react";
import { TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { navigateHome } from "@/lib/navigation";
import { colors, radii } from "@/lib/theme/tokens";

interface HomeBackButtonProps {
  style?: StyleProp<ViewStyle>;
  size?: number;
}

export function HomeBackButton({ style, size = 22 }: HomeBackButtonProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={() => navigateHome(router)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Back to home"
    >
      <Ionicons name="chevron-back" size={size} color={colors.light.foreground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
});
