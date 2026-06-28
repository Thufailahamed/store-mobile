import React from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { getBrandBranding, updateBrandBranding } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandBranding() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["brand-branding"],
    queryFn: async () => {
      const r = await getBrandBranding();
      return r.ok ? r.data : null;
    },
  });

  const [tagline, setTagline] = React.useState("");
  const [story, setStory] = React.useState("");
  const [primary, setPrimary] = React.useState("#000000");
  const [accent, setAccent] = React.useState("#0d9488");
  const [ink, setInk] = React.useState("#111111");

  React.useEffect(() => {
    if (!q.data) return;
    const b = q.data;
    setTagline((b as { about?: string }).about ?? "");
    setStory((b as { story?: string }).story ?? "");
    setPrimary((b as { primary_color?: string }).primary_color ?? "#000000");
    setAccent((b as { accent_color?: string }).accent_color ?? "#0d9488");
    setInk((b as { font?: string }).font ?? "#111111");
  }, [JSON.stringify(q.data)]);

  const mut = useMutation({
    mutationFn: () => updateBrandBranding({
      about: tagline, story, primary_color: primary, accent_color: accent, font: ink,
    } as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-branding"] });
      Alert.alert("Saved", "Branding updated.");
    },
    onError: (e) => Alert.alert("Error", String(e)),
  });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandScreenHeader
          eyebrow="Brand HQ"
          title="Branding"
          subtitle="Tagline, story, palette"
          back={{ onPress: () => router.back() }}
        />

        <Card style={styles.uploadCard}>
          <Text style={styles.sectionLabel}>Logo & banner</Text>
          <Text style={styles.uploadNote}>Image upload is coming soon to mobile. Set logo and banner on web for now.</Text>
        </Card>

        {q.isLoading ? (
          <Skeleton style={styles.skel} />
        ) : (
          <Card style={styles.formCard}>
            <FieldLabel>Tagline</FieldLabel>
            <Input value={tagline} onChangeText={setTagline} placeholder="Bold, contemporary, made in Colombo" />
            <FieldLabel>Story</FieldLabel>
            <TextInput value={story} onChangeText={setStory} placeholder="Brand story" multiline numberOfLines={6} style={styles.textArea} />
            <FieldLabel>Palette</FieldLabel>
            <View style={styles.paletteRow}>
              <ColorInput label="Primary" value={primary} onChangeText={setPrimary} />
              <ColorInput label="Accent" value={accent} onChangeText={setAccent} />
              <ColorInput label="Ink" value={ink} onChangeText={setInk} />
            </View>
            <Button onPress={() => mut.mutate()} loading={mut.isPending} style={styles.saveBtn}>Save branding</Button>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ColorInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={styles.colorInput}>
      <Text style={styles.colorLabel}>{label}</Text>
      <Input value={value} onChangeText={onChangeText} placeholder="#000000" autoCapitalize="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 40 },
  skel: { height: 200, margin: 20, borderRadius: radii.xl },
  uploadCard: { marginHorizontal: 20, marginTop: 8, padding: 16, gap: 6 },
  sectionLabel: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial },
  uploadNote: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, lineHeight: 18 },
  formCard: { marginHorizontal: 20, marginTop: 12, padding: 16, gap: 8 },
  label: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial, marginTop: 8 },
  textArea: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg, padding: 12, minHeight: 120, textAlignVertical: "top" },
  paletteRow: { flexDirection: "row", gap: 8 },
  colorInput: { flex: 1, gap: 4 },
  colorLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.wide },
  saveBtn: { marginTop: 16 },
});
