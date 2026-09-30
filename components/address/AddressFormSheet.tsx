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
import { Display } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { AddressMapPicker } from "./AddressMapPicker";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { reverseGeocode, type GeocodeResult } from "@/lib/maps";
import { colors, radii, spacing } from "@/lib/theme/tokens";
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

const TYPE_META: Record<AddressType, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  home: { label: "Home", icon: "home-outline" },
  work: { label: "Work", icon: "briefcase-outline" },
  other: { label: "Other", icon: "location-outline" },
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

  const applyGeocodeResult = useCallback((res: GeocodeResult) => {
    setForm((prev) => ({
      ...prev,
      line1: res.components.line1 || res.formatted.split(",")[0]?.trim() || prev.line1,
      city: res.components.city || prev.city,
      state: res.components.state || prev.state,
      postal_code: res.components.postal_code || prev.postal_code,
      country: res.components.country || prev.country,
      latitude: res.lat,
      longitude: res.lng,
    }));
    lastReverseKey.current = `${res.lat.toFixed(5)}|${res.lng.toFixed(5)}`;
  }, []);

  const handleAutoFetch = async () => {
    if (fetchingLoc) return;
    setFetchingLoc(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        toast("Turn on location services in your phone settings", "error");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast("Permission to access location was denied", "error");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      lastReverseKey.current = `${lat.toFixed(5)}|${lng.toFixed(5)}`;
      setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));

      setGeoBusy(true);
      const res = await reverseGeocode(lat, lng);
      setGeoBusy(false);

      if (res) {
        applyGeocodeResult(res);
        toast("Address auto-filled successfully!", "success");
      } else {
        toast("Got your location but could not resolve the address. Drag the pin or fill manually.", "error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get current location";
      toast(message, "error");
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
      applyGeocodeResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedLatLng.lat, debouncedLatLng.lng, applyGeocodeResult]);

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
              <Display size="xl">{title ?? (isEdit ? "Edit address" : "Add address")}</Display>
              <Text style={styles.headerSub}>{subtitle ?? "Where should we deliver?"}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={colors.light.foreground} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* ── Location: fills the address fields below ───────────── */}
            <Section title="Location">
              <TouchableOpacity
                onPress={handleAutoFetch}
                disabled={fetchingLoc}
                style={styles.locateBtn}
                activeOpacity={0.75}
              >
                <View style={styles.locateIcon}>
                  {fetchingLoc ? (
                    <ActivityIndicator size="small" color={colors.light.primary} />
                  ) : (
                    <Ionicons name="navigate" size={16} color={colors.light.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locateTitle}>
                    {fetchingLoc ? "Finding you…" : "Use my current location"}
                  </Text>
                  <Text style={styles.locateSub}>We'll fill in the address for you</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
              </TouchableOpacity>

              <AddressMapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onLocationChange={handleMapChange}
                showCoords={false}
                height={200}
              />
              {geoBusy ? (
                <View style={styles.geoStatus}>
                  <ActivityIndicator size="small" color={colors.light.primary} />
                  <Text style={styles.geoStatusText}>Looking up this spot…</Text>
                </View>
              ) : form.latitude != null && (form.line1 || form.city) ? (
                <View style={styles.geoStatus}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.light.primary} />
                  <Text style={styles.geoResolvedText} numberOfLines={1}>
                    Pinned near {[form.line1, form.city].filter(Boolean).join(", ")}
                  </Text>
                </View>
              ) : (
                <Text style={styles.helper}>Tap the map or drag the pin to mark the exact spot.</Text>
              )}
            </Section>

            {/* ── Contact ────────────────────────────────────────────── */}
            <Section title="Contact">
              <Field
                label="Full name"
                value={form.full_name}
                onChangeText={(v) => set("full_name", v)}
                error={errors.full_name}
                autoCapitalize="words"
                textContentType="name"
              />
              <Field
                label="Phone"
                value={form.phone}
                onChangeText={(v) => set("phone", v)}
                keyboardType="phone-pad"
                error={errors.phone}
                placeholder="07X XXX XXXX"
                textContentType="telephoneNumber"
                hint="The courier calls this number on delivery day"
              />
            </Section>

            {/* ── Address ────────────────────────────────────────────── */}
            <Section title="Address">
              <Field
                label="Street address"
                value={form.line1}
                onChangeText={(v) => set("line1", v)}
                error={errors.line1}
                placeholder="House no., street"
                textContentType="streetAddressLine1"
              />
              <Field
                label="Apartment, floor, landmark"
                optional
                value={form.line2}
                onChangeText={(v) => set("line2", v)}
                placeholder="e.g. Flat 3B, near the temple"
                textContentType="streetAddressLine2"
              />
              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="City"
                    value={form.city}
                    onChangeText={(v) => set("city", v)}
                    error={errors.city}
                    autoCapitalize="words"
                    textContentType="addressCity"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Postal code"
                    value={form.postal_code}
                    onChangeText={(v) => set("postal_code", v)}
                    keyboardType="number-pad"
                    error={errors.postal_code}
                    textContentType="postalCode"
                  />
                </View>
              </View>
              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Province"
                    value={form.state}
                    onChangeText={(v) => set("state", v)}
                    error={errors.state}
                    autoCapitalize="words"
                    textContentType="addressState"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Country"
                    value={form.country}
                    onChangeText={(v) => set("country", v)}
                    autoCapitalize="words"
                    textContentType="countryName"
                  />
                </View>
              </View>
            </Section>

            {/* ── Label + default ────────────────────────────────────── */}
            <Section title="Save as">
              <View style={styles.typeRow}>
                {(["home", "work", "other"] as AddressType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const active = form.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => set("type", t)}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={15}
                        color={active ? colors.light.primary : colors.light.mutedForeground}
                      />
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {!hideDefault && (
                <Pressable style={styles.defaultRow} onPress={() => set("is_default", !form.is_default)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.defaultTitle}>Make this my default address</Text>
                    <Text style={styles.defaultSubtitle}>Pre-selected at checkout</Text>
                  </View>
                  <Switch
                    value={form.is_default}
                    onValueChange={(v) => set("is_default", v)}
                    trackColor={{ false: colors.light.border, true: colors.light.primary }}
                    thumbColor={colors.paper.cream}
                  />
                </Pressable>
              )}
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Button variant="outline" onPress={onClose} style={{ flex: 1 }} textStyle={styles.footerBtnText}>
              Cancel
            </Button>
            <Button loading={saving} onPress={handleSave} style={{ flex: 2 }} textStyle={styles.footerBtnText}>
              {primaryLabel ?? (isEdit ? "Save changes" : "Save address")}
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  optional,
  keyboardType,
  error,
  placeholder,
  autoCapitalize,
  textContentType,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Everything is required unless marked optional — shown as a quiet "(optional)" tag. */
  optional?: boolean;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  error?: string;
  placeholder?: string;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  textContentType?: React.ComponentProps<typeof TextInput>["textContentType"];
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional ? <Text style={styles.fieldOptional}> (optional)</Text> : null}
      </Text>
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
          placeholderTextColor={colors.light.mutedForeground + "99"}
          autoCapitalize={autoCapitalize ?? (keyboardType === "default" ? "words" : "none")}
          textContentType={textContentType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
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
    paddingBottom: spacing[3],
    gap: spacing[3],
  },
  headerSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
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
    paddingTop: spacing[1],
    paddingBottom: spacing[8],
    gap: spacing[6],
  },
  section: {
    gap: spacing[3],
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  locateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  locateIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  locateTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.primary,
  },
  locateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  typeChipActive: {
    backgroundColor: colors.olive[50],
    borderColor: colors.light.primary,
    borderWidth: 1.5,
  },
  typeChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.foreground,
  },
  typeChipTextActive: { color: colors.light.primary, fontFamily: fontFamilies.sans.semibold },
  field: { gap: 6 },
  fieldRow: { flexDirection: "row", gap: spacing[3] },
  helper: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: -4,
  },
  fieldLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.foreground,
  },
  fieldOptional: {
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    height: 48,
  },
  inputFocused: {
    borderColor: colors.light.ring,
    borderWidth: 1.5,
  },
  inputError: { borderColor: colors.light.destructive },
  inputText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: colors.light.foreground,
    height: "100%",
  },
  errorText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.destructive,
  },
  hintText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  geoStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: -4,
  },
  geoStatusText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  geoResolvedText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    gap: spacing[3],
  },
  defaultTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  defaultSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  footerBtnText: {
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 15,
  },
});
