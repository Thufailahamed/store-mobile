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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { fetchJson } from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type FitPreference = "slim" | "tailored" | "relaxed" | "oversized";

const FIT_PREFERENCES: {
  id: FitPreference;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "slim",
    label: "Slim Fit",
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

export default function FitProfileScreen() {
  const router = useRouter();
  const { toast } = useToast();

  const [vals, setVals] = useState<Record<string, string>>({});
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [fitPref, setFitPref] = useState<FitPreference>("tailored");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchJson<{ data?: Record<string, number> }>("/api/size-fit/profile")
      .then((res) => {
        const data = res.ok ? res.data.data ?? res.data : null;
        if (!data || typeof data !== "object") return;
        const next: Record<string, string> = {};
        const keys = [
          "height_cm",
          "weight_kg",
          "chest_cm",
          "waist_cm",
          "hips_cm",
          "inseam_cm",
          "shoulder_cm",
        ];
        for (const k of keys) {
          const n = (data as Record<string, unknown>)[k];
          if (typeof n === "number") next[k] = String(n);
        }
        setVals(next);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const body: Record<string, number> = {};
    const keys = [
      "height_cm",
      "weight_kg",
      "chest_cm",
      "waist_cm",
      "hips_cm",
      "inseam_cm",
      "shoulder_cm",
    ];

    for (const k of keys) {
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
        {/* Atelier Screen Header */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>FIT & TAILORING</Text>
            <Text style={styles.navSubtitle}>BESPOKE MEASUREMENTS</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={save}
            disabled={saving}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#C8A44A" />
            ) : (
              <Ionicons name="checkmark" size={19} color="#85651b" />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#C8A44A" size="small" />
            <Text style={styles.loadingText}>Loading bespoke fit dossier…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Haute Couture Tailoring Hero Card */}
            <LinearGradient
              colors={["#1c2016", "#14170e", "#0e110a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroEyebrowRow}>
                <View style={styles.heroTagBadge}>
                  <Ionicons name="sparkles" size={11} color="#C8A44A" />
                  <Text style={styles.heroTagText}>BESPOKE TAILORING</Text>
                </View>

                <View style={styles.heroStatusBadge}>
                  <View style={styles.heroStatusDot} />
                  <Text style={styles.heroStatusText}>AI FIT ACTIVE</Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>Your Fit Profile</Text>
              <Text style={styles.heroSubtitle}>
                Save your bodily measurements once. Our sizing intelligence matches your silhouette against designer specifications to suggest your flawless size on every collection.
              </Text>

              {/* Unit System Switcher */}
              <View style={styles.unitSwitcherRow}>
                <TouchableOpacity
                  style={[
                    styles.unitPill,
                    unitSystem === "metric" && styles.unitPillActive,
                  ]}
                  onPress={() => setUnitSystem("metric")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.unitPillText,
                      unitSystem === "metric" && styles.unitPillTextActive,
                    ]}
                  >
                    METRIC (CM / KG)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.unitPill,
                    unitSystem === "imperial" && styles.unitPillActive,
                  ]}
                  onPress={() => setUnitSystem("imperial")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.unitPillText,
                      unitSystem === "imperial" && styles.unitPillTextActive,
                    ]}
                  >
                    IMPERIAL (IN / LBS)
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* 2. Predicted Sizing Card (when values entered) */}
            {predictedSize && (
              <View style={styles.predictionCard}>
                <View style={styles.predictionHeader}>
                  <Ionicons name="sparkles" size={13} color="#85651b" />
                  <Text style={styles.predictionEyebrow}>
                    PREDICTED ATELIER SIZING
                  </Text>
                </View>

                <View style={styles.predictionValuesRow}>
                  <View style={styles.predictionCell}>
                    <Text style={styles.predictionLabel}>TOPS & JACKETS</Text>
                    <Text style={styles.predictionValue}>{predictedSize.top}</Text>
                  </View>
                  <View style={styles.predictionDivider} />
                  <View style={styles.predictionCell}>
                    <Text style={styles.predictionLabel}>TROUSERS & PANTS</Text>
                    <Text style={styles.predictionValue}>
                      {predictedSize.bottom}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* 3. Fit Silhouette Preference */}
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardEyebrow}>DRAPE PREFERENCE</Text>
                  <Text style={styles.cardTitle}>Preferred Silhouette</Text>
                </View>
                <Ionicons name="shirt-outline" size={18} color="#85651b" />
              </View>

              <View style={styles.fitPrefGrid}>
                {FIT_PREFERENCES.map((p) => {
                  const isSelected = fitPref === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.fitPrefTile,
                        isSelected && styles.fitPrefTileActive,
                      ]}
                      onPress={() => setFitPref(p.id)}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.fitPrefIconBox,
                          isSelected && styles.fitPrefIconBoxActive,
                        ]}
                      >
                        <Ionicons
                          name={p.icon}
                          size={16}
                          color={isSelected ? "#E8CF8F" : "#181b12"}
                        />
                      </View>
                      <Text
                        style={[
                          styles.fitPrefLabel,
                          isSelected && styles.fitPrefLabelActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                      <Text
                        style={[
                          styles.fitPrefDesc,
                          isSelected && styles.fitPrefDescActive,
                        ]}
                      >
                        {p.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Body Dimensions (Height & Weight) */}
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardEyebrow}>STATURE & STATS</Text>
                  <Text style={styles.cardTitle}>General Proportions</Text>
                </View>
                <Ionicons name="body-outline" size={18} color="#85651b" />
              </View>

              <View style={styles.fieldsRow}>
                {/* Height */}
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>
                    HEIGHT ({unitSystem === "metric" ? "CM" : "IN"})
                  </Text>
                  <View style={styles.fieldInputWrap}>
                    <Ionicons
                      name="resize-outline"
                      size={15}
                      color={colors.light.mutedForeground}
                    />
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={vals.height_cm ?? ""}
                      onChangeText={(v) =>
                        setVals((s) => ({ ...s, height_cm: v }))
                      }
                      placeholder="e.g. 178"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                    <Text style={styles.unitSuffix}>
                      {unitSystem === "metric" ? "cm" : "in"}
                    </Text>
                  </View>
                </View>

                {/* Weight */}
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>
                    WEIGHT ({unitSystem === "metric" ? "KG" : "LBS"})
                  </Text>
                  <View style={styles.fieldInputWrap}>
                    <Ionicons
                      name="speedometer-outline"
                      size={15}
                      color={colors.light.mutedForeground}
                    />
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={vals.weight_kg ?? ""}
                      onChangeText={(v) =>
                        setVals((s) => ({ ...s, weight_kg: v }))
                      }
                      placeholder="e.g. 72"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                    <Text style={styles.unitSuffix}>
                      {unitSystem === "metric" ? "kg" : "lbs"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 5. Upper Garment Measurements (Chest & Shoulder) */}
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardEyebrow}>UPPER BODY</Text>
                  <Text style={styles.cardTitle}>Tops, Shirts & Jackets</Text>
                </View>
                <Ionicons name="cut-outline" size={18} color="#85651b" />
              </View>

              <View style={styles.fieldsRow}>
                {/* Chest */}
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>
                    CHEST / BUST ({unitSystem === "metric" ? "CM" : "IN"})
                  </Text>
                  <View style={styles.fieldInputWrap}>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={vals.chest_cm ?? ""}
                      onChangeText={(v) =>
                        setVals((s) => ({ ...s, chest_cm: v }))
                      }
                      placeholder="e.g. 98"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                    <Text style={styles.unitSuffix}>
                      {unitSystem === "metric" ? "cm" : "in"}
                    </Text>
                  </View>
                  <Text style={styles.fieldHint}>Fullest point of chest</Text>
                </View>

                {/* Shoulder */}
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>
                    SHOULDER ({unitSystem === "metric" ? "CM" : "IN"})
                  </Text>
                  <View style={styles.fieldInputWrap}>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={vals.shoulder_cm ?? ""}
                      onChangeText={(v) =>
                        setVals((s) => ({ ...s, shoulder_cm: v }))
                      }
                      placeholder="e.g. 45"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                    <Text style={styles.unitSuffix}>
                      {unitSystem === "metric" ? "cm" : "in"}
                    </Text>
                  </View>
                  <Text style={styles.fieldHint}>Shoulder bone to bone</Text>
                </View>
              </View>
            </View>

            {/* 6. Lower Garment Measurements (Waist, Hips & Inseam) */}
            <View style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardEyebrow}>LOWER BODY</Text>
                  <Text style={styles.cardTitle}>Trousers & Skirts</Text>
                </View>
                <Ionicons name="layers-outline" size={18} color="#85651b" />
              </View>

              {/* Waist & Hips Row */}
              <View style={styles.fieldsRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>
                    WAIST ({unitSystem === "metric" ? "CM" : "IN"})
                  </Text>
                  <View style={styles.fieldInputWrap}>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={vals.waist_cm ?? ""}
                      onChangeText={(v) =>
                        setVals((s) => ({ ...s, waist_cm: v }))
                      }
                      placeholder="e.g. 82"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                    <Text style={styles.unitSuffix}>
                      {unitSystem === "metric" ? "cm" : "in"}
                    </Text>
                  </View>
                  <Text style={styles.fieldHint}>At natural waistline</Text>
                </View>

                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>
                    HIPS ({unitSystem === "metric" ? "CM" : "IN"})
                  </Text>
                  <View style={styles.fieldInputWrap}>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={vals.hips_cm ?? ""}
                      onChangeText={(v) =>
                        setVals((s) => ({ ...s, hips_cm: v }))
                      }
                      placeholder="e.g. 96"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                    <Text style={styles.unitSuffix}>
                      {unitSystem === "metric" ? "cm" : "in"}
                    </Text>
                  </View>
                  <Text style={styles.fieldHint}>Fullest point of hips</Text>
                </View>
              </View>

              {/* Inseam Row */}
              <View style={[styles.fieldCol, { marginTop: 4 }]}>
                <Text style={styles.fieldLabel}>
                  INSEAM / LEG LENGTH ({unitSystem === "metric" ? "CM" : "IN"})
                </Text>
                <View style={styles.fieldInputWrap}>
                  <TextInput
                    style={styles.fieldInput}
                    keyboardType="numeric"
                    value={vals.inseam_cm ?? ""}
                    onChangeText={(v) =>
                      setVals((s) => ({ ...s, inseam_cm: v }))
                    }
                    placeholder="e.g. 79"
                    placeholderTextColor={colors.light.mutedForeground}
                  />
                  <Text style={styles.unitSuffix}>
                    {unitSystem === "metric" ? "cm" : "in"}
                  </Text>
                </View>
                <Text style={styles.fieldHint}>Inner crotch seam down to ankle bone</Text>
              </View>
            </View>

            {/* 7. Save Action Button */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={save}
              disabled={saving}
              activeOpacity={0.88}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={15} color="#ffffff" />
                  <Text style={styles.saveBtnText}>SAVE BESPOKE FIT PROFILE</Text>
                  <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

/* =========================================================================
   Styles
   ========================================================================= */
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
    fontFamily: fontFamilies.display.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },

  /* Navigation Bar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navTitleWrap: {
    alignItems: "center",
  },
  navTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.light.foreground,
    textTransform: "uppercase",
  },
  navSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#85651b",
    marginTop: 1,
    letterSpacing: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: 40,
    gap: 14,
  },

  /* 1. Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.editorial,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  heroStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#4ade80",
  },
  heroStatusText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.72)",
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  unitSwitcherRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: radii.full,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  unitPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: radii.full,
  },
  unitPillActive: {
    backgroundColor: "#E8CF8F",
  },
  unitPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.8,
  },
  unitPillTextActive: {
    color: "#181b12",
  },

  /* 2. Predicted Sizing Card */
  predictionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    gap: 8,
    ...shadows.soft,
  },
  predictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  predictionEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  predictionValuesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  predictionCell: {
    flex: 1,
    gap: 2,
  },
  predictionLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 0.5,
  },
  predictionValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14.5,
    color: colors.light.foreground,
  },
  predictionDivider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(22, 23, 15, 0.08)",
    marginHorizontal: 12,
  },

  /* Form Cards */
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 12,
    ...shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    marginTop: 2,
  },

  /* Fit Preferences Grid */
  fitPrefGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  fitPrefTile: {
    width: "48.5%",
    backgroundColor: "rgba(22, 23, 15, 0.02)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 4,
  },
  fitPrefTileActive: {
    backgroundColor: "#181b12",
    borderColor: "#181b12",
  },
  fitPrefIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  fitPrefIconBoxActive: {
    backgroundColor: "rgba(200, 164, 74, 0.2)",
  },
  fitPrefLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  fitPrefLabelActive: {
    color: "#ffffff",
  },
  fitPrefDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    lineHeight: 14,
  },
  fitPrefDescActive: {
    color: "rgba(255, 255, 255, 0.7)",
  },

  /* Input Fields */
  fieldsRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldCol: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#85651b",
    letterSpacing: 0.8,
  },
  fieldInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    gap: 6,
  },
  fieldInput: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    padding: 0,
  },
  unitSuffix: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  fieldHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },

  /* Save Button */
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#181b12",
    borderRadius: radii.full,
    paddingVertical: 14,
    marginTop: 6,
    ...shadows.soft,
  },
  saveBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
});
