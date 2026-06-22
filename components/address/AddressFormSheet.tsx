import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import * as Location from "expo-location";
import { useToast } from "@/components/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Body, Display, Label } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { AddressMapPicker } from "./AddressMapPicker";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { reverseGeocode } from "@/lib/maps";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Address } from "@/lib/types";
import {
  validateCheckoutAddress,
  checkoutAddressFieldLabel,
  checkoutAddressInvalidLabel,
} from "@/lib/checkout-validation";

export type AddressType = "home" | "work" | "other";

export interface AddressFormPayload {
  type: AddressType;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface AddressFormSheetProps {
  visible: boolean;
  initial?: Partial<Address> | null;
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  onClose: () => void;
  onSubmit: (payload: AddressFormPayload) => Promise<void> | void;
  defaultName?: string;
  defaultPhone?: string;
  /** Hide the "set as default" switch (e.g. checkout flow). */
  hideDefault?: boolean;
}

const TYPE_META: Record<AddressType, { label: string; icon: keyof typeof Ionicons.glyphMap; copy: string }> = {
  home: { label: "Home", icon: "home-outline", copy: "Where you live, where things get tried on." },
  work: { label: "Work", icon: "briefcase-outline", copy: "Office or studio — for daytime deliveries." },
  other: { label: "Other", icon: "location-outline", copy: "A second home, a friend's, a hotel…" },
};

function payloadFromAddress(a: Partial<Address> | null | undefined, fallback: Partial<AddressFormPayload> = {}): AddressFormPayload {
  return {
    type: (a?.type as AddressType) ?? fallback.type ?? "home",
    full_name: a?.full_name ?? fallback.full_name ?? "",
    phone: a?.phone ?? fallback.phone ?? "",
    line1: a?.line1 ?? fallback.line1 ?? "",
    line2: a?.line2 ?? fallback.line2 ?? "",
    city: a?.city ?? fallback.city ?? "",
    state: a?.state ?? fallback.state ?? "",
    postal_code: a?.postal_code ?? fallback.postal_code ?? "",
    country: a?.country ?? fallback.country ?? "Sri Lanka",
    is_default: a?.is_default ?? fallback.is_default ?? false,
    latitude: a?.latitude ?? null,
    longitude: a?.longitude ?? null,
  };
}

/**
 * Bottom-sheet style Modal for adding or editing an address.
 * Combines Google Places Autocomplete, current-location detection,
 * a draggable map pin, and the standard address fields.
 */
export function AddressFormSheet({
  visible,
  initial,
  title,
  subtitle,
  primaryLabel,
  onClose,
  onSubmit,
  defaultName,
  defaultPhone,
  hideDefault = false,
}: AddressFormSheetProps) {
  const [form, setForm] = useState<AddressFormPayload>(
    payloadFromAddress(initial, { full_name: defaultName, phone: defaultPhone })
  );
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debouncedLatLng = useDebounce(
    { lat: form.latitude, lng: form.longitude },
    500
  );
  const lastReverseKey = useRef<string | null>(null);
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const { toast } = useToast();

  const handleAutoFetch = async () => {
    if (fetchingLoc) return;
    setFetchingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast("Permission to access location was denied", "error");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      
      setGeoBusy(true);
      const res = await reverseGeocode(lat, lng);
      setGeoBusy(false);
      
      if (res) {
        setForm((prev) => ({
          ...prev,
          line1: res.components.line1 || prev.line1,
          city: res.components.city || prev.city,
          state: res.components.state || prev.state,
          postal_code: res.components.postal_code || prev.postal_code,
          country: res.components.country || prev.country,
        }));
        toast("Address auto-filled successfully!", "success");
      } else {
        toast("Could not resolve address details. Please fill manually.", "error");
      }
    } catch (err: any) {
      toast(err?.message || "Failed to get current location", "error");
    } finally {
      setFetchingLoc(false);
    }
  };

  // Reset form when sheet opens with a new initial value.
  useEffect(() => {
    if (visible) {
      setForm(payloadFromAddress(initial, { full_name: defaultName, phone: defaultPhone }));
      setErrors({});
      lastReverseKey.current = null;
    }
  }, [visible, initial, defaultName, defaultPhone]);

  // Reverse-geocode whenever the pin lands somewhere we haven't looked up.
  useEffect(() => {
    if (debouncedLatLng.lat == null || debouncedLatLng.lng == null) return;
    const key = `${debouncedLatLng.lat.toFixed(5)}|${debouncedLatLng.lng.toFixed(5)}`;
    if (key === lastReverseKey.current) return;
    lastReverseKey.current = key;
    let cancelled = false;
    setGeoBusy(true);
    reverseGeocode(debouncedLatLng.lat, debouncedLatLng.lng).then((res) => {
      if (cancelled) return;
      setGeoBusy(false);
      if (!res) return;
      setForm((prev) => ({
        ...prev,
        line1: res.components.line1 || prev.line1,
        city: res.components.city || prev.city,
        state: res.components.state || prev.state,
        postal_code: res.components.postal_code || prev.postal_code,
        country: res.components.country || prev.country,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedLatLng.lat, debouncedLatLng.lng]);

  const handlePlaceSelect = useCallback((res: { lat: number; lng: number; components: { line1: string; city: string; state: string; postal_code: string; country: string } }) => {
    setForm((prev) => ({
      ...prev,
      line1: res.components.line1 || prev.line1,
      city: res.components.city || prev.city,
      state: res.components.state || prev.state,
      postal_code: res.components.postal_code || prev.postal_code,
      country: res.components.country || prev.country,
      latitude: res.lat,
      longitude: res.lng,
    }));
    lastReverseKey.current = `${res.lat.toFixed(5)}|${res.lng.toFixed(5)}`;
  }, []);

  const handleMapChange = useCallback((lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  }, []);

  const set = <K extends keyof AddressFormPayload>(key: K, value: AddressFormPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    // Delegate to the shared checkout validator so the form, the checkout
    // step-1 transition, and the place-order guard all reject the same
    // inputs. Per-field "Required" vs "looks invalid" messages map via
    // the existing label helpers.
    const result = validateCheckoutAddress({
      full_name: form.full_name,
      phone: form.phone,
      line1: form.line1,
      city: form.city,
      state: form.state,
      postal_code: form.postal_code,
    });
    if (result.ok) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const key of result.missing) {
      next[key] = "Required";
    }
    for (const key of result.invalid) {
      next[key] = checkoutAddressInvalidLabel(key);
    }
    setErrors(next);
    return false;
  };

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(initial?.id);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Label style={styles.kicker}>{isEdit ? "Edit" : "New"}</Label>
              <Display size="xl">{title ?? (isEdit ? "Edit address" : "Add address")}</Display>
              {subtitle ? <Body muted size="xs" style={{ marginTop: 2 }}>{subtitle}</Body> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.light.foreground} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Type chips */}
            <View>
              <Label style={styles.sectionLabel}>Type</Label>
              <View style={styles.typeRow}>
                {(["home", "work", "other"] as AddressType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const active = form.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => set("type", t)}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={14}
                        color={active ? colors.light.primaryForeground : colors.light.foreground}
                      />
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Body muted size="xs" style={styles.typeCopy}>{TYPE_META[form.type].copy}</Body>
            </View>

            {/* Auto-detect location button */}
            <TouchableOpacity
              onPress={handleAutoFetch}
              disabled={fetchingLoc}
              style={[styles.autoDetectBtn, { borderColor: colors.light.primary }]}
              activeOpacity={0.75}
            >
              {fetchingLoc ? (
                <ActivityIndicator size="small" color={colors.light.primary} />
              ) : (
                <Ionicons name="location-outline" size={16} color={colors.light.primary} />
              )}
              <Label style={[styles.autoDetectBtnText, { color: colors.light.primary }]}>
                {fetchingLoc ? "Detecting location…" : "Auto-detect current address"}
              </Label>
            </TouchableOpacity>

            {/* Map */}
            <View style={styles.field}>
              <Label style={styles.sectionLabel}>Pin location</Label>
              <AddressMapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onLocationChange={handleMapChange}
              />
              {geoBusy ? (
                <View style={styles.geoStatus}>
                  <ActivityIndicator size="small" color={colors.light.primary} />
                  <Text style={styles.geoStatusText}>Resolving address…</Text>
                </View>
              ) : (
                <Body muted size="xs" style={styles.helper}>
                  Drag the pin, tap the map, or hit the locate button to refine.
                </Body>
              )}
            </View>

            {/* Manual fields */}
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Full name"
                  required
                  value={form.full_name}
                  onChangeText={(v) => set("full_name", v)}
                  error={errors.full_name}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Phone"
                  required
                  value={form.phone}
                  onChangeText={(v) => set("phone", v)}
                  keyboardType="phone-pad"
                  error={errors.phone}
                  placeholder="+94 77 …"
                />
              </View>
            </View>

            <Field
              label="Address line 1"
              required
              value={form.line1}
              onChangeText={(v) => set("line1", v)}
              error={errors.line1}
              placeholder="Street address, P.O. box, company name"
            />

            <Field
              label="Address line 2"
              value={form.line2}
              onChangeText={(v) => set("line2", v)}
              placeholder="Apt, suite, floor (optional)"
            />

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="City"
                  required
                  value={form.city}
                  onChangeText={(v) => set("city", v)}
                  error={errors.city}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="State / province"
                  required
                  value={form.state}
                  onChangeText={(v) => set("state", v)}
                  error={errors.state}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Postal code"
                  required
                  value={form.postal_code}
                  onChangeText={(v) => set("postal_code", v)}
                  keyboardType="number-pad"
                  error={errors.postal_code}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Country"
                  value={form.country}
                  onChangeText={(v) => set("country", v)}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {!hideDefault && (
              <View style={styles.defaultRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.defaultTitle}>Set as default</Text>
                  <Text style={styles.defaultSubtitle}>Use this for quick checkout</Text>
                </View>
                <Switch
                  value={form.is_default}
                  onValueChange={(v) => set("is_default", v)}
                  trackColor={{ false: colors.light.border, true: colors.light.primary }}
                  thumbColor={colors.paper.cream}
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button variant="outline" onPress={onClose} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button loading={saving} onPress={handleSave} style={{ flex: 2 }}>
              {primaryLabel ?? (isEdit ? "Save changes" : "Add address")}
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  required,
  keyboardType,
  error,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  required?: boolean;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  error?: string;
  placeholder?: string;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required ? " *" : ""}</Text>
      <View
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        <TextInput
          style={styles.inputText}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.light.mutedForeground}
          autoCapitalize={autoCapitalize ?? (keyboardType === "default" ? "words" : "none")}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    height: "92%",
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginTop: spacing[3],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  kicker: { color: colors.light.primary, marginBottom: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  body: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  sectionLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    marginBottom: spacing[2],
  },
  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  typeChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  typeChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  typeChipTextActive: { color: colors.light.primaryForeground },
  typeCopy: { marginTop: 6 },
  field: { gap: 6 },
  fieldRow: { flexDirection: "row", gap: spacing[3] },
  helper: { color: colors.light.mutedForeground, marginTop: 4 },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    height: 46,
  },
  inputFocused: {
    borderColor: colors.light.ring,
    borderWidth: 1.5,
  },
  inputError: { borderColor: colors.light.destructive },
  inputText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    height: "100%",
  },
  errorText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.destructive,
  },
  geoStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: 6,
  },
  geoStatusText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.olive[50],
    borderRadius: radii.lg,
    gap: spacing[3],
    marginTop: spacing[2],
  },
  defaultTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  defaultSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.background,
    ...shadows.soft,
  },
  autoDetectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.lg,
    height: 44,
    backgroundColor: colors.olive[50],
    marginBottom: spacing[2],
  },
  autoDetectBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 13,
  },
});
