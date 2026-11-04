import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { getDevicePosition, LocationError } from "@/lib/location";
import { useToast } from "@/components/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { AddressMapPicker } from "./AddressMapPicker";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { reverseGeocode, type GeocodeResult } from "@/lib/maps";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";
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

const INK = C.ink;

const TYPE_META: Record<
  AddressType,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  home: { label: "Home", icon: "home-outline" },
  work: { label: "Work", icon: "briefcase-outline" },
  other: { label: "Other", icon: "location-outline" },
};

function payloadFromAddress(
  a: Partial<Address> | null | undefined,
  fallback: Partial<AddressFormPayload> = {},
): AddressFormPayload {
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
    payloadFromAddress(initial, {
      full_name: defaultName,
      phone: defaultPhone,
    }),
  );
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debouncedLatLng = useDebounce(
    { lat: form.latitude, lng: form.longitude },
    500,
  );
  const lastReverseKey = useRef<string | null>(null);
  const hasAutoFetchedRef = useRef(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const { toast } = useToast();

  const applyGeocodeResult = useCallback((res: GeocodeResult) => {
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

  const handleAutoFetch = async () => {
    if (fetchingLoc) return;
    setFetchingLoc(true);
    try {
      const { lat, lng } = await getDevicePosition();

      lastReverseKey.current = `${lat.toFixed(5)}|${lng.toFixed(5)}`;
      setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));

      setGeoBusy(true);
      const res = await reverseGeocode(lat, lng).finally(() =>
        setGeoBusy(false),
      );

      if (!res) {
        toast(
          "Pinned your location — please type the street address below.",
          "info",
        );
      } else {
        applyGeocodeResult(res);
        toast(
          res.components.line1
            ? "Address filled in — check the house number."
            : "Pinned your location — add your house number and street.",
          "success",
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof LocationError || err instanceof Error
          ? err.message
          : "Couldn't get your location";
      toast(message, "error");
    } finally {
      setFetchingLoc(false);
    }
  };

  // Reset form when sheet opens with a new initial value.
  useEffect(() => {
    if (visible) {
      setForm(
        payloadFromAddress(initial, {
          full_name: defaultName,
          phone: defaultPhone,
        }),
      );
      setErrors({});
      lastReverseKey.current = null;
    }
  }, [visible, initial, defaultName, defaultPhone]);

  // Automatically autofetch device location when opening for a new address without coordinates
  useEffect(() => {
    if (visible) {
      if (
        !initial?.id &&
        initial?.latitude == null &&
        !hasAutoFetchedRef.current
      ) {
        hasAutoFetchedRef.current = true;
        handleAutoFetch();
      }
    } else {
      hasAutoFetchedRef.current = false;
    }
  }, [visible, initial?.id, initial?.latitude]);

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
      setGeoBusy(false);
    };
  }, [debouncedLatLng.lat, debouncedLatLng.lng, applyGeocodeResult]);

  const handlePlaceSelect = useCallback(
    (res: {
      lat: number;
      lng: number;
      components: {
        line1: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
      };
    }) => {
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
    },
    [],
  );

  const handleMapChange = useCallback((lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  }, []);

  const set = <K extends keyof AddressFormPayload>(
    key: K,
    value: AddressFormPayload[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

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
  const resolvedLine =
    form.latitude != null
      ? [form.line1, form.city, form.state].filter(Boolean).join(", ")
      : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <LinearGradient
            pointerEvents="none"
            colors={[C.glow, C.glowSoft, C.paper]}
            locations={[0, 0.55, 1]}
            style={styles.sheetGlow}
          />
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} accessibilityRole="header">
                {title ?? (isEdit ? "Edit address" : "Add address")}
              </Text>
              <View style={styles.headerSubRow}>
                <Ionicons name="cube-outline" size={13} color={C.muted} />
                <Text style={styles.headerSub}>
                  {subtitle ?? "Where should we deliver?"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={19} color={C.text} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            scrollEnabled={!mapInteracting}
          >
            {/* ── Location: map + one-tap auto-fill ─────────────────── */}
            <View style={styles.locationCard}>
              <AddressMapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onLocationChange={handleMapChange}
                onInteractionChange={setMapInteracting}
                showCoords={false}
                showLocateButton={false}
                height={210}
                overlay={
                  <Pressable
                    onPress={handleAutoFetch}
                    disabled={fetchingLoc}
                    accessibilityRole="button"
                    accessibilityLabel="Use my current location"
                    style={({ pressed }) => [
                      styles.locatePill,
                      form.latitude != null && styles.locatePillCompact,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={styles.locateIcon}>
                      {fetchingLoc ? (
                        <ActivityIndicator size="small" color={INK} />
                      ) : (
                        <Ionicons name="navigate" size={14} color={INK} />
                      )}
                    </View>
                    <Text style={styles.locatePillText}>
                      {fetchingLoc
                        ? "Finding you…"
                        : form.latitude != null
                          ? "My location"
                          : "Use my current location"}
                    </Text>
                  </Pressable>
                }
              />
              <View style={styles.deliverRow}>
                <View style={styles.deliverIcon}>
                  {geoBusy ? (
                    <ActivityIndicator size="small" color={C.accent} />
                  ) : (
                    <Ionicons
                      name={resolvedLine ? "location" : "location-outline"}
                      size={20}
                      color={C.accent}
                    />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.deliverEyebrow}>Deliver to</Text>
                  <Text style={styles.deliverText} numberOfLines={2}>
                    {geoBusy
                      ? "Looking up this spot…"
                      : resolvedLine ||
                        "Tap the map or use your location to drop a pin"}
                  </Text>
                </View>
                {form.latitude != null && !geoBusy ? (
                  <View style={styles.pinnedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={C.accent} />
                    <Text style={styles.pinnedBadgeText}>Pinned</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── Contact ────────────────────────────────────────────── */}
            <Section
              index="01"
              title="Recipient"
              caption="Who receives the parcel"
            >
              <Field
                label="Full name"
                icon="person-outline"
                value={form.full_name}
                onChangeText={(v) => set("full_name", v)}
                error={errors.full_name}
                autoCapitalize="words"
                textContentType="name"
              />
              <Field
                label="Phone"
                icon="call-outline"
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
            <Section
              index="02"
              title="Address"
              caption="Auto-filled from your pin — edit anything"
            >
              <Field
                label="Street address"
                icon="navigate-circle-outline"
                value={form.line1}
                onChangeText={(v) => set("line1", v)}
                error={errors.line1}
                placeholder="House no., street"
                textContentType="streetAddressLine1"
              />
              <Field
                label="Apartment, floor, landmark"
                icon="business-outline"
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
            <Section
              index="03"
              title="Save as"
              caption="A label to find it quickly at checkout"
            >
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
                        size={16}
                        color={active ? C.lime : C.text}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          active && styles.typeChipTextActive,
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {!hideDefault && (
                <Pressable
                  style={styles.defaultRow}
                  onPress={() => set("is_default", !form.is_default)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.defaultTitle}>
                      Make this my default address
                    </Text>
                    <Text style={styles.defaultSubtitle}>
                      Pre-selected at checkout
                    </Text>
                  </View>
                  <Switch
                    value={form.is_default}
                    onValueChange={(v) => set("is_default", v)}
                    trackColor={{ false: "#e2dfd3", true: C.accent }}
                    thumbColor="#ffffff"
                  />
                </Pressable>
              )}
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.saveGradient}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.paper.cream} />
                ) : (
                  <>
                    <Text style={styles.saveText}>
                      {primaryLabel ??
                        (isEdit ? "Save changes" : "Save address")}
                    </Text>
                    <View style={styles.saveArrow}>
                      <Ionicons name="checkmark" size={18} color={INK} />
                    </View>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({
  index,
  title,
  caption,
  children,
}: {
  index: string;
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionIndex}>{Number(index)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {caption ? (
            <Text style={styles.sectionCaption}>{caption}</Text>
          ) : null}
        </View>
      </View>
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
  icon,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
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
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, focused && { color: C.accent }]}>
          {label}
        </Text>
        {optional ? <Text style={styles.fieldOptional}>Optional</Text> : null}
      </View>
      <View
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={17}
            color={
              error
                ? C.rust
                : focused
                  ? C.accent
                  : C.muted
            }
            style={{ marginRight: 10 }}
          />
        ) : null}
        <TextInput
          style={styles.inputText}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          autoCapitalize={
            autoCapitalize ??
            (keyboardType == null || keyboardType === "default"
              ? "words"
              : "none")
          }
          textContentType={textContentType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={C.accent}
        />
        {!error && value.trim().length > 0 && !focused ? (
          <View style={styles.validDot}>
            <Ionicons name="checkmark" size={11} color={C.lime} />
          </View>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const SHADOW = {
  shadowColor: "#16170f",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(22, 23, 15, 0.55)",
    justifyContent: "flex-end",
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: "continuous",
    height: "93%",
    overflow: "hidden",
  },
  sheetGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(22,23,15,0.14)",
    alignSelf: "center",
    marginTop: 10,
  },

  // Header — same language as My Orders
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    letterSpacing: -0.8,
    color: C.text,
  },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  headerSub: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: C.muted },
  closeBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 32,
    gap: 16,
  },

  // Location — white card holding the map + resolved address
  locationCard: {
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 6,
    ...SHADOW,
  },
  locatePill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 5,
    paddingRight: 18,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.ink,
    ...shadows.editorial,
  },
  locatePillCompact: {
    alignSelf: "flex-end",
    paddingRight: 14,
    height: 40,
    borderRadius: 20,
  },
  locateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  locatePillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.cream },
  deliverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
  },
  deliverIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  deliverEyebrow: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.muted },
  deliverText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: C.text,
    marginTop: 1,
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
  },
  pinnedBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.accent },

  // Sections
  section: {
    gap: 14,
    padding: 18,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    ...SHADOW,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 },
  sectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.ink,
  },
  sectionIndex: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.lime },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
  sectionCaption: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },

  // Type chips — Orders filter chips
  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
  },
  typeChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  typeChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  typeChipTextActive: { color: C.cream },

  // Fields
  field: { gap: 7 },
  fieldRow: { flexDirection: "row", gap: 10 },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  fieldLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.text },
  fieldOptional: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ec",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 52,
  },
  inputFocused: { backgroundColor: C.card, borderColor: C.accent },
  inputError: { borderColor: C.rust, backgroundColor: "rgba(184,92,58,0.05)" },
  inputText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: C.text,
    height: "100%",
  },
  validDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  errorText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.rust, paddingHorizontal: 2 },
  hintText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted, paddingHorizontal: 2 },

  // Default toggle
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: C.accentSoft,
    borderRadius: 18,
    gap: 12,
  },
  defaultTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  defaultSubtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted, marginTop: 2 },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.paper,
  },
  cancelBtn: {
    height: 56,
    paddingHorizontal: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: C.text },
  saveBtn: { flex: 1, borderRadius: 28, overflow: "hidden" },
  saveGradient: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 22,
    paddingRight: 6,
    backgroundColor: C.ink,
  },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: C.cream },
  saveArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
});
