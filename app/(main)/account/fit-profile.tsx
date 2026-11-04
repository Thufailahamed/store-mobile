import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { fetchJson } from "@/lib/api/backend";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { UserPageFrame, UP as C } from "@/components/user/user-page";

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
          placeholderTextColor={C.faint}
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
        const data = res.ok ? (res.data.data ?? res.data) : null;
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

  const set = (key: string) => (v: string) =>
    setVals((s) => ({ ...s, [key]: v }));
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

    // Largest threshold first — otherwise the XL / 36 bands are unreachable.
    let top = "Medium (EU 48)";
    if (chest < 92) top = "Small (EU 46)";
    else if (chest > 112) top = "XL (EU 54)";
    else if (chest > 104) top = "Large (EU 50–52)";

    let bottom = "32 Regular";
    if (waist < 76) bottom = "30 Slim";
    else if (waist > 94) bottom = "36 Relaxed";
    else if (waist > 86) bottom = "34 Classic";

    return { top, bottom };
  }, [vals.chest_cm, vals.waist_cm]);

  return (
    <UserPageFrame
      title="Fit & tailoring"
      right={
        <>
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
              <ActivityIndicator size="small" color={C.accent} />
            ) : (
              <Ionicons
                name="checkmark"
                size={19}
                color={colors.light.foreground}
              />
            )}
          </TouchableOpacity>
        </>
      }
    >
      <SafeAreaView style={styles.container} edges={[]}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.accent} size="small" />
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
            {/* Suggested size */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIcon}>
                    <Ionicons name="resize-outline" size={22} color={C.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle}>Suggested size</Text>
                    <Text style={styles.heroCopy}>
                      {predictedSize
                        ? "Based on your chest and waist."
                        : "Add your chest and waist below to see it."}
                    </Text>
                  </View>
                </View>

                {predictedSize ? (
                  <View style={styles.sizeStrip}>
                    <View style={styles.sizeCell}>
                      <Text style={styles.sizeValue} numberOfLines={1} adjustsFontSizeToFit>
                        {predictedSize.top}
                      </Text>
                      <Text style={styles.sizeLabel}>Tops & jackets</Text>
                    </View>
                    <View style={styles.sizeDivider} />
                    <View style={styles.sizeCell}>
                      <Text style={styles.sizeValue} numberOfLines={1} adjustsFontSizeToFit>
                        {predictedSize.bottom}
                      </Text>
                      <Text style={styles.sizeLabel}>Trousers & pants</Text>
                    </View>
                  </View>
                ) : null}

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
              </View>
            </View>

            {/* Silhouette */}
            <View style={styles.cardShadow}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Preferred silhouette</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="shirt-outline" size={16} color={C.accent} />
                </View>
              </View>

              <View style={styles.fitGrid}>
                {FIT_PREFERENCES.map((p) => {
                  const isSelected = fitPref === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.fitTile,
                        isSelected && styles.fitTileActive,
                      ]}
                      onPress={() => setFitPref(p.id)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={styles.fitTileTop}>
                        <View
                          style={[
                            styles.fitIcon,
                            isSelected && styles.fitIconActive,
                          ]}
                        >
                          <Ionicons
                            name={p.icon}
                            size={15}
                            color={isSelected ? C.ink : C.text}
                          />
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color={C.lime} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.fitLabel,
                          isSelected && styles.fitLabelActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                      <Text
                        style={[
                          styles.fitDesc,
                          isSelected && styles.fitDescActive,
                        ]}
                      >
                        {p.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            </View>

            {/* Proportions */}
            <View style={styles.cardShadow}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>General proportions</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="body-outline" size={16} color={C.accent} />
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
            </View>

            {/* Upper body */}
            <View style={styles.cardShadow}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Tops, shirts & jackets</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="cut-outline" size={16} color={C.accent} />
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
            </View>

            {/* Lower body */}
            <View style={styles.cardShadow}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Trousers & skirts</Text>
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name="layers-outline" size={16} color={C.accent} />
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
                  <ActivityIndicator size="small" color={C.ink} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={C.ink} />
                )}
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </UserPageFrame>
  );
}

const SHADOW = {
  shadowColor: "#16170f",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted },
    navBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: C.card,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#16170f",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 3,
    },
    scrollContent: { paddingHorizontal: 20, paddingTop: 2, gap: 16 },

    /* Cards */
    cardShadow: { borderRadius: 26, backgroundColor: C.card, ...SHADOW },
    card: {
      backgroundColor: C.card,
      borderRadius: 26,
      borderCurve: "continuous",
      padding: 18,
      borderWidth: 1,
      borderColor: C.line,
      gap: 16,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    cardHeaderText: { flex: 1 },
    cardTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Suggested size */
    heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.accentSoft,
    },
    heroCopy: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 2 },
    sizeStrip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 20,
      borderCurve: "continuous",
      backgroundColor: C.ink,
    },
    sizeCell: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
    sizeValue: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.cream },
    sizeLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },
    sizeDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },
    unitSwitch: { flexDirection: "row", backgroundColor: "#f3f1e8", borderRadius: 22, padding: 4 },
    unitPill: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
    unitPillActive: { backgroundColor: C.ink },
    unitPillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.muted },
    unitPillTextActive: { color: C.cream },

    /* Silhouette grid */
    fitGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    fitTile: {
      width: "48%",
      flexGrow: 1,
      backgroundColor: "#f5f3ec",
      borderRadius: 20,
      borderCurve: "continuous",
      padding: 14,
      borderWidth: 1.5,
      borderColor: "transparent",
      gap: 4,
    },
    fitTileActive: { backgroundColor: C.ink, borderColor: C.ink },
    fitTileTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    fitIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.card,
      alignItems: "center",
      justifyContent: "center",
    },
    fitIconActive: { backgroundColor: C.lime },
    fitLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.text },
    fitLabelActive: { color: C.cream },
    fitDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 12, lineHeight: 16, color: C.muted },
    fitDescActive: { color: "rgba(250,248,241,0.6)" },

    /* Inputs */
    fieldsRow: {
      flexDirection: "row",
      gap: 12,
    },
    fieldCol: {
      flex: 1,
      gap: 6,
    },
    fieldLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.text },
    fieldInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#f5f3ec",
      borderRadius: 16,
      paddingHorizontal: 14,
      height: 52,
      gap: 8,
    },
    fieldInput: {
      flex: 1,
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 16,
      color: C.text,
      padding: 0,
      fontVariant: ["tabular-nums"],
    },
    unitSuffix: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: C.muted },
    fieldHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },

    /* Save */
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 56,
      paddingLeft: 22,
      paddingRight: 6,
      borderRadius: 28,
      backgroundColor: C.ink,
      marginTop: 4,
    },
    saveBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: C.cream },
    saveBtnArrow: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.lime,
    },
});
