import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { checkBrandSlug, submitBrandApplication } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Step = 0 | 1 | 2;

export default function BrandOnboarding() {
  const [step, setStep] = React.useState<Step>(0);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [yearFounded, setYearFounded] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [slugStatus, setSlugStatus] = React.useState<"idle" | "checking" | "ok" | "taken">("idle");

  React.useEffect(() => {
    const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (cleaned !== slug) {
      setSlug(cleaned);
      return;
    }
    if (cleaned.length < 3) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      const r: { ok: boolean; data?: { available: boolean }; error?: unknown } = await checkBrandSlug(cleaned);
      setSlugStatus(r.ok && r.data?.available ? "ok" : "taken");
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  const submitMut = useMutation({
    mutationFn: () => submitBrandApplication({
      name,
      slug,
      tagline: tagline || undefined,
      country: country || undefined,
      year_founded: yearFounded ? Number(yearFounded) : undefined,
      website: website || undefined,
      description: description || undefined,
    }),
    onSuccess: (r) => {
      if (r.ok) {
        Alert.alert("Application submitted", "We'll review and approve shortly.", [
          { text: "OK", onPress: () => router.replace("/(brand)") },
        ]);
      } else {
        Alert.alert("Submission failed", String(r.error ?? "Unknown error"));
      }
    },
  });

  const next = () => {
    if (step === 0) {
      if (!name || !slug || slugStatus !== "ok") {
        Alert.alert("Missing info", "Brand name and a unique slug are required.");
        return;
      }
    }
    setStep((s) => Math.min(2, s + 1) as Step);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>LUXE</Text>
        <Text style={styles.title}>Open your brand</Text>
        <Text style={styles.subtitle}>Step {step + 1} of 3</Text>

        <View style={styles.dots}>
          {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, step === i && styles.dotActive]} />)}
        </View>

        {step === 0 ? (
          <Card style={styles.formCard}>
            <FieldLabel>Brand name *</FieldLabel>
            <Input value={name} onChangeText={setName} placeholder="Acme Apparel" />
            <FieldLabel>Slug *</FieldLabel>
            <Input value={slug} onChangeText={setSlug} placeholder="acme-apparel" autoCapitalize="none" />
            <Text style={styles.help}>
              {slugStatus === "checking" ? "Checking..." : slugStatus === "ok" ? "✓ Available" : slugStatus === "taken" ? "✗ Already taken" : "Lowercase letters, numbers, dashes."}
            </Text>
            <FieldLabel>Tagline</FieldLabel>
            <Input value={tagline} onChangeText={setTagline} placeholder="Short tagline" />
            <FieldLabel>Country</FieldLabel>
            <Input value={country} onChangeText={setCountry} placeholder="Sri Lanka" />
            <FieldLabel>Year founded</FieldLabel>
            <Input value={yearFounded} onChangeText={setYearFounded} placeholder="2018" keyboardType="numeric" />
            <FieldLabel>Website</FieldLabel>
            <Input value={website} onChangeText={setWebsite} placeholder="https://example.com" autoCapitalize="none" />
            <FieldLabel>About</FieldLabel>
            <Input value={description} onChangeText={setDescription} placeholder="Brand story" multiline numberOfLines={4} style={styles.textArea} />
          </Card>
        ) : null}

        {step === 1 ? (
          <Card style={styles.formCard}>
            <Text style={styles.heading}>Visuals</Text>
            <Text style={styles.placeholder}>Logo and banner upload coming soon to mobile. Set them on web after approval.</Text>
            <View style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: "#0d0d0d" }]}><Text style={styles.swatchText}>Ink</Text></View>
              <View style={[styles.swatch, { backgroundColor: "#d6c9a3" }]}><Text style={styles.swatchText}>Cream</Text></View>
              <View style={[styles.swatch, { backgroundColor: "#5b6f4a" }]}><Text style={styles.swatchText}>Olive</Text></View>
            </View>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card style={styles.formCard}>
            <Text style={styles.heading}>Review</Text>
            <ReviewRow label="Name" value={name} />
            <ReviewRow label="Slug" value={`/brands/${slug}`} />
            {tagline ? <ReviewRow label="Tagline" value={tagline} /> : null}
            {country ? <ReviewRow label="Country" value={country} /> : null}
            {yearFounded ? <ReviewRow label="Founded" value={yearFounded} /> : null}
            {website ? <ReviewRow label="Website" value={website} /> : null}
            {description ? <ReviewRow label="About" value={description} /> : null}
          </Card>
        ) : null}

        <View style={styles.actions}>
          {step > 0 ? (
            <Button variant="outline" onPress={() => setStep((s) => Math.max(0, s - 1) as Step)} style={styles.actionBtn}>Back</Button>
          ) : (
            <Pressable onPress={() => router.replace("/")} style={styles.actionBtn}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          )}
          {step < 2 ? (
            <Button onPress={next} style={styles.actionBtn}>Continue</Button>
          ) : (
            <Button onPress={() => submitMut.mutate()} loading={submitMut.isPending} style={styles.actionBtn}>Submit application</Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes["3xl"], color: colors.light.foreground },
  subtitle: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  dots: { flexDirection: "row", gap: 6, marginVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.light.border },
  dotActive: { backgroundColor: colors.light.primary, width: 24 },
  formCard: { padding: 16, gap: 4 },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground, marginBottom: 4 },
  placeholder: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, lineHeight: 20 },
  swatchRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  swatch: { flex: 1, height: 64, borderRadius: radii.md, alignItems: "flex-end", justifyContent: "flex-end", padding: 8 },
  swatchText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: "#fff" },
  label: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial, marginTop: 8 },
  textArea: { minHeight: 100, textAlignVertical: "top" as const },
  help: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 4 },
  reviewRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.light.border, gap: 12 },
  reviewLabel: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial, width: 84 },
  reviewValue: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, flex: 1 },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionBtn: { flex: 1 },
  cancelText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center" as const, paddingVertical: 12 },
});