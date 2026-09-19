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
        <Ionicons name="location-outline" size={14} color={colors.olive[700]} />
        <Label style={styles.label}>DELIVERY TO YOU</Label>
      </View>
      <View style={styles.row}>
        <TextInput
          value={postal}
          onChangeText={setPostal}
          placeholder="Postal code"
          placeholderTextColor={colors.light.mutedForeground}
          keyboardType="number-pad"
          maxLength={5}
          style={styles.input}
        />
        <TouchableOpacity style={styles.btn} onPress={check} activeOpacity={0.8}>
          <Body size="sm" style={styles.btnText}>Check</Body>
        </TouchableOpacity>
      </View>
      {error ? <Body size="xs" style={styles.error}>{error}</Body> : null}
      {result ? (
        <View style={styles.chip}>
          <Ionicons name="bicycle-outline" size={14} color={colors.olive[700]} />
          <Body size="xs" style={styles.chipText}>{formatEta(result)}</Body>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 10, letterSpacing: 1, color: colors.light.foreground },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
    backgroundColor: colors.light.card,
  },
  btn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontFamily: fontFamilies.sans.semibold },
  error: { color: colors.light.destructive },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.olive[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  chipText: { color: colors.olive[800] },
});
