import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Button, Input, useToast } from "@/components/ui";
import { colors, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { createAdminBrand } from "@/lib/api";
import type { AdminBrandCreateInput } from "@/lib/api/backend";
import { INK, HAIRLINE, cardSurface as card } from "@/components/admin/catalog-kit";

// Brands are admin-created (brand portal is disabled). Mirrors the web
// BrandCreateDialog: POST /api/admin/brands, approved by default, so the
// brand shows up in the seller product-form picker immediately.

const EMPTY = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  logo_url: "",
  banner_url: "",
  website: "",
  country: "",
  year_founded: "",
};
type Form = typeof EMPTY;

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function AdminBrandNew() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<Form>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);

  const set = (k: keyof Form, v: string) =>
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "name" && !slugTouched) next.slug = slugify(v);
      return next;
    });

  const canSave = form.name.trim().length >= 2 && /^[a-z0-9-]{2,80}$/.test(form.slug);

  const createM = useMutation({
    mutationFn: async () => {
      const payload: AdminBrandCreateInput = { name: form.name.trim(), slug: form.slug, status: "approved" };
      for (const k of ["tagline", "description", "logo_url", "banner_url", "website", "country"] as const) {
        const v = form[k].trim();
        if (v) payload[k] = v;
      }
      const year = Number(form.year_founded);
      if (year) payload.year_founded = year;
      const r = await createAdminBrand(payload);
      if (!r.ok) throw new Error(r.error ?? "Failed to create brand");
      return r.data;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      qc.invalidateQueries({ queryKey: ["cat-brands"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(`${b.name} is now available to sellers`);
      router.replace({ pathname: "/(admin)/brands/[id]", params: { id: b.id } } as any);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create brand"),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={18} color={INK} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>BRAND DIRECTORY</Text>
            </View>
            <Text style={styles.title}>New brand</Text>
            <Text style={styles.subtitle}>
              Approved on create — sellers can pick it when adding products.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>IDENTITY</Text>
          <Input
            label="Name"
            value={form.name}
            onChangeText={(v) => set("name", v)}
            placeholder="Maison Example"
          />
          <Input
            label="Slug"
            value={form.slug}
            onChangeText={(v) => {
              setSlugTouched(true);
              set("slug", slugify(v));
            }}
            placeholder="maison-example"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input label="Tagline" value={form.tagline} onChangeText={(v) => set("tagline", v)} />
          <Input
            label="Description"
            value={form.description}
            onChangeText={(v) => set("description", v)}
            multiline
            numberOfLines={4}
            style={{ minHeight: 88, textAlignVertical: "top" }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MEDIA</Text>
          <Input
            label="Logo URL"
            value={form.logo_url}
            onChangeText={(v) => set("logo_url", v)}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
          />
          <Input
            label="Banner URL"
            value={form.banner_url}
            onChangeText={(v) => set("banner_url", v)}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <Input
            label="Website"
            value={form.website}
            onChangeText={(v) => set("website", v)}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Country" value={form.country} onChangeText={(v) => set("country", v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Year founded"
                value={form.year_founded}
                onChangeText={(v) => set("year_founded", v.replace(/[^0-9]/g, "").slice(0, 4))}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <Button
          variant="brand"
          loading={createM.isPending}
          disabled={!canSave || createM.isPending}
          onPress={() => createM.mutate()}
        >
          Create brand
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: 18 },
  pressed: { opacity: 0.7 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 18, marginBottom: 18 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 2.2, color: colors.olive[700] },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.4,
    color: INK,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink.mute,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: HAIRLINE,
    ...shadows.soft,
  },
  section: { ...card, borderRadius: 22, padding: 14, marginBottom: 14, gap: 2 },
  sectionLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: "rgba(22,23,15,0.5)",
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 10 },
});
