import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";
const MEASUREMENT_KEYS = [
  "height_cm",
  "weight_kg",
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "inseam_cm",
  "shoulder_cm",
];

type FitPreference = "slim" | "tailored" | "relaxed" | "oversized";
type UnitSystem = "metric" | "imperial";

const FIT_PREFERENCES: {
  id: FitPreference;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "slim",
    label: "Slim fit",
    desc: "Contoured cut close to the body",
    icon: "body-outline",
  },
  {
    id: "tailored",
    label: "Tailored",
    desc: "Classic atelier drape with clean structure",
    icon: "cut-outline",
  },
  {
    id: "relaxed",
    label: "Relaxed",
    desc: "Effortless casual ease and room",
    icon: "shirt-outline",
  },
  {
    id: "oversized",
    label: "Oversized",
    desc: "Modern runway volume and drop-shoulder",
    icon: "layers-outline",
  },
];

function Field({
  label,
  unit,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <View style={styles.fieldCol}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={styles.fieldInput}
          keyboardType="numeric"
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.light.mutedForeground}
        />
        <Text style={styles.unitSuffix}>{unit}</Text>
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export default function FitProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const [vals, setVals] = useState<Record<string, string>>({});
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [fitPref, setFitPref] = useState<FitPreference>("tailored");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchJson<{ data?: Record<string, number> }>("/api/size-fit/profile")
      .then((res) => {
        const data = res.ok ? res.data.data ?? res.data : null;
        if (!data || typeof data !== "object") return;
        const next: Record<string, string> = {};
        for (const k of MEASUREMENT_KEYS) {
          const n = (data as Record<string, unknown>)[k];
          if (typeof n === "number") next[k] = String(n);
        }
        setVals(next);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string) => (v: string) => setVals((s) => ({ ...s, [key]: v }));
  const unit = unitSystem === "metric" ? "cm" : "in";

  const save = async () => {
    const body: Record<string, number> = {};
    for (const k of MEASUREMENT_KEYS) {
      const n = Number(vals[k]);
      if (Number.isFinite(n) && n > 0) body[k] = n;
    }

    setSaving(true);
    const res = await fetchJson("/api/size-fit/profile", {
      method: "PUT",
      body: { ...body, units: "metric", fit_preference: fitPref },
    });
    setSaving(false);

    if (!res.ok) {
      toast(res.error ?? "Could not save measurements", "error");
      return;
    }
    toast("Tailoring profile saved successfully", "success");
  };

  // Predicted sizing based on chest & waist
  const predictedSize = useMemo(() => {
    const chest = Number(vals.chest_cm) || 0;
    const waist = Number(vals.waist_cm) || 0;

    if (!chest && !waist) return null;

    let top = "Medium (EU 48)";
    if (chest < 92) top = "Small (EU 46)";
    else if (chest > 104) top = "Large (EU 50–52)";
    else if (chest > 112) top = "XL (EU 54)";

    let bottom = "32 Regular";
    if (waist < 76) bottom = "30 Slim";
    else if (waist > 86) bottom = "34 Classic";
    else if (waist > 94) bottom = "36 Relaxed";

    return { top, bottom };
  }, [vals.chest_cm, vals.waist_cm]);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Fit & tailoring</Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={save}
            disabled={saving || loading}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Save measurements"
          >
            {saving ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="checkmark" size={19} color={colors.light.foreground} />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={GOLD} size="small" />
            <Text style={styles.loadingText}>Loading your fit profile…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Heading */}
            <View style={styles.pageHead}>
              <Text style={styles.eyebrow}>Bespoke measurements</Text>
              <Text style={styles.pageTitle}>
                Your <Text style={styles.pageTitleAccent}>fit profile</Text>
              </Text>
              <Text style={styles.pageSub}>
                Save your measurements once — we suggest your size on every collection.
              </Text>
            </View>

            {/* Suggested size */}
            <LinearGradient
              colors={["#1f2418", "#14170e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <Text style={styles.heroEyebrow}>Suggested size</Text>
              {predictedSize ? (
                <View style={styles.heroStats}>
                  <View style={styles.heroStatCell}>
                    <Text style={styles.heroStatValue}>{predictedSize.top}</Text>
                    <Text style={styles.heroStatLabel}>Tops & jackets</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStatCell}>
                    <Text style={styles.heroStatValue}>{predictedSize.bottom}</Text>
                    <Text style={styles.heroStatLabel}>Trousers & pants</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.heroEmpty}>
                  Enter your chest and waist below to see your suggested size.
                </Text>
              )}

              {/* Unit switcher */}
              <View style={styles.unitSwitch}>
                {(["metric", "imperial"] as UnitSystem[]).map((u) => {
                  const active = unitSystem === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitPill, active && styles.unitPillActive]}
                      onPress={() => setUnitSystem(u)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.unitPillText, active && styles.unitPillTextActive]}>
                        {u === "metric" ? "cm · kg" : "in · lbs"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LinearGradient>

            {/* Silhouette */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardEyebrow}>Drape preference</Text>
                  <Text style={styles.cardTitle}>Preferred silhouette</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="shirt-outline" size={16} color={GOLD_DEEP} />
                </View>
              </View>

              <View style={styles.fitGrid}>
                {FIT_PREFERENCES.map((p) => {
                  const isSelected = fitPref === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.fitTile, isSelected && styles.fitTileActive]}
                      onPress={() => setFitPref(p.id)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={styles.fitTileTop}>
                        <View
                          style={[styles.fitIcon, isSelected && styles.fitIconActive]}
                        >
                          <Ionicons
                            name={p.icon}
                            size={15}
                            color={isSelected ? "#E8CF8F" : colors.light.foreground}
                          />
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color={GOLD} />
                        )}
                      </View>
                      <Text
                        style={[styles.fitLabel, isSelected && styles.fitLabelActive]}
                      >
                        {p.label}
                      </Text>
                      <Text
                        style={[styles.fitDesc, isSelected && styles.fitDescActive]}
                      >
                        {p.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Proportions */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardEyebrow}>Stature</Text>
                  <Text style={styles.cardTitle}>General proportions</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="body-outline" size={16} color={GOLD_DEEP} />
                </View>
              </View>

              <View style={styles.fieldsRow}>
                <Field
                  label={`Height (${unit})`}
                  unit={unit}
                  value={vals.height_cm ?? ""}
                  onChange={set("height_cm")}
                  placeholder={unitSystem === "metric" ? "e.g. 178" : "e.g. 70"}
                />
                <Field
                  label={`Weight (${unitSystem === "metric" ? "kg" : "lbs"})`}
                  unit={unitSystem === "metric" ? "kg" : "lbs"}
                  value={vals.weight_kg ?? ""}
                  onChange={set("weight_kg")}
                  placeholder={unitSystem === "metric" ? "e.g. 72" : "e.g. 158"}
                />
              </View>
            </View>

            {/* Upper body */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardEyebrow}>Upper body</Text>
                  <Text style={styles.cardTitle}>Tops, shirts & jackets</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="cut-outline" size={16} color={GOLD_DEEP} />
                </View>
              </View>

              <View style={styles.fieldsRow}>
                <Field
                  label={`Chest / bust (${unit})`}
                  unit={unit}
                  value={vals.chest_cm ?? ""}
                  onChange={set("chest_cm")}
                  placeholder={unitSystem === "metric" ? "e.g. 98" : "e.g. 39"}
                  hint="Fullest point of chest"
                />
                <Field
                  label={`Shoulder (${unit})`}
                  unit={unit}
                  value={vals.shoulder_cm ?? ""}
                  onChange={set("shoulder_cm")}
                  placeholder={unitSystem === "metric" ? "e.g. 45" : "e.g. 18"}
                  hint="Shoulder bone to bone"
                />
              </View>
            </View>

            {/* Lower body */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardEyebrow}>Lower body</Text>
                  <Text style={styles.cardTitle}>Trousers & skirts</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="layers-outline" size={16} color={GOLD_DEEP} />
                </View>
              </View>

              <View style={styles.fieldsRow}>
                <Field
                  label={`Waist (${unit})`}
                  unit={unit}
                  value={vals.waist_cm ?? ""}
                  onChange={set("waist_cm")}
                  placeholder={unitSystem === "metric" ? "e.g. 82" : "e.g. 32"}
                  hint="At natural waistline"
                />
                <Field
                  label={`Hips (${unit})`}
                  unit={unit}
                  value={vals.hips_cm ?? ""}
                  onChange={set("hips_cm")}
                  placeholder={unitSystem === "metric" ? "e.g. 96" : "e.g. 38"}
                  hint="Fullest point of hips"
                />
              </View>

              <View style={styles.fieldsRow}>
                <Field
                  label={`Inseam / leg length (${unit})`}
                  unit={unit}
                  value={vals.inseam_cm ?? ""}
                  onChange={set("inseam_cm")}
                  placeholder={unitSystem === "metric" ? "e.g. 79" : "e.g. 31"}
                  hint="Inner crotch seam to ankle bone"
                />
                <View style={styles.fieldCol} />
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.85 }]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Save fit profile"
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Saving…" : "Save fit profile"}
              </Text>
              <View style={styles.saveBtnArrow}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.olive[900]} />
                ) : (
                  <Ionicons name="checkmark" size={15} color={colors.olive[900]} />
                )}
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: colors.light.mutedForeground,
  },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: 14,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 300,
  },

  /* Suggested size hero */
  hero: {
    borderRadius: 24,
    padding: spacing[5],
    gap: spacing[4],
    ...shadows.editorial,
  },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(232, 207, 143, 0.85)",
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroStatCell: {
    flex: 1,
    gap: 3,
  },
  heroStatValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    letterSpacing: -0.3,
    color: colors.paper.cream,
  },
  heroStatLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(250, 248, 241, 0.55)",
  },
  heroDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(250, 248, 241, 0.12)",
    marginHorizontal: spacing[4],
  },
  heroEmpty: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(250, 248, 241, 0.7)",
  },
  unitSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(250, 248, 241, 0.08)",
    borderRadius: radii.full,
    padding: 4,
  },
  unitPill: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
  },
  unitPillActive: {
    backgroundColor: "#E8CF8F",
  },
  unitPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11.5,
    letterSpacing: 0.8,
    color: "rgba(250, 248, 241, 0.65)",
  },
  unitPillTextActive: {
    color: colors.olive[900],
    fontFamily: fontFamilies.mono.semibold,
  },

  /* Cards */
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: HAIRLINE,
    gap: spacing[4],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardHeaderText: {
    gap: 3,
  },
  cardEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: GOLD_DEEP,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Silhouette grid */
  fitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  fitTile: {
    width: "47.8%",
    backgroundColor: colors.paper.warm,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: 5,
  },
  fitTileActive: {
    backgroundColor: colors.olive[900],
  },
  fitTileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  fitIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  fitIconActive: {
    backgroundColor: "rgba(200, 164, 74, 0.18)",
  },
  fitLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  fitLabelActive: {
    color: colors.paper.cream,
  },
  fitDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.light.mutedForeground,
  },
  fitDescActive: {
    color: "rgba(250, 248, 241, 0.65)",
  },

  /* Inputs */
  fieldsRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldCol: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  fieldInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper.warm,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    borderWidth: 1,
    borderColor: HAIRLINE,
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 15,
    color: colors.light.foreground,
    padding: 0,
  },
  unitSuffix: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.olive[600],
  },
  fieldHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },

  /* Save */
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingLeft: 22,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginTop: 4,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  saveBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.paper.cream,
    letterSpacing: 0.2,
  },
  saveBtnArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.cream,
  },
});
