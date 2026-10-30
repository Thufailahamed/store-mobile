import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
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
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getSizeChartsBackend } from "@/lib/api/backend";

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

const ink = colors.light.foreground;
const hair = `${colors.light.primary}1A`;
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

  // Position of the reader's measurement along the chest range, for the gauge.
  const range = useMemo(() => {
    const lo = (sorted[0]?.chestCm ?? 80) - 6;
    const hi = (sorted[sorted.length - 1]?.chestCm ?? 120) + 6;
    const pct = (cm: number) => Math.min(100, Math.max(0, ((cm - lo) / (hi - lo)) * 100));
    return { pct };
  }, [sorted]);

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
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.kickerRow}>
                  <View style={styles.kickerRule} />
                  <Label style={styles.kicker}>ATELIER SIZING</Label>
                  {category ? (
                    <>
                      <View style={styles.kickerDot} />
                      <Label style={styles.kickerMuted} numberOfLines={1}>
                        {category.toUpperCase()}
                      </Label>
                    </>
                  ) : null}
                </View>
                <Display size="xl" style={styles.title}>
                  The Fit{" "}
                  <Display size="xl" italic style={styles.titleItalic}>Guide</Display>
                </Display>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={8}
                accessibilityLabel="Close size guide"
              >
                <Ionicons name="close" size={17} color={ink} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Find your size — hero */}
            <Animated.View layout={LinearTransition.duration(220)} style={styles.heroShadow}>
              <LinearGradient
                colors={[colors.olive[800], colors.olive[950]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Label style={styles.heroKicker}>FIND YOUR SIZE</Label>
                    <Body size="xs" style={styles.heroSub}>
                      Enter your chest measurement
                    </Body>
                  </View>
                  <UnitToggle unit={unit} onChange={switchUnit} dark />
                </View>

                <View style={styles.heroInputRow}>
                  <Pressable
                    onPress={() => inputRef.current?.focus()}
                    style={[styles.heroInputWrap, focused && styles.heroInputWrapFocused]}
                  >
                    <TextInput
                      ref={inputRef}
                      value={chestInput}
                      onChangeText={setChestInput}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      keyboardType="decimal-pad"
                      placeholder={unit === "cm" ? "96" : "38"}
                      placeholderTextColor={`${colors.light.primaryForeground}40`}
                      style={styles.heroInput}
                      maxLength={5}
                      returnKeyType="done"
                      selectionColor={gold}
                      accessibilityLabel={`Chest measurement in ${unit === "cm" ? "centimetres" : "inches"}`}
                    />
                    <Label style={styles.heroUnit}>{unit.toUpperCase()}</Label>
                  </Pressable>

                  <View style={styles.heroResult}>
                    <Label style={styles.heroResultKicker}>YOUR SIZE</Label>
                    {recommended && recommended !== "beyond" ? (
                      <Animated.View key={recommended} entering={FadeIn.duration(260)}>
                        <Display size="3xl" style={styles.heroResultSize}>{recommended}</Display>
                      </Animated.View>
                    ) : (
                      <Display size="3xl" style={styles.heroResultEmpty}>—</Display>
                    )}
                  </View>
                </View>

                {/* Chest-range gauge */}
                <View style={styles.gauge}>
                  <View style={styles.gaugeTrack} />
                  {sorted.map((r) => (
                    <View
                      key={r.size}
                      style={[styles.gaugeTick, { left: `${range.pct(r.chestCm)}%` }]}
                    >
                      <View
                        style={[
                          styles.gaugeTickMark,
                          activeSize === r.size && styles.gaugeTickMarkActive,
                        ]}
                      />
                      <Label
                        style={[
                          styles.gaugeTickLabel,
                          activeSize === r.size && styles.gaugeTickLabelActive,
                        ]}
                      >
                        {r.size}
                      </Label>
                    </View>
                  ))}
                  {chestCm != null && (
                    <View style={[styles.gaugeMarker, { left: `${range.pct(chestCm)}%` }]}>
                      <View style={styles.gaugeMarkerDiamond} />
                    </View>
                  )}
                </View>

                {recommended === "beyond" && (
                  <Animated.View entering={FadeInDown.duration(220)} style={styles.heroNote}>
                    <Ionicons name="color-wand-outline" size={14} color={gold} />
                    <Body size="xs" style={styles.heroNoteText}>
                      Beyond our standard range — contact the store about made-to-measure.
                    </Body>
                  </Animated.View>
                )}
                {recRow && (
                  <Animated.View entering={FadeInDown.duration(220)} style={styles.heroNote}>
                    <Ionicons name="sparkles-outline" size={14} color={gold} />
                    <Body size="xs" style={styles.heroNoteText}>
                      Size {recRow.size} is cut for up to a{" "}
                      {fmt(unit === "cm" ? recRow.chestCm : recRow.chestIn)} {unit} chest.
                    </Body>
                  </Animated.View>
                )}
              </LinearGradient>
            </Animated.View>

            {/* The fit */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Label style={styles.cardKicker}>THE CUT</Label>
                <View style={styles.verdict}>
                  <View style={styles.verdictDot} />
                  <Label style={styles.verdictText}>TRUE TO SIZE</Label>
                </View>
              </View>
              <View style={styles.fitScale}>
                {FIT_STOPS.map((stop, i) => {
                  const active = i === FIT_INDEX;
                  return (
                    <View key={stop} style={[styles.fitSeg, active && styles.fitSegActive]}>
                      <Display
                        size="sm"
                        italic={active}
                        style={[styles.fitSegText, active && styles.fitSegTextActive]}
                      >
                        {stop}
                      </Display>
                    </View>
                  );
                })}
              </View>
              <Body size="xs" muted style={styles.fitCopy}>
                A tailored, regular drape. Between sizes? Size up for a softer, more relaxed silhouette.
              </Body>
            </View>

            {/* Measurements table */}
            <View style={styles.sectionRow}>
              <View>
                <Label style={styles.sectionLabel}>MEASUREMENTS</Label>
                <Body size="xs" muted style={styles.sectionSub}>
                  Body sizes in {unit === "cm" ? "centimetres" : "inches"}
                </Body>
              </View>
              <Label style={styles.sectionUnit}>{unit.toUpperCase()}</Label>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Label style={[styles.th, styles.colSize, { textAlign: "left" }]}>SIZE</Label>
                {COLUMNS.map((c) => (
                  <Label key={c} style={styles.th}>{c.toUpperCase()}</Label>
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
                      idx < rows.length - 1 && styles.tableRowDivider,
                      pressed && !active && styles.tableRowPressed,
                      active && styles.tableRowActive,
                    ]}
                  >
                    {active && <View style={styles.activeBar} />}
                    <View style={[styles.colSize, styles.sizeCell]}>
                      <Display size="lg" style={[styles.sizeText, active && styles.sizeTextActive]}>
                        {row.size}
                      </Display>
                    </View>
                    {vals.map((v, i) => (
                      <View key={i} style={styles.tdCell}>
                        <Body size="xs" style={[styles.cellText, active && styles.cellTextActive]}>
                          {fmt(v)}
                        </Body>
                      </View>
                    ))}
                  </Pressable>
                );
              })}
            </View>
            <Body size="xs" muted style={styles.footnote}>
              Tap a size to highlight it across the chart.
            </Body>

            {/* How to measure */}
            <View style={styles.card}>
              <Label style={styles.cardKicker}>HOW TO MEASURE</Label>
              <View style={styles.measureBody}>
                <MeasureFigure />
                <View style={styles.tipList}>
                  {TIPS.map((tip, i) => (
                    <View key={tip.lead} style={styles.tipItem}>
                      <View style={styles.tipBadge}>
                        <Label style={styles.tipNum}>{i + 1}</Label>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body size="sm" style={styles.tipLead}>{tip.lead}</Body>
                        <Body size="xs" muted style={styles.tipBody}>{tip.body}</Body>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.proTip}>
                <Ionicons name="bulb-outline" size={14} color={colors.olive[700]} />
                <Body size="xs" style={styles.proTipText}>
                  Measure over light underwear with a soft tape — snug, never tight.
                </Body>
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
            accessibilityState={{ selected: active }}
            style={[
              styles.toggleOpt,
              active && (dark ? styles.toggleOptActiveDark : styles.toggleOptActive),
            ]}
          >
            <Label
              style={[
                styles.toggleText,
                dark && styles.toggleTextDark,
                active && (dark ? styles.toggleTextActiveDark : styles.toggleTextActive),
              ]}
            >
              {u.toUpperCase()}
            </Label>
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22, 23, 15, 0.62)", justifyContent: "flex-end" },
  dismissOverlay: { flex: 1 },
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: Dimensions.get("window").height * 0.92,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: hair,
    ...shadows.editorial,
  },

  // Header
  sheetHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2.5],
    paddingBottom: spacing[4],
    gap: spacing[3.5],
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: `${colors.light.border}CC`, alignSelf: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing[3] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  kickerRule: { width: 18, height: 1, backgroundColor: gold },
  kicker: { color: colors.olive[600], fontSize: 9.5, letterSpacing: 2.6, fontFamily: fontFamilies.mono.semibold },
  kickerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.light.border },
  kickerMuted: {
    flexShrink: 1, color: colors.light.mutedForeground, fontSize: 9.5, letterSpacing: 2,
    fontFamily: fontFamilies.mono.medium,
  },
  title: { marginTop: spacing[2], fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: ink },
  titleItalic: { color: colors.olive[600], fontSize: 30, letterSpacing: -0.4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.light.card,
    borderWidth: 1, borderColor: hair,
    alignItems: "center", justifyContent: "center",
    ...shadows.soft,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[1],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },

  // Hero finder
  heroShadow: {
    borderRadius: 24,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  hero: {
    borderRadius: 24,
    padding: spacing[5],
    gap: spacing[4],
    overflow: "hidden",
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3] },
  heroKicker: { color: gold, fontSize: 10, letterSpacing: 2.2, fontFamily: fontFamilies.mono.semibold },
  heroSub: { color: `${colors.light.primaryForeground}A6`, marginTop: 4 },
  heroInputRow: { flexDirection: "row", alignItems: "stretch", gap: spacing[3] },
  heroInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    borderRadius: 18,
    backgroundColor: "rgba(250, 248, 241, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(250, 248, 241, 0.14)",
  },
  heroInputWrapFocused: { borderColor: `${gold}B3`, backgroundColor: "rgba(250, 248, 241, 0.09)" },
  heroInput: {
    flex: 1,
    fontSize: 40,
    lineHeight: 50,
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.display.regular,
    paddingVertical: 0,
    letterSpacing: -1,
  },
  heroUnit: {
    marginLeft: 6, fontSize: 11, letterSpacing: 1.6,
    color: `${colors.light.primaryForeground}80`, fontFamily: fontFamilies.mono.medium,
  },
  heroResult: {
    width: 96,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${gold}55`,
    backgroundColor: `${gold}14`,
    paddingVertical: spacing[2],
  },
  heroResultKicker: { color: `${gold}D9`, fontSize: 8.5, letterSpacing: 1.8, fontFamily: fontFamilies.mono.semibold },
  heroResultSize: {
    color: colors.light.primaryForeground, fontSize: 34, lineHeight: 42,
    fontFamily: fontFamilies.display.italic,
  },
  heroResultEmpty: { color: `${colors.light.primaryForeground}40`, fontSize: 34, lineHeight: 42 },

  gauge: { height: 34, marginHorizontal: spacing[2], marginTop: spacing[1] },
  gaugeTrack: {
    position: "absolute", left: 0, right: 0, top: 6, height: 1,
    backgroundColor: "rgba(250, 248, 241, 0.18)",
  },
  gaugeTick: { position: "absolute", top: 2, width: 30, marginLeft: -15, alignItems: "center", gap: 6 },
  gaugeTickMark: { width: 1, height: 9, backgroundColor: "rgba(250, 248, 241, 0.35)" },
  gaugeTickMarkActive: { width: 2, backgroundColor: gold },
  gaugeTickLabel: {
    fontSize: 9, letterSpacing: 0.8, color: "rgba(250, 248, 241, 0.45)",
    fontFamily: fontFamilies.mono.medium,
  },
  gaugeTickLabelActive: { color: gold, fontFamily: fontFamilies.mono.semibold },
  gaugeMarker: { position: "absolute", top: 1, width: 12, marginLeft: -6, alignItems: "center" },
  gaugeMarkerDiamond: {
    width: 10, height: 10, backgroundColor: gold, transform: [{ rotate: "45deg" }],
    borderWidth: 2, borderColor: colors.olive[900],
  },
  heroNote: {
    flexDirection: "row", alignItems: "center", gap: spacing[2],
    paddingTop: spacing[3.5],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(250, 248, 241, 0.16)",
  },
  heroNoteText: { flex: 1, color: `${colors.light.primaryForeground}D9`, lineHeight: 17 },

  // Cards
  card: {
    backgroundColor: colors.light.card,
    borderRadius: 22,
    borderWidth: 1, borderColor: hair,
    padding: spacing[5],
    gap: spacing[4],
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardKicker: { fontSize: 10, letterSpacing: 2, color: colors.olive[600], fontFamily: fontFamilies.mono.semibold },
  verdict: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full,
    borderWidth: 1, borderColor: `${colors.olive[500]}33`,
  },
  verdictDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.olive[500] },
  verdictText: { fontSize: 9, letterSpacing: 1.4, color: colors.olive[700], fontFamily: fontFamilies.mono.semibold },

  fitScale: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  fitSeg: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radii.full },
  fitSegActive: { backgroundColor: colors.light.card, ...shadows.soft },
  fitSegText: { fontSize: 14, color: colors.light.mutedForeground },
  fitSegTextActive: { color: colors.olive[700] },
  fitCopy: { lineHeight: 19 },

  // Section header + toggle
  sectionRow: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    marginTop: spacing[2], paddingHorizontal: 2,
  },
  sectionLabel: { fontSize: 10, letterSpacing: 2, color: colors.olive[600], fontFamily: fontFamilies.mono.semibold },
  sectionSub: { marginTop: 3 },
  sectionUnit: {
    fontSize: 10, letterSpacing: 1.4, color: colors.olive[700], fontFamily: fontFamilies.mono.semibold,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full,
    borderWidth: 1, borderColor: hair, overflow: "hidden",
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.full, padding: 3,
    borderWidth: 1, borderColor: hair,
  },
  toggleDark: { backgroundColor: "rgba(250, 248, 241, 0.06)", borderColor: "rgba(250, 248, 241, 0.14)" },
  toggleOpt: { paddingHorizontal: 13, paddingVertical: 5, borderRadius: radii.full },
  toggleOptActive: { backgroundColor: colors.olive[700] },
  toggleOptActiveDark: { backgroundColor: colors.light.primaryForeground },
  toggleText: { fontSize: 10, letterSpacing: 1.2, color: colors.light.mutedForeground, fontFamily: fontFamilies.mono.medium },
  toggleTextDark: { color: "rgba(250, 248, 241, 0.6)" },
  toggleTextActive: { color: colors.light.primaryForeground, fontFamily: fontFamilies.mono.semibold },
  toggleTextActiveDark: { color: colors.olive[900], fontFamily: fontFamilies.mono.semibold },

  // Table
  table: {
    borderRadius: 22, borderWidth: 1, borderColor: hair,
    overflow: "hidden", backgroundColor: colors.light.card,
  },
  tableHeader: {
    flexDirection: "row",
    paddingTop: spacing[4], paddingBottom: spacing[3], paddingHorizontal: spacing[5],
    borderBottomWidth: 1, borderBottomColor: hair,
  },
  th: {
    flex: 1, textAlign: "center", fontSize: 8.5, letterSpacing: 1.5,
    color: colors.light.mutedForeground, fontFamily: fontFamilies.mono.semibold,
  },
  colSize: { flex: 0.8 },
  tableRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 15, paddingHorizontal: spacing[5],
  },
  tableRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: `${colors.light.border}99` },
  tableRowPressed: { backgroundColor: `${colors.olive[500]}0A` },
  tableRowActive: { backgroundColor: `${colors.olive[500]}17` },
  activeBar: {
    position: "absolute", left: 0, top: 10, bottom: 10, width: 3,
    borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: gold,
  },
  sizeCell: { justifyContent: "center" },
  sizeText: { fontFamily: fontFamilies.display.regular, color: ink, fontSize: 18, letterSpacing: -0.2 },
  sizeTextActive: { fontFamily: fontFamilies.display.italic, color: colors.olive[700], fontSize: 20 },
  tdCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  cellText: {
    fontFamily: fontFamilies.mono.regular, color: colors.ink.soft, fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  cellTextActive: { color: colors.olive[800], fontFamily: fontFamilies.mono.semibold },
  footnote: { textAlign: "center", marginTop: -spacing[1.5], fontSize: 11 },

  // How to measure
  measureBody: { flexDirection: "row", gap: spacing[4], alignItems: "flex-start" },
  tipList: { flex: 1, gap: spacing[3.5] },
  tipItem: { flexDirection: "row", gap: spacing[2.5] },
  tipBadge: {
    width: 20, height: 20, borderRadius: 10, marginTop: 1,
    borderWidth: 1, borderColor: gold,
    alignItems: "center", justifyContent: "center",
  },
  tipNum: { fontSize: 9.5, color: colors.olive[800], fontFamily: fontFamilies.mono.semibold },
  tipLead: { fontFamily: fontFamilies.sans.semibold, color: ink, fontSize: 13 },
  tipBody: { lineHeight: 17, marginTop: 2 },
  proTip: {
    flexDirection: "row", alignItems: "center", gap: spacing[2],
    paddingHorizontal: spacing[3.5], paddingVertical: spacing[3],
    borderRadius: 14, backgroundColor: colors.light.muted,
  },
  proTipText: { flex: 1, color: colors.olive[800], lineHeight: 17 },
});
