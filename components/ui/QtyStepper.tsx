import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useTheme } from "@/lib/hooks/useTheme";
import { Body } from "./Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing } from "@/lib/theme/tokens";

type Size = "sm" | "md" | "lg";

interface QtyStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: Size;
  /** Disable the whole control. */
  disabled?: boolean;
  style?: ViewStyle;
}

const SIZE_MAP: Record<Size, { btn: number; icon: number; fontSize: number; px: number; py: number }> = {
  sm: { btn: 26, icon: 12, fontSize: 12, px: 10, py: 4 },
  md: { btn: 32, icon: 14, fontSize: 13, px: 12, py: 6 },
  lg: { btn: 40, icon: 16, fontSize: 14, px: 14, py: 8 },
};

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = "md",
  disabled,
  style,
}: QtyStepperProps) {
  const theme = useTheme();
  const s = SIZE_MAP[size];
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
          paddingHorizontal: s.px,
          paddingVertical: s.py,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityLabel="Decrease quantity"
        hitSlop={8}
        disabled={!canDec}
        onPress={() => canDec && onChange(value - 1)}
        style={({ pressed }) => [
          styles.btn,
          { width: s.btn, height: s.btn, borderRadius: s.btn / 2 },
          !canDec && { opacity: 0.35 },
          pressed && canDec && { backgroundColor: theme.colors.muted },
        ]}
      >
        <Ionicons name="remove" size={s.icon} color={theme.colors.foreground} />
      </Pressable>

      <View style={[styles.valueWrap, { minWidth: s.btn + 6 }]}>
        <Body
          style={{
            fontSize: s.fontSize,
            fontFamily: fontFamilies.mono.medium,
            letterSpacing: typography.letterSpacing.wide,
            color: theme.colors.foreground,
            textAlign: "center",
          }}
        >
          {String(value).padStart(2, "0")}
        </Body>
      </View>

      <Pressable
        accessibilityLabel="Increase quantity"
        hitSlop={8}
        disabled={!canInc}
        onPress={() => canInc && onChange(value + 1)}
        style={({ pressed }) => [
          styles.btn,
          { width: s.btn, height: s.btn, borderRadius: s.btn / 2 },
          !canInc && { opacity: 0.35 },
          pressed && canInc && { backgroundColor: theme.colors.muted },
        ]}
      >
        <Ionicons name="add" size={s.icon} color={theme.colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
  },
  valueWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[1],
  },
});
