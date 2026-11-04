import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Text,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Line, Circle, Text as SvgText } from "react-native-svg";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { Modal } from "@/components/ui/Modal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getSizeChartsBackend } from "@/lib/api/backend";
import { C } from "@/components/orders/parcel-track";

interface SizeGuideModalProps {
  visible: boolean;
  onClose: () => void;
  category?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
}

interface MeasurementRow {
  size: string;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  lengthCm: number;
  chestIn: number;
  waistIn: number;
  hipIn: number;
  lengthIn: number;
}

const SIZE_DATA: MeasurementRow[] = [
  { size: "XS", chestCm: 86, waistCm: 71, hipCm: 89, lengthCm: 68, chestIn: 34, waistIn: 28, hipIn: 35, lengthIn: 26.8 },
  { size: "S", chestCm: 91, waistCm: 76, hipCm: 94, lengthCm: 70, chestIn: 36, waistIn: 30, hipIn: 37, lengthIn: 27.5 },
  { size: "M", chestCm: 97, waistCm: 81, hipCm: 99, lengthCm: 72, chestIn: 38, waistIn: 32, hipIn: 39, lengthIn: 28.3 },
  { size: "L", chestCm: 102, waistCm: 86, hipCm: 104, lengthCm: 74, chestIn: 40, waistIn: 34, hipIn: 41, lengthIn: 29.1 },
  { size: "XL", chestCm: 107, waistCm: 91, hipCm: 109, lengthCm: 76, chestIn: 42, waistIn: 36, hipIn: 43, lengthIn: 29.9 },
  { size: "XXL", chestCm: 112, waistCm: 97, hipCm: 114, lengthCm: 78, chestIn: 44, waistIn: 38, hipIn: 45, lengthIn: 30.7 },
];

const FIT_STOPS = ["Slim", "Tailored", "Relaxed"] as const;
const FIT_INDEX = 1;
const COLUMNS = ["Chest", "Waist", "Hips", "Length"] as const;
const TIPS = [
  { lead: "Chest / Bust", body: "Around the fullest part of the chest, tape held level beneath the arms." },
  { lead: "Waist", body: "Around the natural waistline — the narrowest point, just above the hip bone." },
  { lead: "Hips", body: "Around the fullest part of the hips, feet together." },
  { lead: "Length", body: "From the highest point of the shoulder straight down to the hem." },
];

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const toIn = (cm: number) => Math.round((cm / 2.54) * 10) / 10;

const gold = colors.accent2.ochre;

export function SizeGuideModal({ visible, onClose, category, brandId, categoryId }: SizeGuideModalProps) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [chestInput, setChestInput] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<MeasurementRow[]>(SIZE_DATA);

  useEffect(() => {
    if (!visible) {
      setChestInput("");
      setPicked(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !brandId || !categoryId) return;
    let cancelled = false;
    void getSizeChartsBackend({ brand_id: brandId, category_id: categoryId }).then((res) => {
      if (cancelled || !res.ok) return;
      const chart = res.data.data?.[0];
      const mapped = (chart?.rows ?? []).map((r) => {
        const chest = r.chest_max ?? r.chest_min ?? 0;
        const waist = r.waist_max ?? r.waist_min ?? 0;
        const hip = r.hips_max ?? r.hips_min ?? 0;
        const length = r.length_max ?? r.length_min ?? 0;
        return {
          size: r.size_label,
          chestCm: chest,
          waistCm: waist,
          hipCm: hip,
          lengthCm: length,
          chestIn: toIn(chest),
          waistIn: toIn(waist),
          hipIn: toIn(hip),
          lengthIn: toIn(length),
        };
      });
      if (mapped.length > 0) setRows(mapped);
    });
    return () => { cancelled = true; };
  }, [visible, brandId, categoryId]);

  const chestCm = useMemo(() => {
    const v = parseFloat(chestInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return null;
    return unit === "cm" ? v : v * 2.54;
  }, [chestInput, unit]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.chestCm - b.chestCm), [rows]);
  const recommended =
    chestCm == null ? null : sorted.find((r) => r.chestCm >= chestCm - 0.5)?.size ?? "beyond";
  const activeSize = recommended && recommended !== "beyond" ? recommended : picked;
  const recRow = sorted.find((r) => r.size === recommended);

  // Sizes sit at even steps on the rail; the reader's marker interpolates
  // between the two sizes whose chest values bracket the measurement.
  const markerPct = (cm: number) => {
    const n = sorted.length;
    if (n === 0) return 50;
    const stop = (i: number) => ((i + 0.5) / n) * 100;
    const half = 50 / n;
    const first = sorted[0].chestCm;
    const last = sorted[n - 1].chestCm;
    if (cm <= first) return Math.max(0, stop(0) - half * Math.min(1, (first - cm) / 6));
    if (cm >= last) return Math.min(100, stop(n - 1) + half * Math.min(1, (cm - last) / 6));
    const i = sorted.findIndex((r) => r.chestCm >= cm) - 1;
    const a = sorted[i].chestCm;
    const b = sorted[i + 1].chestCm;
    return stop(i) + (stop(i + 1) - stop(i)) * ((cm - a) / (b - a || 1));
  };

  // Convert the typed measurement when the unit flips, so the result is stable.
  const switchUnit = (next: "cm" | "in") => {
    if (next === unit) return;
    if (chestCm != null) {
      const v = next === "cm" ? chestCm : chestCm / 2.54;
      setChestInput(fmt(Math.round(v * 10) / 10));
    }
    setUnit(next);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.dismissOverlay} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
          <LinearGradient
            pointerEvents="none"
            colors={[C.glow, C.glowSoft, C.paper]}
            locations={[0, 0.55, 1]}
            style={styles.sheetGlow}
          />
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} accessibilityRole="header">Size Guide</Text>
                <View style={styles.subRow}>
                  <Ionicons name="resize-outline" size={13} color={C.muted} />
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {category ? `${category} · ` : ""}body measurements
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.8}
                hitSlop={8}
                accessibilityLabel="Close size guide"
              >
                <Ionicons name="close" size={19} color={C.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Find your size */}
            <Animated.View layout={LinearTransition.duration(220)} style={styles.finder}>
              <View style={styles.finderTop}>
                <View style={styles.finderIcon}>
                  <Ionicons name="body-outline" size={18} color={C.lime} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.finderTitle}>Find your size</Text>
                  <Text style={styles.finderSub}>Enter your chest measurement</Text>
                </View>
                <UnitToggle unit={unit} onChange={switchUnit} dark />
              </View>

              <View style={styles.finderRow}>
                <Pressable
                  onPress={() => inputRef.current?.focus()}
                  style={[styles.inputWrap, focused && styles.inputWrapFocused]}
                >
                  <TextInput
                    ref={inputRef}
                    value={chestInput}
                    onChangeText={setChestInput}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    keyboardType="decimal-pad"
                    placeholder={unit === "cm" ? "e.g. 96" : "e.g. 38"}
                    placeholderTextColor="rgba(250,248,241,0.3)"
                    style={styles.input}
                    maxLength={5}
                    returnKeyType="done"
                    selectionColor={C.lime}
                    accessibilityLabel={`Chest measurement in ${unit === "cm" ? "centimetres" : "inches"}`}
                  />
                  <Text style={styles.inputUnit}>{unit}</Text>
                </Pressable>

                <View style={[styles.result, recRow && styles.resultOn]}>
                  <Text style={[styles.resultLabel, recRow && styles.resultLabelOn]}>Your size</Text>
                  {recRow ? (
                    <Animated.Text key={recRow.size} entering={FadeIn.duration(260)} style={styles.resultSize}>
                      {recRow.size}
                    </Animated.Text>
                  ) : (
                    <Text style={styles.resultEmpty}>—</Text>
                  )}
                </View>
              </View>

              {/* Evenly spaced size rail; the marker interpolates between sizes */}
              <View style={styles.rail}>
                <View style={styles.railTrack} />
                {chestCm != null && (
                  <View style={[styles.railMarker, { left: `${markerPct(chestCm)}%` }]} />
                )}
                <View style={styles.railStops}>
                  {sorted.map((r) => {
                    const on = activeSize === r.size;
                    return (
                      <View key={r.size} style={styles.railStop}>
                        <View style={[styles.railDot, on && styles.railDotOn]} />
                        <Text style={[styles.railLabel, on && styles.railLabelOn]}>{r.size}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {recommended === "beyond" && (
                <Animated.View entering={FadeInDown.duration(220)} style={styles.note}>
                  <Ionicons name="color-wand-outline" size={15} color={C.lime} />
                  <Text style={styles.noteText}>
                    Beyond our standard range — contact the store about made-to-measure.
                  </Text>
                </Animated.View>
              )}
              {recRow && (
                <Animated.View entering={FadeInDown.duration(220)} style={styles.note}>
                  <Ionicons name="sparkles" size={14} color={C.lime} />
                  <Text style={styles.noteText}>
                    Size {recRow.size} fits up to a{" "}
                    {fmt(unit === "cm" ? recRow.chestCm : recRow.chestIn)} {unit} chest.
                  </Text>
                </Animated.View>
              )}
            </Animated.View>

            {/* The cut */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>The cut</Text>
                  <View style={styles.verdict}>
                    <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                    <Text style={styles.verdictText}>True to size</Text>
                  </View>
                </View>
                <View style={styles.chips}>
                  {FIT_STOPS.map((stop, i) => {
                    const on = i === FIT_INDEX;
                    return (
                      <View key={stop} style={[styles.chip, on && styles.chipOn]}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{stop}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.bodyText}>
                  A tailored, regular drape. Between sizes? Size up for a softer, more relaxed silhouette.
                </Text>
              </View>
            </View>

            {/* Measurements */}
            <View style={styles.sectionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Measurements</Text>
                <Text style={styles.sectionSub}>
                  Body sizes in {unit === "cm" ? "centimetres" : "inches"}
                </Text>
              </View>
              <UnitToggle unit={unit} onChange={switchUnit} />
            </View>

            <View style={styles.cardShadow}>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, styles.colSize]}>SIZE</Text>
                  {COLUMNS.map((c) => (
                    <Text key={c} style={styles.th}>{c.toUpperCase()}</Text>
                  ))}
                </View>
                {rows.map((row, idx) => {
                  const active = activeSize === row.size;
                  const vals = unit === "cm"
                    ? [row.chestCm, row.waistCm, row.hipCm, row.lengthCm]
                    : [row.chestIn, row.waistIn, row.hipIn, row.lengthIn];
                  return (
                    <Pressable
                      key={row.size}
                      onPress={() => setPicked(active && !recommended ? null : row.size)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Size ${row.size}`}
                      style={({ pressed }) => [
                        styles.tableRow,
                        idx < rows.length - 1 && !active && styles.tableRowDivider,
                        pressed && !active && styles.tableRowPressed,
                        active && styles.tableRowActive,
                      ]}
                    >
                      <View style={styles.colSize}>
                        <View style={[styles.sizeBadge, active && styles.sizeBadgeOn]}>
                          <Text
                            style={[styles.sizeText, active && styles.sizeTextOn]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {row.size}
                          </Text>
                        </View>
                      </View>
                      {vals.map((v, i) => (
                        <Text key={i} style={[styles.td, active && styles.tdOn]}>
                          {fmt(v)}
                        </Text>
                      ))}
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text style={styles.footnote}>Tap a size to highlight it across the chart.</Text>

            {/* How to measure */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>How to measure</Text>
                <View style={styles.measureBody}>
                  <View style={styles.figureWrap}>
                    <MeasureFigure />
                  </View>
                  <View style={styles.tipList}>
                    {TIPS.map((tip, i) => (
                      <View key={tip.lead} style={styles.tipItem}>
                        <View style={styles.tipBadge}>
                          <Text style={styles.tipNum}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tipLead}>{tip.lead}</Text>
                          <Text style={styles.tipBody}>{tip.body}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.proTip}>
                  <View style={styles.proTipIcon}>
                    <Ionicons name="bulb-outline" size={15} color={C.accent} />
                  </View>
                  <Text style={styles.proTipText}>
                    Measure over light underwear with a soft tape — snug, never tight.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function UnitToggle({
  unit,
  onChange,
  dark = false,
}: {
  unit: "cm" | "in";
  onChange: (u: "cm" | "in") => void;
  dark?: boolean;
}) {
  return (
    <View style={[styles.toggle, dark && styles.toggleDark]}>
      {(["cm", "in"] as const).map((u) => {
        const active = unit === u;
        return (
          <TouchableOpacity
            key={u}
            onPress={() => onChange(u)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={u === "cm" ? "Centimetres" : "Inches"}
            accessibilityState={{ selected: active }}
            style={[styles.toggleOpt, active && (dark ? styles.toggleOptOnDark : styles.toggleOptOn)]}
          >
            <Text
              style={[
                styles.toggleText,
                dark && styles.toggleTextDark,
                active && (dark ? styles.toggleTextOnDark : styles.toggleTextOn),
              ]}
            >
              {u}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Dress-form line drawing with numbered measurement guides. */
function MeasureFigure() {
  const line = colors.olive[600];
  const guide = gold;
  const marks = [
    { n: 1, y: 50, x1: 15, x2: 85 },
    { n: 2, y: 86, x1: 27, x2: 73 },
    { n: 3, y: 118, x1: 18, x2: 82 },
  ];
  return (
    <Svg width={92} height={172} viewBox="0 0 104 180">
      <Path
        d="M42 8 L58 8 C58 16 62 20 72 24 C80 27 82 34 80 44 C78 58 70 72 68 86 C67 96 76 106 77 118 C78 128 74 136 70 140 L30 140 C26 136 22 128 23 118 C24 106 33 96 32 86 C30 72 22 58 20 44 C18 34 20 27 28 24 C38 20 42 16 42 8 Z"
        fill={colors.olive[50]}
        stroke={line}
        strokeWidth={1.1}
      />
      <Line x1={50} y1={140} x2={50} y2={168} stroke={line} strokeWidth={1.1} />
      <Line x1={36} y1={170} x2={64} y2={170} stroke={line} strokeWidth={1.1} strokeLinecap="round" />
      {marks.map((m) => (
        <React.Fragment key={m.n}>
          <Line x1={m.x1} y1={m.y} x2={m.x2} y2={m.y} stroke={guide} strokeWidth={1.2} strokeDasharray="3 2.5" />
          <Circle cx={m.x1 - 7} cy={m.y} r={6} fill={colors.light.card} stroke={guide} strokeWidth={1} />
          <SvgText x={m.x1 - 7} y={m.y + 2.6} fontSize={7.5} fontWeight="600" fill={colors.olive[800]} textAnchor="middle">
            {m.n}
          </SvgText>
        </React.Fragment>
      ))}
      <Line x1={94} y1={24} x2={94} y2={140} stroke={guide} strokeWidth={1.2} strokeDasharray="3 2.5" />
      <Line x1={90} y1={24} x2={98} y2={24} stroke={guide} strokeWidth={1.2} />
      <Line x1={90} y1={140} x2={98} y2={140} stroke={guide} strokeWidth={1.2} />
      <Circle cx={94} cy={82} r={6} fill={colors.light.card} stroke={guide} strokeWidth={1} />
      <SvgText x={94} y={84.6} fontSize={7.5} fontWeight="600" fill={colors.olive[800]} textAnchor="middle">
        4
      </SvgText>
    </Svg>
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
  backdrop: { flex: 1, backgroundColor: "rgba(22, 23, 15, 0.55)", justifyContent: "flex-end" },
  dismissOverlay: { flex: 1 },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: "continuous",
    overflow: "hidden",
    maxHeight: Dimensions.get("window").height * 0.92,
  },
  sheetGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },

  // Header — same language as My Orders
  sheetHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, gap: 14 },
  sheetHandle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: "rgba(22,23,15,0.14)", alignSelf: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    letterSpacing: -0.8,
    color: C.text,
  },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  subtitle: {
    flexShrink: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: C.muted,
    textTransform: "capitalize",
  },
  closeBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.card,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 24, gap: 16 },

  // Finder — ink card, lime accents
  finder: {
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.ink,
    padding: 20,
    gap: 18,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 8,
  },
  finderTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  finderIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(200,224,138,0.14)",
  },
  finderTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16.5, letterSpacing: -0.3, color: C.cream },
  finderSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(250,248,241,0.6)", marginTop: 1 },
  finderRow: { flexDirection: "row", gap: 10 },
  inputWrap: {
    flex: 1,
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(250,248,241,0.07)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.12)",
  },
  inputWrapFocused: { borderColor: "rgba(200,224,138,0.7)", backgroundColor: "rgba(250,248,241,0.1)" },
  input: {
    flex: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 30,
    letterSpacing: -0.6,
    color: C.cream,
    paddingVertical: 0,
    fontVariant: ["tabular-nums"],
  },
  inputUnit: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: "rgba(250,248,241,0.5)" },
  result: {
    width: 92,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,241,0.07)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.12)",
  },
  resultOn: { backgroundColor: C.lime, borderColor: C.lime },
  resultLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "rgba(250,248,241,0.55)" },
  resultLabelOn: { color: "rgba(22,23,15,0.6)" },
  resultSize: { fontFamily: fontFamilies.sans.bold, fontSize: 26, letterSpacing: -0.5, color: C.ink, marginTop: 1 },
  resultEmpty: { fontFamily: fontFamilies.sans.bold, fontSize: 24, color: "rgba(250,248,241,0.3)", marginTop: 1 },

  rail: { height: 40, justifyContent: "flex-start" },
  railTrack: {
    position: "absolute", top: 5, left: 0, right: 0, height: 2, borderRadius: 1,
    backgroundColor: "rgba(250,248,241,0.12)",
  },
  railStops: { flexDirection: "row" },
  railStop: { flex: 1, alignItems: "center", gap: 8 },
  railDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.ink,
    borderWidth: 2, borderColor: "rgba(250,248,241,0.3)",
  },
  railDotOn: { backgroundColor: C.lime, borderColor: C.lime },
  railLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "rgba(250,248,241,0.5)" },
  railLabelOn: { color: C.lime },
  railMarker: {
    position: "absolute", top: -1, width: 14, height: 14, marginLeft: -7, borderRadius: 7,
    backgroundColor: C.cream, borderWidth: 3, borderColor: C.lime, zIndex: 2,
  },
  note: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(200,224,138,0.1)",
  },
  noteText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13, lineHeight: 18, color: "rgba(250,248,241,0.88)" },

  // White cards
  cardShadow: { borderRadius: 26, backgroundColor: C.card, ...SHADOW },
  card: {
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    gap: 16,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
  verdict: {
    flexDirection: "row", alignItems: "center", gap: 5,
    height: 28, paddingHorizontal: 10, borderRadius: 14,
    backgroundColor: C.accentSoft,
  },
  verdictText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.accent },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1, borderColor: "rgba(22,23,15,0.1)",
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  chipTextOn: { color: C.cream },
  bodyText: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 20, color: C.muted },

  // Section header
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, paddingHorizontal: 2 },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  sectionSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 1 },

  // Unit toggle
  toggle: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
  },
  toggleDark: { backgroundColor: "rgba(250,248,241,0.07)", borderColor: "rgba(250,248,241,0.12)" },
  toggleOpt: { minWidth: 40, height: 32, paddingHorizontal: 10, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  toggleOptOn: { backgroundColor: C.ink },
  toggleOptOnDark: { backgroundColor: C.lime },
  toggleText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.muted },
  toggleTextDark: { color: "rgba(250,248,241,0.6)" },
  toggleTextOn: { color: C.cream },
  toggleTextOnDark: { color: C.ink },

  // Table
  table: {
    borderRadius: 26,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  th: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: C.muted,
  },
  colSize: { width: 56, flex: 0, alignItems: "flex-start", textAlign: "left" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    marginHorizontal: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  tableRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(22,23,15,0.08)", borderRadius: 0 },
  tableRowPressed: { backgroundColor: "rgba(22,23,15,0.03)" },
  tableRowActive: { backgroundColor: C.accentSoft },
  sizeBadge: {
    minWidth: 40,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f1e8",
  },
  sizeBadgeOn: { backgroundColor: C.ink },
  sizeText: { fontFamily: fontFamilies.sans.bold, fontSize: 13.5, color: C.text },
  sizeTextOn: { color: C.lime },
  td: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14.5,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  tdOn: { fontFamily: fontFamilies.sans.bold, color: C.ink },
  footnote: {
    textAlign: "center",
    marginTop: -6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: C.muted,
  },

  // How to measure
  measureBody: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  figureWrap: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: C.paper,
  },
  tipList: { flex: 1, gap: 14 },
  tipItem: { flexDirection: "row", gap: 10 },
  tipBadge: {
    width: 22, height: 22, borderRadius: 11, marginTop: 1,
    backgroundColor: C.ink,
    alignItems: "center", justifyContent: "center",
  },
  tipNum: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: C.lime },
  tipLead: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  tipBody: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: C.muted, marginTop: 2 },
  proTip: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: C.accentSoft,
  },
  proTipIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.card,
  },
  proTipText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13, lineHeight: 18, color: colors.olive[800] },
});
