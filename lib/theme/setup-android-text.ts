import { Platform, Text, TextInput } from "react-native";

/**
 * Android adds extra vertical padding around text and often ignores custom
 * fontFamily when fontWeight is also set. Apply global defaults once at startup.
 */
if (Platform.OS === "android") {
  const textDefaults = { ...(Text as unknown as { defaultProps?: object }).defaultProps };
  (Text as unknown as { defaultProps?: object }).defaultProps = {
    ...textDefaults,
    includeFontPadding: false,
  };

  const inputDefaults = { ...(TextInput as unknown as { defaultProps?: object }).defaultProps };
  (TextInput as unknown as { defaultProps?: object }).defaultProps = {
    ...inputDefaults,
    includeFontPadding: false,
  };
}
