/**
 * Shared building blocks for the welcome / sign-in / register screens:
 * soft-filled fields, the rounded-square back button, primary + outline
 * buttons, the "or" divider and the alternate-option tiles.
 */
import React, { forwardRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";

export const AUTH_PLACEHOLDER = "#a3a596";

export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.back, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={20} color={C.text} />
    </Pressable>
  );
}

type FieldProps = TextInputProps & {
  /** Rendered before the input (e.g. the +94 prefix). */
  leading?: React.ReactNode;
  /** Rendered after the input (e.g. a show-password eye). */
  trailing?: React.ReactNode;
  valid?: boolean;
  invalid?: boolean;
};

export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField(
  { leading, trailing, valid, invalid, onFocus, onBlur, style, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.field, focused && s.fieldFocused, invalid && s.fieldInvalid]}>
      {leading}
      <TextInput
        ref={ref}
        {...props}
        style={[s.input, style]}
        placeholderTextColor={AUTH_PLACEHOLDER}
        selectionColor={colors.olive[600]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      {trailing ??
        (valid ? <Ionicons name="checkmark-circle" size={20} color={colors.olive[600]} /> : null)}
    </View>
  );
});

export function PasswordEye({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={shown ? "Hide password" : "Show password"}
    >
      <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={21} color={C.muted} />
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [s.primary, disabled && s.primaryOff, pressed && !off && s.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={C.cream} />
      ) : (
        <Text style={s.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function OutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.outline, pressed && s.pressed]}
    >
      <Text style={s.outlineText}>{label}</Text>
    </Pressable>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <View style={s.orRow}>
      <View style={s.orLine} />
      <Text style={s.orText}>{label}</Text>
      <View style={s.orLine} />
    </View>
  );
}

export function AltTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.tile, pressed && s.pressed]}
    >
      <Ionicons name={icon} size={20} color={C.text} />
      <Text style={s.tileText}>{label}</Text>
    </Pressable>
  );
}

export function AuthFooterLink({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={s.footer}>
      <Text style={s.footerPrompt}>{prompt} </Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
        <Text style={s.footerAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  scroll: { flexGrow: 1, paddingHorizontal: 22 },
  title: {
    marginTop: 26,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: C.text,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14.5,
    lineHeight: 20,
    color: C.muted,
  },
  form: { marginTop: 28, gap: 14 },
  hint: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: -4, marginLeft: 4 },
  error: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.rust, marginTop: -4, marginLeft: 4 },
  link: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
});

const s = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  back: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 58,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#efede4",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  fieldFocused: { backgroundColor: "#FFFFFF", borderColor: colors.olive[600] },
  fieldInvalid: { borderColor: C.rust },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15.5,
    color: C.text,
    padding: 0,
  },
  primary: {
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.ink,
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.cream },
  outline: {
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.ink,
    backgroundColor: "transparent",
  },
  outlineText: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.text },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(22,23,15,0.1)" },
  orText: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: C.muted },
  tile: {
    flex: 1,
    height: 58,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
    backgroundColor: "#FFFFFF",
  },
  tileText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.text },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 8 },
  footerPrompt: { fontFamily: fontFamilies.sans.regular, fontSize: 14.5, color: C.text },
  footerAction: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: colors.olive[600] },
});
