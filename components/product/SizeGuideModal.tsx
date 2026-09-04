import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
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

export function SizeGuideModal({ visible, onClose, brandId, categoryId }: SizeGuideModalProps) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<MeasurementRow[]>(SIZE_DATA);

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
          chestIn: Math.round(chest / 2.54 * 10) / 10,
          waistIn: Math.round(waist / 2.54 * 10) / 10,
          hipIn: Math.round(hip / 2.54 * 10) / 10,
          lengthIn: Math.round(length / 2.54 * 10) / 10,
        };
      });
      if (mapped.length > 0) setRows(mapped);
    });
    return () => { cancelled = true; };
  }, [visible, brandId, categoryId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.dismissOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <View style={styles.titleRow}>
              <View>
                <Label style={styles.kicker}>ATELIER SIZING</Label>
                <Display size="xl" style={styles.title}>Size & Measurement Guide</Display>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>

            {/* Fit summary banner */}
            <View style={styles.fitBanner}>
              <Ionicons name="shirt-outline" size={16} color={colors.olive[600]} />
              <Body size="xs" style={styles.fitText}>
                <Body size="xs" style={styles.fitBold}>Fit: </Body>
                Tailored regular drape. Designed to fit true to size. If between sizes, choose the larger size for a relaxed silhouette.
              </Body>
            </View>

            {/* Unit toggle */}
            <View style={styles.unitToggleRow}>
              <Body size="xs" muted>Units of measurement:</Body>
              <View style={styles.togglePill}>
                <TouchableOpacity
                  style={[styles.toggleOption, unit === "cm" && styles.toggleOptionActive]}
                  onPress={() => setUnit("cm")}
                  activeOpacity={0.8}
                >
                  <Label style={[styles.toggleText, unit === "cm" && styles.toggleTextActive]}>
                    CM
                  </Label>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, unit === "in" && styles.toggleOptionActive]}
                  onPress={() => setUnit("in")}
                  activeOpacity={0.8}
                >
                  <Label style={[styles.toggleText, unit === "in" && styles.toggleTextActive]}>
                    INCHES
                  </Label>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Table */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.tableWrapper}>
              <View style={styles.tableHeader}>
                <Label style={[styles.th, styles.thSize]}>SIZE</Label>
                <Label style={styles.th}>CHEST</Label>
                <Label style={styles.th}>WAIST</Label>
                <Label style={styles.th}>HIPS</Label>
                <Label style={styles.th}>LENGTH</Label>
              </View>

              {rows.map((row, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <View
                    key={row.size}
                    style={[styles.tableRow, isEven && styles.tableRowEven]}
                  >
                    <View style={[styles.tdCell, styles.thSize]}>
                      <Label style={styles.sizeCellText}>{row.size}</Label>
                    </View>
                    <View style={styles.tdCell}>
                      <Body size="xs" style={styles.cellText}>
                        {unit === "cm" ? row.chestCm : row.chestIn}
                      </Body>
                    </View>
                    <View style={styles.tdCell}>
                      <Body size="xs" style={styles.cellText}>
                        {unit === "cm" ? row.waistCm : row.waistIn}
                      </Body>
                    </View>
                    <View style={styles.tdCell}>
                      <Body size="xs" style={styles.cellText}>
                        {unit === "cm" ? row.hipCm : row.hipIn}
                      </Body>
                    </View>
                    <View style={styles.tdCell}>
                      <Body size="xs" style={styles.cellText}>
                        {unit === "cm" ? row.lengthCm : row.lengthIn}
                      </Body>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* How to measure tips */}
            <View style={styles.measuringTips}>
              <Label style={styles.tipsTitle}>HOW TO MEASURE</Label>
              <View style={styles.tipItem}>
                <Body size="xs" style={styles.tipNum}>01</Body>
                <Body size="xs" muted style={styles.tipBody}>
                  <Body size="xs" style={styles.tipLead}>Chest / Bust: </Body>
                  Measure around the fullest part of your chest, keeping the tape horizontal.
                </Body>
              </View>
              <View style={styles.tipItem}>
                <Body size="xs" style={styles.tipNum}>02</Body>
                <Body size="xs" muted style={styles.tipBody}>
                  <Body size="xs" style={styles.tipLead}>Waist: </Body>
                  Measure around the narrowest part (typically above your hip bone).
                </Body>
              </View>
              <View style={styles.tipItem}>
                <Body size="xs" style={styles.tipNum}>03</Body>
                <Body size="xs" muted style={styles.tipBody}>
                  <Body size="xs" style={styles.tipLead}>Length: </Body>
                  Measure from the highest point of the shoulder down to the garment hem.
                </Body>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(22, 23, 15, 0.6)",
    justifyContent: "flex-end",
  },
  dismissOverlay: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    maxHeight: Dimensions.get("window").height * 0.85,
    borderWidth: 1,
    borderColor: `${colors.light.primary}18`,
    ...shadows.editorial,
  },
  sheetHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}10`,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginBottom: spacing[1],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  kicker: {
    color: colors.olive[600],
    fontSize: 10,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.light.primary}08`,
    alignItems: "center",
    justifyContent: "center",
  },
  fitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2.5],
    backgroundColor: `${colors.olive[500]}12`,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}25`,
  },
  fitText: {
    flex: 1,
    color: colors.light.foreground,
    lineHeight: 18,
  },
  fitBold: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.olive[700],
  },
  unitToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[1],
  },
  togglePill: {
    flexDirection: "row",
    backgroundColor: `${colors.light.primary}0A`,
    borderRadius: radii.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  toggleOption: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  toggleOptionActive: {
    backgroundColor: colors.light.primary,
  },
  toggleText: {
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
  },
  toggleTextActive: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.semibold,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[5],
  },
  tableWrapper: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.light.primary}15`,
    overflow: "hidden",
    backgroundColor: colors.light.card,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: `${colors.light.primary}08`,
    paddingVertical: 10,
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}12`,
  },
  th: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 1,
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.semibold,
  },
  thSize: {
    flex: 0.8,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing[2],
  },
  tableRowEven: {
    backgroundColor: `${colors.light.primary}03`,
  },
  tdCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeCellText: {
    fontSize: 11,
    fontFamily: fontFamilies.mono.semibold,
    color: colors.light.foreground,
  },
  cellText: {
    fontFamily: fontFamilies.mono.regular,
    color: colors.light.foreground,
    fontSize: 12,
  },
  measuringTips: {
    gap: spacing[2.5],
    padding: spacing[4],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.light.primary}12`,
  },
  tipsTitle: {
    fontSize: 10,
    color: colors.olive[600],
    letterSpacing: 1.5,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2.5],
  },
  tipNum: {
    fontFamily: fontFamilies.mono.semibold,
    color: colors.olive[600],
    fontSize: 11,
    marginTop: 1,
  },
  tipBody: {
    flex: 1,
    lineHeight: 18,
  },
  tipLead: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
});
