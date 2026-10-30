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
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const GOLD = colors.accent2.ochre;

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

  // Reset the one-shot status check whenever the product/variant or user
  // changes so switching variants refetches instead of showing stale state.
  React.useEffect(() => {
    setChecked(false);
  }, [user?.id, productId, variantId]);

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
    const num = value === "" ? null : Number(value);
    if (num !== null && (!Number.isFinite(num) || num <= 0)) {
      toast("Enter a valid price greater than 0", "error");
      return;
    }
    setLoading(true);
    const r = await subscribePriceAlertBackend({
      product_id: productId,
      variant_id: variantId ?? null,
      threshold_price: num,
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
    const num = value === "" ? null : Number(value);
    if (num !== null && (!Number.isFinite(num) || num <= 0)) {
      toast("Enter a valid price greater than 0", "error");
      return;
    }
    setLoading(true);
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
        <Pressable
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel="Notify me if the price drops"
        >
          <View style={styles.pillIcon}>
            <Ionicons name="notifications-outline" size={17} color={GOLD} />
          </View>
          <View style={styles.pillCopy}>
            <Body size="sm" style={styles.pillText}>Price drop alert</Body>
            <Body size="xs" style={styles.pillSub} numberOfLines={1}>We'll tell you the moment it's cheaper</Body>
          </View>
          <View style={styles.pillCta}>
            <Body size="xs" style={styles.pillCtaText}>Notify me</Body>
          </View>
        </Pressable>
      )}
      {editing && (
        <View style={styles.editCard}>
          <View style={styles.editHeader}>
            <Ionicons name="notifications-outline" size={14} color={colors.olive[700]} />
            <Body size="xs" style={styles.editLabel}>
              {state.subscribed ? "Update your target price" : "Alert me when the price is at or below"}
            </Body>
          </View>
          <View style={styles.editRow}>
            <Body size="sm" style={styles.currency}>{currency}</Body>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={`Any drop below ${formatPrice(currentPrice, currency)}`}
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
              autoFocus
            />
            <Pressable
              onPress={state.subscribed ? onSave : onSubscribe}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.paper.cream} />
              ) : (
                <Label style={styles.saveText}>{state.subscribed ? "Save" : "Set alert"}</Label>
              )}
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityLabel="Cancel"
              onPress={() => {
                setEditing(false);
                setValue(state.subscribed ? state.threshold?.toString() ?? "" : "");
              }}
            >
              <Ionicons name="close" size={14} color={colors.light.mutedForeground} />
            </Pressable>
          </View>
        </View>
      )}
      {state.subscribed && !editing && (
        <View style={styles.subscribed}>
          <View style={styles.subscribedIcon}>
            <Ionicons name="notifications" size={15} color={colors.olive[950]} />
          </View>
          <View style={styles.pillCopy}>
            <Body size="sm" style={styles.pillText}>Alert is on</Body>
            <Body size="xs" style={styles.pillSub} numberOfLines={1}>
              {state.threshold != null ? `When it hits ${formatPrice(state.threshold, currency)}` : "On any price drop"}
            </Body>
          </View>
          <Pressable onPress={() => setEditing(true)} style={styles.ghostBtn} hitSlop={4}>
            <Body size="xs" style={styles.ghostText}>Edit</Body>
          </Pressable>
          <Pressable onPress={onUnsubscribe} disabled={loading} style={styles.ghostBtn} hitSlop={4}>
            <Body size="xs" style={[styles.ghostText, { color: colors.accent2.rust }]}>Remove</Body>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const INK = colors.ink.DEFAULT;

const cardBase = {
  borderRadius: radii["3xl"],
  backgroundColor: "#ffffff",
  borderWidth: 1,
  borderColor: `${INK}0D`,
  shadowColor: INK,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  pill: {
    ...cardBase,
    flexDirection: "row", alignItems: "center",
    gap: 12,
    paddingVertical: 12, paddingLeft: 12, paddingRight: 12,
  },
  pillPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  pillIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.olive[950],
  },
  pillCopy: { flex: 1, gap: 2 },
  pillText: {
    color: INK, fontSize: 14,
    fontFamily: fontFamilies.sans.bold,
  },
  pillSub: {
    color: colors.light.mutedForeground, fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
  },
  pillCta: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1, borderColor: `${colors.olive[600]}1F`,
  },
  pillCtaText: {
    color: colors.olive[800], fontSize: 11.5,
    fontFamily: fontFamilies.sans.semibold,
  },
  editCard: {
    ...cardBase,
    padding: 12,
    gap: 10,
  },
  editHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  editLabel: {
    color: colors.light.mutedForeground, fontSize: 12,
    fontFamily: fontFamilies.sans.medium,
  },
  editRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.paper.warm,
    borderWidth: 1, borderColor: `${INK}0F`,
    borderRadius: radii.full, paddingLeft: 16, paddingRight: 5, paddingVertical: 5,
  },
  currency: {
    color: colors.olive[700], fontSize: 12,
    fontFamily: fontFamilies.sans.bold, letterSpacing: 0.6,
  },
  input: {
    flex: 1, paddingVertical: 8, fontFamily: fontFamilies.sans.semibold,
    color: INK, fontSize: 15,
  },
  saveBtn: {
    minWidth: 82, alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  saveText: { color: colors.paper.cream, fontFamily: fontFamilies.sans.bold, fontSize: 12 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  subscribed: {
    ...cardBase,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingLeft: 12, paddingRight: 8,
    borderColor: `${GOLD}4D`,
  },
  subscribedIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    backgroundColor: GOLD,
  },
  ghostBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  ghostText: { color: colors.olive[700], fontFamily: fontFamilies.sans.semibold, fontSize: 12 },
});