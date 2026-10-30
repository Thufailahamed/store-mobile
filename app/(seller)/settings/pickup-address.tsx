import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, updateSellerStore } from "@/lib/api";
import { getDevicePosition, LocationError } from "@/lib/location";
import { hasPickupAddress } from "@/lib/seller-pickup-address";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { SellerStateView, SellerGlow } from "@/components/seller/chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, spacing, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const INK = colors.olive[950];

type Draft = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  lat: number | null;
  lng: number | null;
};

function draftFrom(store: Store): Draft {
  return {
    line1: store.delivery_address_line1 ?? "",
    line2: store.delivery_address_line2 ?? "",
    city: store.delivery_city ?? "",
    state: store.delivery_state ?? "",
    postal: store.delivery_postal_code ?? "",
    lat: store.delivery_latitude != null ? Number(store.delivery_latitude) : null,
    lng: store.delivery_longitude != null ? Number(store.delivery_longitude) : null,
  };
}

/**
 * Courier pickup point — where drivers collect the seller's orders.
 * Stored on stores.delivery_*; the dashboard prompts until line 1 + city
 * are saved. Web equivalent: /seller/settings?tab=delivery.
 */
export default function PickupAddressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await getSellerStore(user.id);
    setLoading(false);
    if (!res.ok) {
      setLoadError(res.error);
      return;
    }
    setLoadError(null);
    setStore(res.data);
    if (res.data) setDraft(draftFrom(res.data));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const pinHere = async () => {
    setLocating(true);
    try {
      const pos = await getDevicePosition();
      setDraft((d) => (d ? { ...d, lat: pos.lat, lng: pos.lng } : d));
      toast("Pin set to your current location", "success");
    } catch (e) {
      toast(e instanceof LocationError ? e.message : "Couldn't get your location", "error");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!store || !draft) return;
    if (!draft.line1.trim() || !draft.city.trim()) {
      toast("Street address and city are required", "error");
      return;
    }
    setSaving(true);
    const res = await updateSellerStore(store.id, {
      delivery_address_line1: draft.line1.trim(),
      delivery_address_line2: draft.line2.trim() || null,
      delivery_city: draft.city.trim(),
      delivery_state: draft.state.trim() || null,
      delivery_postal_code: draft.postal.trim() || null,
      delivery_country: store.delivery_country || "Sri Lanka",
      delivery_latitude: draft.lat,
      delivery_longitude: draft.lng,
    });
    setSaving(false);
    if (!res.ok) {
      toast(res.error || "Couldn't save the pickup address", "error");
      return;
    }
    setStore(res.data);
    toast("Pickup address saved", "success");
    router.back();
  };

  const header = (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
      <SellerGlow />
      <View style={styles.headerRow}>
        <SellerBackButton label="Settings" fallbackHref="/(seller)/settings" />
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">Pickup address</Text>
      </View>
      <Text style={styles.subtitle}>
        Where couriers collect your orders. Never shown to shoppers.
      </Text>
    </View>
  );

  if (loading && !draft) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {header}
        <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
          <Skeleton width="100%" height={52} />
          <Skeleton width="100%" height={52} />
          <Skeleton width="60%" height={52} />
        </View>
      </View>
    );
  }

  if (loadError || !store || !draft) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {header}
        <SellerStateView
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn’t load your store"
          description={loadError ?? "Create your store first."}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      </View>
    );
  }

  const saved = hasPickupAddress(store);
  const pinned = draft.lat != null && draft.lng != null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {header}

        {!saved && (
          <View style={styles.notice}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.accent2.rust} />
            <Text style={styles.noticeText}>
              Add a pickup address so couriers can collect your orders.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Field
            label="Street address"
            value={draft.line1}
            onChangeText={(v) => set("line1", v)}
            placeholder="No. 12, Galle Road"
            autoComplete="street-address"
            textContentType="streetAddressLine1"
          />
          <Field
            label="Warehouse / dock / suite"
            optional
            value={draft.line2}
            onChangeText={(v) => set("line2", v)}
            placeholder="Loading bay B"
            textContentType="streetAddressLine2"
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label="City"
                value={draft.city}
                onChangeText={(v) => set("city", v)}
                placeholder="Colombo"
                textContentType="addressCity"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Postal code"
                optional
                value={draft.postal}
                onChangeText={(v) => set("postal", v)}
                placeholder="00300"
                keyboardType="number-pad"
                textContentType="postalCode"
              />
            </View>
          </View>
          <Field
            label="Province"
            optional
            value={draft.state}
            onChangeText={(v) => set("state", v)}
            placeholder="Western"
            textContentType="addressState"
          />
        </View>

        <TouchableOpacity
          style={styles.pinButton}
          onPress={pinHere}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Use my current location as the pickup pin"
        >
          {locating ? (
            <ActivityIndicator color={colors.olive[700]} />
          ) : (
            <Ionicons name={pinned ? "checkmark-circle" : "locate-outline"} size={18} color={colors.olive[700]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.pinTitle}>
              {pinned ? "Map pin set" : "Use my current location"}
            </Text>
            <Text style={styles.pinSub}>
              {pinned
                ? `${draft.lat!.toFixed(5)}, ${draft.lng!.toFixed(5)} · tap to update`
                : "Optional — helps drivers navigate straight to you"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.paper.cream} />
          ) : (
            <Text style={styles.saveText}>Save pickup address</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, optional, ...props }: TextInputProps & { label: string; optional?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label.toUpperCase()}
        {optional ? <Text style={styles.fieldOptional}>  OPTIONAL</Text> : null}
      </Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="rgba(101,104,77,0.55)"
        selectionColor={colors.olive[600]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  content: { paddingBottom: 40 },
  header: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    color: INK,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 8,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: "rgba(165,74,52,0.08)",
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.accent2.rust,
  },
  card: {
    marginHorizontal: spacing[5],
    padding: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.12)",
  },
  row: { flexDirection: "row", gap: 12 },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink.mute,
    marginBottom: 6,
  },
  fieldOptional: { color: "rgba(101,104,77,0.6)" },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: colors.paper.DEFAULT,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: INK,
  },
  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
  },
  pinTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  pinSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, marginTop: 2 },
  saveButton: {
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK,
  },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: colors.paper.cream },
});
