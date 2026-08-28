import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { createAiJobBackend } from "@/lib/api/backend";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const STYLES = ["photorealistic", "editorial", "studio", "lifestyle", "flat-lay"];
const SIZES = ["1024x1024", "1024x1536", "1536x1024"];

export default function GenerateScreen() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLES[0]);
  const [size, setSize] = useState(SIZES[0]);
  const [count, setCount] = useState(1);

  const mutation = useMutation({
    mutationFn: () => createAiJobBackend({ prompt, style, size, count }),
    onSuccess: (res) => {
      if (res.ok) router.push(`/(seller)/ai-studio/${res.data.job.id}` as any);
      else Alert.alert("Generation failed", res.error ?? "Try again.");
    },
    onError: (e: any) => Alert.alert("Generation failed", e?.message ?? "Try again."),
  });

  const valid = prompt.trim().length >= 3 && prompt.length <= 1000 && count >= 1 && count <= 4;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Generate images</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe the image…"
          placeholderTextColor={colors.light.mutedForeground}
          multiline
          maxLength={1000}
          accessibilityLabel="Image prompt"
          style={styles.prompt}
        />
        <Picker label="Style" options={STYLES} value={style} onChange={setStyle} />
        <Picker label="Size" options={SIZES} value={size} onChange={setSize} />
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Count</Text>
          <Pressable accessibilityLabel="Decrease count" onPress={() => setCount((c) => Math.max(1, c - 1))} style={styles.countBtn}><Text style={styles.countBtnText}>−</Text></Pressable>
          <Text style={styles.countValue}>{count}</Text>
          <Pressable accessibilityLabel="Increase count" onPress={() => setCount((c) => Math.min(4, c + 1))} style={styles.countBtn}><Text style={styles.countBtnText}>+</Text></Pressable>
        </View>
        <Button disabled={!valid || mutation.isPending} onPress={() => mutation.mutate()} accessibilityLabel="Generate">
          {mutation.isPending ? "Submitting…" : `Generate (${count})`}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function Picker({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === o }}
            accessibilityLabel={o}
            style={[styles.chip, value === o && styles.chipActive]}
          >
            <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[4] },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  prompt: {
    minHeight: 96,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    backgroundColor: colors.light.card,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    textAlignVertical: "top",
  },
  sectionLabel: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.full, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { borderColor: colors.light.primary, backgroundColor: colors.light.primary + "15" },
  chipText: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  chipTextActive: { fontFamily: fontFamilies.sans.semibold, color: colors.light.primary },
  countRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  countLabel: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  countBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radii.full, backgroundColor: colors.light.muted },
  countBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  countValue: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground, minWidth: 24, textAlign: "center" },
});
