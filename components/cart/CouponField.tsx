import React, { useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useTheme } from "@/lib/hooks/useTheme";
import { Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing } from "@/lib/theme/tokens";
import { useToast } from "@/components/ui/Toast";
import * as api from "@/lib/api";

interface CouponFieldProps {
  userId?: string;
  subtotal: number;
  appliedCode: string | null;
  onApply: (code: string, discount: number) => void;
  onClear: () => void;
  style?: ViewStyle;
}

export function CouponField({
  userId,
  subtotal,
  appliedCode,
  onApply,
  onClear,
  style,
}: CouponFieldProps) {
  const theme = useTheme();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleApply = async () => {
    if (!userId) {
      toast("Sign in to redeem a code", "error");
      return;
    }
    const code = draft.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    try {
      const res = await api.validateCoupon(code, userId, subtotal);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      if (res.data.message !== "OK" && res.data.message !== "OK_FREE_SHIPPING") {
        toast(res.data.message, "error");
        return;
      }
      const discount =
        res.data.message === "OK_FREE_SHIPPING" ? 0 : res.data.discount;
      onApply(code, discount);
      setDraft("");
      toast("Coupon applied", "success");
    } finally {
      setLoading(false);
    }
  };

  if (appliedCode) {
    return (
      <View
        style={[
          styles.applied,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.olive[600],
          },
          style,
        ]}
      >
        <View style={styles.appliedLeft}>
          <View
            style={[
              styles.appliedIcon,
              { backgroundColor: theme.olive[600] },
            ]}
          >
            <Ionicons name="pricetag" size={12} color={theme.colors.card} />
          </View>
          <View>
            <Label style={{ color: theme.colors.foreground }}>
              {appliedCode}
            </Label>
            <Body muted size="xs" style={{ marginTop: 2 }}>
              Code applied to this order
            </Body>
          </View>
        </View>
        <Pressable
          hitSlop={10}
          onPress={onClear}
          accessibilityLabel="Remove coupon"
        >
          <Label style={{ color: theme.olive[700] }}>Remove</Label>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Label
        style={{
          color: theme.colors.mutedForeground,
          marginBottom: 6,
        }}
      >
        Have a code?
      </Label>
      <View
        style={[
          styles.row,
          {
            backgroundColor: theme.colors.card,
            borderColor: focused ? theme.colors.ring : theme.colors.border,
          },
        ]}
      >
        <Ionicons
          name="ticket-outline"
          size={16}
          color={theme.colors.mutedForeground}
          style={{ marginRight: 10 }}
        />
        <TextInput
          value={draft}
          onChangeText={(t) => setDraft(t.toUpperCase())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Enter code"
          placeholderTextColor={theme.colors.mutedForeground}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleApply}
          style={[
            styles.input,
            {
              color: theme.colors.foreground,
              fontFamily: fontFamilies.mono.medium,
              letterSpacing: typography.letterSpacing.wide,
            },
          ]}
        />
        <Pressable
          onPress={handleApply}
          disabled={!draft.trim() || loading}
          hitSlop={6}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: theme.olive[700] },
            (!draft.trim() || loading) && { opacity: 0.5 },
            pressed && { opacity: 0.75 },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Label style={{ color: "#fff" }}>Apply</Label>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSizes.base,
    height: "100%",
  },
  applyBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  applied: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  appliedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appliedIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
