import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { Body, Label } from "@/components/ui/Typography";
import {
  getPriceAlertStatusBackend,
  subscribePriceAlertBackend,
  updatePriceAlertBackend,
  unsubscribePriceAlertBackend,
} from "@/lib/api/backend";
import { useAuth } from "@/lib/supabase/auth";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

type Props = {
  productId: string;
  variantId?: string | null;
  currency: string;
  currentPrice: number;
};

type AlertState = {
  subscribed: boolean;
  alertId?: string;
  threshold?: number | null;
};

export function PriceAlertPill({ productId, variantId, currency, currentPrice }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<AlertState>({ subscribed: false });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  React.useEffect(() => {
    if (!user?.id || checked) return;
    (async () => {
      const r = await getPriceAlertStatusBackend(productId, variantId ?? undefined);
      if (r.ok) {
        const d = r.data as { subscribed: boolean; alert?: { id: string; threshold_price: number | null } };
        setState({ subscribed: d.subscribed, alertId: d.alert?.id, threshold: d.alert?.threshold_price ?? null });
        setValue(d.alert?.threshold_price?.toString() ?? "");
      }
      setChecked(true);
    })();
  }, [user?.id, productId, variantId, checked]);

  if (!user) return null;

  const onSubscribe = async () => {
    setLoading(true);
    const r = await subscribePriceAlertBackend({
      product_id: productId,
      variant_id: variantId ?? null,
      threshold_price: value ? Number(value) : null,
    });
    setLoading(false);
    if (r.ok) {
      const d = r.data as { alert: { id: string; threshold_price: number | null } };
      setState({ subscribed: true, alertId: d.alert.id, threshold: d.alert.threshold_price ?? null });
      setEditing(false);
      toast("You'll be notified on price drop", "success");
    } else {
      toast(r.error, "error");
    }
  };

  const onSave = async () => {
    if (!state.alertId) return;
    setLoading(true);
    const num = value === "" ? null : Number(value);
    const r = await updatePriceAlertBackend(state.alertId, { threshold_price: num });
    setLoading(false);
    if (r.ok) {
      setState({ ...state, threshold: num });
      setEditing(false);
      toast("Updated", "success");
    } else {
      toast(r.error, "error");
    }
  };

  const onUnsubscribe = async () => {
    if (!state.alertId) return;
    setLoading(true);
    const r = await unsubscribePriceAlertBackend(state.alertId);
    setLoading(false);
    if (r.ok) {
      setState({ subscribed: false });
      toast("Alert removed", "success");
    } else {
      toast(r.error, "error");
    }
  };

  return (
    <View style={styles.wrap}>
      {!state.subscribed && !editing && (
        <Pressable style={styles.pill} onPress={() => setEditing(true)}>
          <Ionicons name="notifications-outline" size={14} color={colors.olive[700]} />
          <Label style={styles.pillText}>Notify me on price drop</Label>
        </Pressable>
      )}
      {editing && !state.subscribed && (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={`≤ ${formatPrice(currentPrice, currency)}`}
            keyboardType="numeric"
            placeholderTextColor={colors.light.mutedForeground}
          />
          <Pressable onPress={onSubscribe} style={styles.saveBtn} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Label style={{ color: "#fff" }}>Set</Label>}
          </Pressable>
          <Pressable onPress={() => { setEditing(false); setValue(""); }}>
            <Label style={{ color: colors.light.mutedForeground }}>×</Label>
          </Pressable>
        </View>
      )}
      {state.subscribed && !editing && (
        <View style={styles.subscribed}>
          <View style={styles.subscribedRow}>
            <Ionicons name="notifications" size={14} color={colors.olive[700]} />
            <Label style={{ color: colors.olive[700] }}>
              Alert on{state.threshold != null ? ` ≤ ${formatPrice(state.threshold, currency)}` : " price drop"}
            </Label>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => setEditing(true)}>
              <Body size="sm" style={{ color: colors.olive[700] }}>Edit</Body>
            </Pressable>
            <Pressable onPress={onUnsubscribe} disabled={loading}>
              <Body size="sm" style={{ color: "#b45309" }}>Cancel</Body>
            </Pressable>
          </View>
        </View>
      )}
      {state.subscribed && editing && (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            placeholderTextColor={colors.light.mutedForeground}
          />
          <Pressable onPress={onSave} style={styles.saveBtn}>
            <Label style={{ color: "#fff" }}>Save</Label>
          </Pressable>
          <Pressable onPress={() => { setEditing(false); setValue(state.threshold?.toString() ?? ""); }}>
            <Label style={{ color: colors.light.mutedForeground }}>×</Label>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  pill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.olive[200],
    backgroundColor: colors.olive[50],
  },
  pillText: { color: colors.olive[700], fontSize: 12 },
  editRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.light.card,
    borderWidth: 1, borderColor: colors.light.border,
    borderRadius: radii.full, paddingLeft: 12, paddingRight: 4,
  },
  input: {
    flex: 1, paddingVertical: 8, fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground, fontSize: 13,
  },
  saveBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
  },
  subscribed: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.olive[200],
  },
  subscribedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});