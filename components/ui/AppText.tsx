import React from "react";
import { Text, type TextProps, type StyleProp, type TextStyle } from "react-native";
import { androidSafeTextStyle } from "@/lib/theme/platform-text";

/** Cross-platform Text with Android font parity fixes applied. */
export function AppText({ style, ...props }: TextProps) {
  return <Text style={androidSafeTextStyle(style as StyleProp<TextStyle>)} {...props} />;
}
