import React from "react";
import { TouchableOpacity, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { C } from "@/components/orders/parcel-track";

type Props = {
  /** Screen-reader label for the button (e.g. the screen it returns to). */
  label?: string;
  fallbackHref?: string;
  onPress?: () => void;
  style?: ViewStyle;
  light?: boolean;
};

/** Round white back button, matching the Orders screens' header chrome. */
export function SellerBackButton({
  label = "Back",
  fallbackHref = "/(seller)",
  onPress,
  style,
  light = false,
}: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.circle, light && styles.circleLight, style]}
      onPress={() => {
        if (onPress) {
          onPress();
          return;
        }
        if (router.canGoBack()) router.back();
        else router.push(fallbackHref as any);
      }}
      accessibilityRole="button"
      accessibilityLabel={label === "Back" ? "Back" : `Back to ${label}`}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      activeOpacity={0.8}
    >
      <Ionicons name="chevron-back" size={20} color={light ? C.cream : C.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
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
  circleLight: {
    backgroundColor: "rgba(250,248,241,0.14)",
    shadowOpacity: 0,
    elevation: 0,
  },
});
