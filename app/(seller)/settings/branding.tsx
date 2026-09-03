import React from "react";
import { View, Text, TextInput, Pressable, ScrollView, Switch, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSellerBrandingBackend, updateSellerBrandingBackend, type SellerBranding } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const PRESETS = ["editorial", "modern", "classic", "noir", "rose"];
const FONTS = ["editorial", "modern", "classic"] as const;
const DENSITIES = ["compact", "comfortable", "spacious"] as const;
const BUTTONS = ["rounded", "pill", "square"] as const;

export default function SellerBrandingScreen() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["sellerBranding"],
    queryFn: async () => {
      const res = await getSellerBrandingBackend();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const mut = useMutation({
    mutationFn: (input: Partial<SellerBranding>) => updateSellerBrandingBackend(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sellerBranding"] }),
    onError: (e) => Alert.alert("Save failed", String((e as Error).message ?? e)),
  });

  if (q.isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Branding" }} />
        <ActivityIndicator />
      </View>
    );
  }
  if (q.isError || !q.data) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Branding" }} />
        <Text style={styles.body}>Could not load branding.</Text>
      </View>
    );
  }

  const b = q.data;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Branding" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Theme preset">
          {PRESETS.map((p) => (
            <Chip key={p} label={p} active={b.theme_preset === p} onPress={() => mut.mutate({ theme_preset: p })} />
          ))}
        </Section>

        <Section title="Font mood">
          {FONTS.map((f) => (
            <Chip key={f} label={f} active={b.font_mood === f} onPress={() => mut.mutate({ font_mood: f })} />
          ))}
        </Section>

        <Section title="Button style">
          {BUTTONS.map((s) => (
            <Chip key={s} label={s} active={b.button_style === s} onPress={() => mut.mutate({ button_style: s })} />
          ))}
        </Section>

        <Section title="Layout density">
          {DENSITIES.map((d) => (
            <Chip key={d} label={d} active={b.layout_density === d} onPress={() => mut.mutate({ layout_density: d })} />
          ))}
        </Section>

        <Section title="Colors">
          <ColorRow label="Primary" value={b.primary_color ?? ""} onChange={(v) => mut.mutate({ primary_color: v })} />
          <ColorRow label="Accent" value={b.accent_color ?? ""} onChange={(v) => mut.mutate({ accent_color: v })} />
        </Section>

        <Section title="White-label">
          <View style={styles.toggleRow}>
            <Text style={styles.body}>Show "Powered by LUXE"</Text>
            <Switch
              value={b.show_powered_by ?? true}
              onValueChange={(v) => mut.mutate({ show_powered_by: v })}
            />
          </View>
        </Section>

        {mut.isPending ? <Text style={styles.saving}>Saving…</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing[5] }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.colorRow}>
      <Text style={[styles.body, { width: 80 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="#000000"
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, color: colors.light.foreground, marginBottom: spacing[2] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radii.full, backgroundColor: colors.light.muted },
  chipActive: { backgroundColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, textTransform: "capitalize" },
  chipTextActive: { color: colors.light.primaryForeground },
  colorRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: spacing[2] },
  input: { flex: 1, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, padding: spacing[2], fontFamily: fontFamilies.mono.regular, color: colors.light.foreground },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  body: { fontFamily: fontFamilies.sans.regular, color: colors.light.foreground },
  saving: { fontFamily: fontFamilies.sans.medium, color: colors.light.mutedForeground, textAlign: "center", marginTop: spacing[3] },
});
