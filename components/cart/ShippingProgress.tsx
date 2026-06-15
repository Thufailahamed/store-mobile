import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing } from "@/lib/theme/tokens";
import { formatPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/utils";

interface ShippingProgressProps {
  subtotal: number;
  style?: ViewStyle;
}

export function ShippingProgress({ subtotal, style }: ShippingProgressProps) {
  const theme = useTheme();
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const ratio = Math.max(0, Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD));
  const unlocked = remaining === 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: ratio * 100,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [ratio, widthAnim]);

  const widthInterpolated = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: unlocked
            ? `${theme.olive[600]}1A`
            : `${theme.olive[700]}14`,
          borderColor: unlocked ? theme.olive[600] : `${theme.olive[600]}55`,
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.iconBubble}>
          <Ionicons
            name={unlocked ? "checkmark" : "car-outline"}
            size={14}
            color={unlocked ? theme.colors.card : theme.olive[700]}
          />
        </View>
        <View style={{ flex: 1 }}>
          {unlocked ? (
            <Body
              size="sm"
              style={{
                color: theme.olive[700],
                fontFamily: fontFamilies.display.regular,
                fontStyle: "italic",
                fontSize: typography.fontSizes.md,
              }}
            >
              You've unlocked complimentary shipping
            </Body>
          ) : (
            <Body
              size="sm"
              style={{
                color: theme.olive[700],
                fontFamily: fontFamilies.display.regular,
              }}
            >
              Add{" "}
              <Body
                size="sm"
                style={{
                  fontFamily: fontFamilies.display.regular,
                  fontStyle: "italic",
                  color: theme.olive[700],
                }}
              >
                {formatPrice(remaining)}
              </Body>{" "}
              for complimentary shipping
            </Body>
          )}
        </View>
        <Label
          style={{
            color: theme.olive[700],
            fontFamily: fontFamilies.mono.semibold,
          }}
        >
          {Math.round(ratio * 100)}%
        </Label>
      </View>
      <View
        style={[
          styles.track,
          { backgroundColor: `${theme.olive[600]}33` },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthInterpolated,
              backgroundColor: theme.olive[600],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    padding: spacing[4],
    borderWidth: 1,
    gap: spacing[3],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
  },
});
