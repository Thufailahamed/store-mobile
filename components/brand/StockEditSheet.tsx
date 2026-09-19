import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type KeyboardTypeOptions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { getAvailable, parseStockInput, getStatus } from "@/lib/brand-inventory";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { colors, radii, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  visible: boolean;
  row: BrandInventoryRow | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (nextAvailable: number) => void;
}

const QUICK_SETS: readonly { value: number; label: string; tone: "neutral" | "danger" }[] = [
  { value: 5, label: "+5", tone: "neutral" },
  { value: 10, label: "+10", tone: "neutral" },
  { value: 20, label: "+20", tone: "neutral" },
  { value: 0, label: "× Out", tone: "danger" },
];

export function StockEditSheet({ visible, row, saving, error, onClose, onSave }: Props) {
  const [text, setText] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  // Reset input when a different row is opened. Keying on row?.id avoids
  // resetting on every render of the row reference.
  const rowId = row?.id;
  React.useEffect(() => {
    if (row) setText(String(getAvailable(row)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId]);

  const parsed = parseStockInput(text);
  const valid = parsed !== null;
  const next = parsed ?? 0;

  const currentQty = row?.inventory?.quantity ?? 0;
  const reserved = Math.max(0, row?.inventory?.reserved ?? 0);
  const availableNow = row ? getAvailable(row) : 0;
  const statusNow = getStatus(availableNow);

  // Status of the *new* value (what we'd save).
  const statusNext =
    next <= 0 ? "out" : next <= LOW_STOCK_THRESHOLD ? "low" : "healthy";

  const valueChanged = next !== availableNow;
  const canSave = valid && valueChanged && !saving;

  // Map status → rust/ochre/cream.
  const accentFor = (status: "out" | "low" | "healthy") =>
    status === "out" ? colors.accent2.rust : status === "low" ? colors.accent2.ochre : colors.light.primaryForeground;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        {/* SafeAreaView for horizontal insets — prevents content from touching screen edges */}
        <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kbAvoid}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={styles.eyebrow} numberOfLines={1}>UPDATE STOCK</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {row?.product?.name ?? "Update stock"}
                </Text>
                <Text style={styles.sku} numberOfLines={1}>
                  {row?.sku ?? "—"}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.olive[800]} />
              </Pressable>
            </View>

            {/* Stats bar */}
            <View style={styles.statsBar}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel} numberOfLines={1}>Current</Text>
                <Text style={[styles.statValue, { color: colors.light.primaryForeground }]}>{currentQty}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statCol}>
                <Text style={styles.statLabel} numberOfLines={1}>Held</Text>
                <Text style={[styles.statValue, { color: colors.light.primaryForeground }]}>{reserved}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statCol}>
                <Text style={styles.statLabel} numberOfLines={1}>Available</Text>
                <Text style={[styles.statValue, { color: accentFor(statusNow) }]}>{availableNow}</Text>
                <Text style={styles.statHint} numberOfLines={1}>
                  {statusNow === "out" ? "Out of stock" : statusNow === "low" ? `≤ ${LOW_STOCK_THRESHOLD} left` : "In stock"}
                </Text>
              </View>
            </View>

            {/* Panel: Set on-hand quantity */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Set on-hand quantity</Text>
              <Text style={styles.panelDesc}>
                Enter the exact physical stock currently in your store.
              </Text>

              <Text style={styles.fieldLabel}>ON-HAND STOCK</Text>
              <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  keyboardType={Platform.OS === "ios" ? ("numberPad" as KeyboardTypeOptions) : "numeric"}
                  selectTextOnFocus
                  style={styles.input}
                  selectionColor={colors.olive[700]}
                  placeholder="0"
                  placeholderTextColor={colors.ink.mute}
                  maxLength={4}
                  accessibilityLabel="On-hand stock quantity"
                />
                <Text style={styles.inputUnit}>units</Text>
              </View>

              {text.length > 0 && !valid ? (
                <Text style={styles.fieldError}>Enter a whole number between 0 and 9999.</Text>
              ) : null}

              {/* Live preview row */}
              {valid && valueChanged ? (
                <View style={styles.preview}>
                  <Ionicons
                    name={
                      statusNext === "out"
                        ? "alert-circle"
                        : statusNext === "low"
                        ? "warning-outline"
                        : "checkmark-circle-outline"
                    }
                    size={14}
                    color={accentFor(statusNext)}
                  />
                  <Text style={[styles.previewText, { color: accentFor(statusNext) }]}>
                    New available: {next} ·{" "}
                    {statusNext === "out"
                      ? "out of stock"
                      : statusNext === "low"
                      ? "low stock"
                      : "healthy"}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>QUICK SET</Text>
              <View style={styles.quickRow}>
                {QUICK_SETS.map((q) => {
                  const active = next === q.value;
                  return (
                    <Pressable
                      key={q.label}
                      onPress={() => setText(String(q.value))}
                      style={[
                        styles.quick,
                        q.tone === "danger"
                          ? styles.quickDanger
                          : styles.quickNeutral,
                        active && (q.tone === "danger" ? styles.quickDangerActive : styles.quickNeutralActive),
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={[
                          styles.quickText,
                          q.tone === "danger"
                            ? styles.quickTextDanger
                            : styles.quickTextNeutral,
                          active &&
                            (q.tone === "danger"
                              ? styles.quickTextDangerActive
                              : styles.quickTextNeutralActive),
                        ]}
                      >
                        {q.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* API error */}
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.light.destructive} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Footer actions (sticky) */}
        <SafeAreaView style={styles.footerSafe} edges={["left", "right", "bottom"]}>
        <View style={[styles.footer, { paddingBottom: 16 }]}>
          <Pressable
            onPress={onClose}
            disabled={saving}
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && { opacity: 0.7 },
              saving && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={!canSave}
            onPress={() => parsed !== null && onSave(parsed)}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
              !canSave && { opacity: 0.45 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save stock"
          >
            <Ionicons name="checkmark" size={18} color={colors.light.primaryForeground} />
            <Text
              style={styles.saveText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {saving ? "Saving…" : "Save stock"}
            </Text>
          </Pressable>
        </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.light.background,
  },

  // Drag handle
  handleWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
  },

  kbAvoid: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingTop: 4,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 20, // EXPLICIT margin
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.olive[700],
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: 32,
  },
  sku: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 12,
    color: colors.ink.mute,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  // Stats bar
  statsBar: {
    flexDirection: "row",
    marginHorizontal: 16, // EXPLICIT margin — belt and braces
    marginBottom: 18,
    backgroundColor: colors.olive[950],
    borderRadius: radii["2xl"],
    paddingVertical: 16,
    paddingHorizontal: 6,
    overflow: "hidden",
    ...shadows.soft,
  },
  statCol: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: "rgba(245,244,239,0.55)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 30,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: 34,
    textAlign: "center",
  },
  statHint: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    color: "rgba(245,244,239,0.45)",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(245,244,239,0.15)",
    marginHorizontal: 2,
  },

  // Panel
  panel: {
    marginHorizontal: 16, // EXPLICIT margin — belt and braces
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 20,
    gap: 10,
    overflow: "hidden",
  },
  panelTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  panelDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
    lineHeight: 20,
    marginBottom: 6,
  },

  // Input
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[700],
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 18,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    gap: 12,
  },
  inputShellFocused: {
    borderColor: colors.olive[700],
    backgroundColor: colors.light.card,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    letterSpacing: typography.letterSpacing.tight,
    paddingVertical: 0,
  },
  inputUnit: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  fieldError: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.destructive,
    marginTop: -2,
  },

  // Preview chip
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  previewText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    letterSpacing: 0.2,
  },

  // Quick set
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  quick: {
    flex: 1, // distribute evenly so they never overflow the panel
    minWidth: 0,
    height: 44,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickNeutral: {
    backgroundColor: colors.light.background,
    borderColor: colors.light.border,
  },
  quickNeutralActive: {
    backgroundColor: colors.olive[50],
    borderColor: colors.olive[700],
  },
  quickDanger: {
    backgroundColor: "rgba(184,92,58,0.08)",
    borderColor: "rgba(184,92,58,0.35)",
  },
  quickDangerActive: {
    backgroundColor: colors.accent2.rust,
    borderColor: colors.accent2.rust,
  },
  quickText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  quickTextNeutral: { color: colors.olive[800] },
  quickTextNeutralActive: { color: colors.olive[800] },
  quickTextDanger: { color: colors.accent2.rust },
  quickTextDangerActive: { color: "#fff" },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16, // EXPLICIT margin
    marginTop: 14,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: "rgba(192,57,43,0.08)",
    borderWidth: 1,
    borderColor: "rgba(192,57,43,0.25)",
    overflow: "hidden",
  },
  errorBannerText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.destructive,
  },

  // Footer
  footerSafe: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  cancelBtn: {
    flex: 1,
    minWidth: 0,
    height: 56,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.olive[800],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  saveBtn: {
    flex: 1.4,
    minWidth: 0,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
    ...shadows.glow,
  },
  saveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.primaryForeground,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
});
