import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { CouponField } from "./CouponField";

interface OrderSummaryProps {
  subtotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  couponCode: string | null;
  couponDiscount: number;
  userId?: string;
  onApplyCoupon: (code: string, discount: number) => void;
  onClearCoupon: () => void;
  onCheckout: () => void;
  canCheckout?: boolean;
  style?: ViewStyle;
}

export function OrderSummary({
  subtotal,
  shippingFee,
  tax,
  total,
  couponCode,
  couponDiscount,
  userId,
  onApplyCoupon,
  onClearCoupon,
  onCheckout,
  canCheckout = true,
  style,
}: OrderSummaryProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          ...(theme.isDark ? shadows.soft : shadows.editorial),
        },
        style,
      ]}
    >
      <View style={styles.titleRow}>
        <Label style={{ color: theme.olive[600] }}>Receipt</Label>
        <View style={[styles.dot, { backgroundColor: theme.olive[600] }]} />
      </View>
      <Display size="lg" style={{ marginTop: 4 }}>
        Order Summary
      </Display>

      <View
        style={[
          styles.rule,
          { backgroundColor: theme.colors.border, marginTop: 14 },
        ]}
      />

      <View style={styles.rows}>
        <Row
          label="Subtotal"
          value={formatPrice(subtotal)}
        />
        {couponDiscount > 0 ? (
          <Row
            label={`Discount · ${couponCode ?? ""}`}
            value={`- ${formatPrice(couponDiscount)}`}
            accent={theme.olive[600]}
          />
        ) : null}
        <Row
          label="Shipping"
          value={shippingFee === 0 ? "Complimentary" : formatPrice(shippingFee)}
          accent={shippingFee === 0 ? theme.olive[600] : undefined}
          italic={shippingFee === 0}
        />
        <Row label="Tax · 8%" value={formatPrice(tax)} muted />
      </View>

      <View
        style={[
          styles.rule,
          { backgroundColor: theme.colors.border, marginVertical: 12 },
        ]}
      />

      <View style={styles.totalRow}>
        <Display size="lg" style={{ color: theme.colors.foreground }}>
          Total
        </Display>
        <Price size="xl" style={{ color: theme.colors.foreground }}>
          {formatPrice(total)}
        </Price>
      </View>
      <Body muted size="xs" style={{ marginTop: 4, marginBottom: 16 }}>
        Taxes calculated at checkout · secure encrypted payment
      </Body>

      <CouponField
        userId={userId}
        subtotal={subtotal}
        appliedCode={couponCode}
        onApply={onApplyCoupon}
        onClear={onClearCoupon}
        style={{ marginBottom: 16 }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Proceed to checkout"
        onPress={onCheckout}
        disabled={!canCheckout}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.olive[700] },
          !canCheckout && { opacity: 0.5 },
          pressed && { opacity: 0.88 },
        ]}
      >
        <Label style={{ color: "#fff", fontSize: 12 }}>Proceed to checkout</Label>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>

      <View style={styles.trustRow}>
        <Trust
          icon="lock-closed-outline"
          label="Secure"
          color={theme.colors.mutedForeground}
        />
        <View
          style={[styles.trustDot, { backgroundColor: theme.colors.border }]}
        />
        <Trust
          icon="return-down-back-outline"
          label="14-day returns"
          color={theme.colors.mutedForeground}
        />
        <View
          style={[styles.trustDot, { backgroundColor: theme.colors.border }]}
        />
        <Trust
          icon="leaf-outline"
          label="Atelier-sourced"
          color={theme.colors.mutedForeground}
        />
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  muted,
  accent,
  italic,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: string;
  italic?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Label
        style={{
          color: accent ?? (muted ? theme.colors.mutedForeground : theme.colors.foreground),
          fontSize: 10,
        }}
      >
        {label}
      </Label>
      <Body
        size="sm"
        style={{
          color: accent ?? (muted ? theme.colors.mutedForeground : theme.colors.foreground),
          fontFamily: fontFamilies.display.regular,
          fontStyle: italic ? "italic" : "normal",
        }}
      >
        {value}
      </Body>
    </View>
  );
}

function Trust({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.trustItem}>
      <Ionicons name={icon} size={12} color={color} />
      <Label style={{ color, fontSize: 9 }}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rule: {
    height: 1,
    width: "100%",
  },
  rows: {
    marginTop: 14,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cta: {
    height: 56,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadows.glow,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
