import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { getGuestOrderBackend } from "@/lib/api/backend";
import { getGuestPayHereSession } from "@/lib/api/payments";
import { PayHereCheckout } from "@/components/payments/PayHereCheckout";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export default function GuestLookupScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const { toast } = useToast();
  const [token, setToken] = useState(params.token ?? "");
  const [email, setEmail] = useState(params.email ?? "");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payhere, setPayhere] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{
    id?: string;
    order_number: string;
    status: string;
    payment_status: string;
    payment_method?: string;
    total: number;
    currency: string;
    delivery_date?: string | null;
    orders?: Array<{
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      total: number;
      currency: string;
    }>;
  } | null>(null);

  const lookup = async () => {
    const t = token.trim();
    if (!t) {
      setError("Enter the token from your confirmation email");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getGuestOrderBackend(t);
    setLoading(false);
    if (!res.ok) {
      setOrder(null);
      setError(res.error);
      return;
    }
    setOrder(res.data);
  };

  useEffect(() => {
    if (params.token) void lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payNow = async () => {
    if (!token.trim() || !email.trim()) {
      toast("Email is required to retry card payment", "error");
      return;
    }
    setPaying(true);
    const res = await getGuestPayHereSession(token.trim(), email.trim());
    setPaying(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setPayhere(res.data);
  };

  const unpaidCard =
    order &&
    order.payment_status !== "paid" &&
    (order.payment_method === "payhere" || order.payment_method === "stripe");

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Guest order" />
      <View style={styles.body}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Order email"
          placeholderTextColor={colors.light.mutedForeground}
          style={styles.input}
        />
        <Text style={styles.label}>Order token</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          placeholder="Paste your guest token"
          placeholderTextColor={colors.light.mutedForeground}
          style={styles.input}
        />
        <Button variant="brand" onPress={() => void lookup()}>Look up</Button>
        {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {order ? (
          <View style={styles.card}>
            <Text style={styles.num}>#{order.order_number}</Text>
            <Text style={styles.meta}>Status: {order.status}</Text>
            <Text style={styles.meta}>Payment: {order.payment_status}</Text>
            <Text style={styles.meta}>Total: {formatPrice(order.total, order.currency)}</Text>
            {order.delivery_date ? <Text style={styles.meta}>Delivery: {order.delivery_date}</Text> : null}
            {(order.orders ?? []).length > 1
              ? order.orders!.map((o) => (
                  <Text key={o.id} style={styles.meta}>
                    #{o.order_number} · {o.status} · {formatPrice(o.total, o.currency)}
                  </Text>
                ))
              : null}
            {unpaidCard ? (
              <Button variant="brand" onPress={() => void payNow()}>
                {paying ? "Starting…" : "Pay now"}
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>
      {payhere ? (
        <PayHereCheckout
          visible
          action={payhere.action}
          fields={payhere.fields}
          orderId={order?.id ?? token}
          onClose={() => setPayhere(null)}
          onReturnFromGateway={() => {
            setPayhere(null);
            toast("Payment submitted — refreshing", "success");
            void lookup();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  body: { padding: spacing[5], gap: 12 },
  label: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
  },
  error: { color: colors.light.destructive, fontFamily: fontFamilies.sans.regular },
  card: {
    marginTop: 8,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    gap: 4,
  },
  num: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground },
});
