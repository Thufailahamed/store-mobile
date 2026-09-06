import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { Body, Label } from "@/components/ui/Typography";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const FIELDS = [
  { key: "height_cm", label: "Height (cm)" },
  { key: "weight_kg", label: "Weight (kg)" },
  { key: "chest_cm", label: "Chest (cm)" },
  { key: "waist_cm", label: "Waist (cm)" },
  { key: "hips_cm", label: "Hips (cm)" },
  { key: "inseam_cm", label: "Inseam (cm)" },
  { key: "shoulder_cm", label: "Shoulder (cm)" },
] as const;

export default function FitProfileScreen() {
  const { toast } = useToast();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchJson<{ data?: Record<string, number> }>("/api/size-fit/profile").then((res) => {
      const data = res.ok ? (res.data.data ?? res.data) : null;
      if (!data || typeof data !== "object") return;
      const next: Record<string, string> = {};
      for (const f of FIELDS) {
        const n = (data as Record<string, unknown>)[f.key];
        if (typeof n === "number") next[f.key] = String(n);
      }
      setVals(next);
    });
  }, []);

  const save = async () => {
    const body: Record<string, number> = {};
    for (const f of FIELDS) {
      const n = Number(vals[f.key]);
      if (Number.isFinite(n) && n > 0) body[f.key] = n;
    }
    setSaving(true);
    const res = await fetchJson("/api/size-fit/profile", { method: "PUT", body: { ...body, units: "metric" } });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save", "error");
      return;
    }
    toast("Fit profile saved", "success");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Fit profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <Body muted>
          Save your measurements once. We use them to suggest sizes on product pages.
        </Body>
        {FIELDS.map((f) => (
          <View key={f.key} style={styles.field}>
            <Label>{f.label}</Label>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={vals[f.key] ?? ""}
              onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))}
              placeholder="—"
            />
          </View>
        ))}
        <Button onPress={save} loading={saving}>Save</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[3] },
  field: { gap: 6 },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[3],
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
  },
});
