import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Body, Label } from "@/components/ui/Typography";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  checkServiceability,
  formatEta,
  getSavedPincode,
  savePincode,
  type ServiceabilityResult,
} from "@/lib/serviceability";

export function PincodeChecker() {
  const [postal, setPostal] = useState("");
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSavedPincode().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setPostal(saved);
        const r = checkServiceability(saved);
        if (!("error" in r)) setResult(r);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [focused, setFocused] = useState(false);

  const check = () => {
    const r = checkServiceability(postal);
    if ("error" in r) {
      setResult(null);
      setError("Enter a 5-digit Sri Lankan postal code");
      return;
    }
    setError(null);
    setResult(r);
    void savePincode(r.postal);
  };

  if (!hydrated) return <ActivityIndicator size="small" color={colors.olive[600]} />;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <View style={styles.iconBadge}>
          <Ionicons name="location-outline" size={14} color={colors.olive[700]} />
        </View>
        <View style={styles.labelCopy}>
          <Label style={styles.label}>DELIVERY TO YOU</Label>
          <Body size="xs" style={styles.sub}>Check delivery date for your area</Body>
        </View>
      </View>
      <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
        <TextInput
          value={postal}
          onChangeText={(t) => {
            setPostal(t.replace(/[^0-9]/g, ""));
            if (error) setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={check}
          returnKeyType="done"
          placeholder="Enter postal code"
          placeholderTextColor={colors.light.mutedForeground}
          keyboardType="number-pad"
          maxLength={5}
          style={styles.input}
        />
        <TouchableOpacity
          style={[styles.btn, postal.length < 5 && styles.btnIdle]}
          onPress={check}
          activeOpacity={0.85}
          accessibilityLabel="Check delivery"
        >
          <Body size="sm" style={[styles.btnText, postal.length < 5 && styles.btnTextIdle]}>Check</Body>
        </TouchableOpacity>
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.light.destructive} />
          <Body size="xs" style={styles.error}>{error}</Body>
        </View>
      ) : null}
      {result ? (
        <View style={styles.chip}>
          <View style={styles.chipIcon}>
            <Ionicons name="bicycle-outline" size={13} color={colors.paper.cream} />
          </View>
          <Body size="xs" style={styles.chipText}>{formatEta(result)}</Body>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}14`,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}24`,
  },
  labelCopy: { flex: 1, gap: 1 },
  label: { fontSize: 10, letterSpacing: 2, color: colors.olive[600] },
  sub: { color: colors.light.mutedForeground, fontFamily: fontFamilies.sans.regular, fontSize: 12 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderWidth: 1,
    borderColor: `${colors.olive[900]}22`,
    borderRadius: radii.full,
    paddingLeft: 18,
    paddingRight: 5,
    backgroundColor: colors.light.card,
  },
  fieldFocused: { borderColor: colors.olive[700], borderWidth: 1.5 },
  fieldError: { borderColor: colors.light.destructive },
  input: {
    flex: 1,
    height: "100%",
    fontFamily: fontFamilies.mono.medium,
    fontSize: 15,
    letterSpacing: 1.5,
    color: colors.light.foreground,
  },
  btn: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  btnIdle: { backgroundColor: `${colors.olive[900]}14` },
  btnText: { color: colors.paper.cream, fontFamily: fontFamilies.sans.semibold, letterSpacing: 0.3 },
  btnTextIdle: { color: colors.olive[800] },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 4 },
  error: { color: colors.light.destructive },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  chipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[700],
  },
  chipText: { color: colors.olive[800], fontFamily: fontFamilies.sans.semibold },
});
