import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import type { SellerInventoryRow } from "@/lib/seller-inventory";
import { sellerStatus } from "@/lib/seller-inventory";
import { parseStockInput } from "@/lib/brand-inventory";
import { toneMeta } from "./SellerStockCard";
import { SELLER_CREAM, SELLER_INK, sellerBorder, sellerBorderStrong } from "./chrome";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  visible: boolean;
  row: SellerInventoryRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (nextOnHand: number) => void;
}

export function SellerStockSheet({ visible, row, saving, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = React.useState("");
  const rowVariantId = row?.variantId;
  const rowOnHand = row?.onHand;

  React.useEffect(() => {
    if (rowVariantId) {
      setText(String(rowOnHand ?? 0));
    }
  }, [rowOnHand, rowVariantId]);

  const parsed = parseStockInput(text);
  const valid = parsed !== null;
  const onHandNow = row?.onHand ?? 0;
  const reservedNow = row?.reserved ?? 0;
  const heldBreach = row && parsed !== null && parsed < reservedNow;
  const nextAvailable = parsed === null ? null : Math.max(0, parsed - reservedNow);

  const status = sellerStatus(nextAvailable);
  const meta = toneMeta(status);

  const delta = parsed !== null ? parsed - onHandNow : 0;
  const hasChanged = valid && parsed !== onHandNow;

  const variantLabel =
    [row?.size ? `Size ${row.size}` : null, row?.color].filter(Boolean).join(" · ") || null;

  const handleStep = (step: number) => {
    const current = parsed ?? 0;
    const next = Math.max(0, Math.min(9999, current + step));
    setText(String(next));
  };

  const handleAdd = (qty: number) => {
    const current = parsed ?? 0;
    const next = Math.min(9999, current + qty);
    setText(String(next));
  };

  const handleSetZero = () => {
    setText("0");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={saving ? undefined : onClose}
    >
      <View style={styles.backdropOverlay}>
        <Pressable
          style={styles.scrim}
          onPress={saving ? undefined : onClose}
          accessibilityLabel="Dismiss sheet"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Product Header */}
              <View style={styles.header}>
                {row?.image ? (
                  <Image
                    source={{ uri: row.image }}
                    style={styles.productThumb}
                    contentFit="cover"
                    transition={150}
                  />
                ) : null}

                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>Update stock</Text>
                  <Text style={styles.title} numberOfLines={2}>
                    {row?.productName ?? "Update stock"}
                  </Text>
                  <View style={styles.skuRow}>
                    <Text style={styles.skuText} numberOfLines={1}>
                      {row?.sku ?? "SKU unavailable"}
                    </Text>
                    {variantLabel ? (
                      <>
                        <Text style={styles.skuDot}>•</Text>
                        <Text style={styles.variantText} numberOfLines={1}>
                          {variantLabel}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>

                <Pressable
                  style={styles.closeButton}
                  onPress={onClose}
                  disabled={saving}
                  hitSlop={8}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={18} color={colors.olive[800]} />
                </Pressable>
              </View>

              {/* Summary Stats Pill */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>On Hand</Text>
                  <Text style={styles.summaryValue}>{row?.onHand ?? 0}</Text>
                </View>
                <View style={styles.summaryRule} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Held</Text>
                  <Text style={styles.summaryValue}>{reservedNow}</Text>
                </View>
                <View style={styles.summaryRule} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Available</Text>
                  <Text style={[styles.summaryValue, { color: meta.color }]}>
                    {nextAvailable ?? "—"}
                  </Text>
                  <Text style={[styles.statusTag, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>

              {/* Edit Card */}
              <View style={styles.formCard}>
                <View style={styles.cardHeadingRow}>
                  <Text style={styles.sectionTitle}>Set on-hand quantity</Text>
                  {hasChanged ? (
                    <View
                      style={[
                        styles.deltaBadge,
                        delta > 0 ? styles.deltaPositive : styles.deltaNegative,
                      ]}
                    >
                      <Ionicons
                        name={delta > 0 ? "arrow-up" : "arrow-down"}
                        size={11}
                        color={delta > 0 ? colors.olive[800] : colors.accent2.rust}
                      />
                      <Text
                        style={[
                          styles.deltaText,
                          delta > 0 ? styles.deltaTextPositive : styles.deltaTextNegative,
                        ]}
                      >
                        {delta > 0 ? `+${delta}` : delta} units
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.sectionHint}>
                  Enter the exact physical stock currently available in your store.
                </Text>

                {/* Primary Stepper + Input Box */}
                <View style={styles.stepperContainer}>
                  <Pressable
                    onPress={() => handleStep(-1)}
                    disabled={(parsed ?? 0) <= 0 || saving}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      pressed && styles.stepBtnPressed,
                      (parsed ?? 0) <= 0 && styles.stepBtnDisabled,
                    ]}
                    accessibilityLabel="Decrease quantity by 1"
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={(parsed ?? 0) <= 0 ? colors.ink.mute : colors.olive[900]}
                    />
                  </Pressable>

                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.numericInput}
                      keyboardType="number-pad"
                      value={text}
                      onChangeText={setText}
                      selectTextOnFocus
                      maxLength={5}
                      placeholder="0"
                      placeholderTextColor={colors.ink.mute}
                      accessibilityLabel="On hand quantity"
                    />
                    <Text style={styles.unitLabel}>units</Text>
                  </View>

                  <Pressable
                    onPress={() => handleStep(1)}
                    disabled={(parsed ?? 0) >= 9999 || saving}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      pressed && styles.stepBtnPressed,
                      (parsed ?? 0) >= 9999 && styles.stepBtnDisabled,
                    ]}
                    accessibilityLabel="Increase quantity by 1"
                  >
                    <Ionicons name="add" size={20} color={colors.olive[900]} />
                  </Pressable>
                </View>

                {text.length > 0 && !valid ? (
                  <Text style={styles.errorText}>Enter a valid quantity from 0 to 9999</Text>
                ) : null}

                {/* Quick Additions */}
                <Text style={styles.quickLabel}>Quick Add</Text>
                <View style={styles.presets}>
                  {[5, 10, 20].map((amount) => (
                    <Pressable
                      key={amount}
                      onPress={() => handleAdd(amount)}
                      disabled={saving}
                      style={({ pressed }) => [styles.preset, pressed && styles.presetPressed]}
                    >
                      <Ionicons name="add" size={13} color={colors.olive[800]} />
                      <Text style={styles.presetText}>{amount}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={handleSetZero}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.preset,
                      styles.zeroPreset,
                      pressed && styles.presetPressed,
                    ]}
                  >
                    <Ionicons name="close-outline" size={14} color={colors.accent2.rust} />
                    <Text style={[styles.presetText, styles.zeroPresetText]}>Out</Text>
                  </Pressable>
                </View>

                {heldBreach ? (
                  <View style={styles.warning}>
                    <Ionicons name="alert-circle-outline" size={16} color="#8a6a2a" />
                    <Text style={styles.warn}>
                      {reservedNow} units are currently held in customer carts or orders. Setting on-hand to {parsed} leaves 0 available.
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.btnPressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!valid || saving || !hasChanged}
                onPress={() => parsed !== null && onSave(parsed)}
                style={({ pressed }) => [
                  styles.button,
                  styles.save,
                  (!valid || saving || !hasChanged) && styles.disabled,
                  pressed && styles.btnPressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.paper.cream} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={17}
                      color={colors.paper.cream}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.saveText}>Save stock</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropOverlay: {
    flex: 1,
    backgroundColor: "rgba(18, 19, 13, 0.52)",
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardWrap: {
    width: "100%",
  },
  sheet: {
    width: "100%",
    backgroundColor: SELLER_CREAM,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: sellerBorder,
    paddingHorizontal: spacing[5],
    paddingTop: 8,
    maxHeight: "92%",
    ...shadows.editorial,
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 6,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(83,94,44,0.22)",
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.olive[100],
    borderWidth: 1,
    borderColor: sellerBorder,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    lineHeight: 25,
    color: SELLER_INK,
  },
  skuRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 5,
  },
  skuText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  skuDot: {
    fontSize: 10,
    color: colors.ink.mute,
  },
  variantText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.olive[800],
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: sellerBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161710",
    borderRadius: 20,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    ...shadows.soft,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  summaryRule: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: "rgba(250,248,241,0.14)",
  },
  summaryLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.9,
    color: "#A29E92",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    lineHeight: 26,
    color: "#FAF8F1",
    fontVariant: ["tabular-nums"],
  },
  statusTag: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: sellerBorder,
    borderRadius: 20,
    padding: 16,
    ...shadows.soft,
  },
  cardHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: SELLER_INK,
  },
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  deltaPositive: {
    backgroundColor: "rgba(83,94,44,0.12)",
  },
  deltaNegative: {
    backgroundColor: "rgba(184,92,58,0.1)",
  },
  deltaText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  deltaTextPositive: {
    color: colors.olive[800],
  },
  deltaTextNegative: {
    color: colors.accent2.rust,
  },
  sectionHint: {
    marginTop: 3,
    marginBottom: 14,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: SELLER_CREAM,
    borderWidth: 1,
    borderColor: sellerBorderStrong,
    borderRadius: radii.xl,
    padding: 6,
    gap: 8,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: sellerBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPressed: {
    opacity: 0.7,
    backgroundColor: colors.olive[50],
  },
  stepBtnDisabled: {
    opacity: 0.35,
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },
  numericInput: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: SELLER_INK,
    textAlign: "center",
    paddingVertical: 4,
    minWidth: 60,
  },
  unitLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 12,
    color: colors.ink.mute,
  },
  errorText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.accent2.rust,
    marginTop: 6,
    textAlign: "center",
  },
  quickLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.ink.mute,
    textTransform: "uppercase",
  },
  presets: {
    flexDirection: "row",
    gap: 8,
  },
  preset: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: sellerBorder,
    borderRadius: radii.full,
    backgroundColor: SELLER_CREAM,
  },
  presetPressed: {
    opacity: 0.75,
  },
  presetText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[900],
  },
  zeroPreset: {
    flex: 1.2,
    backgroundColor: "rgba(184,92,58,0.07)",
    borderColor: "rgba(184,92,58,0.22)",
  },
  zeroPresetText: {
    color: colors.accent2.rust,
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(200,164,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.24)",
  },
  warn: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 15,
    color: "#8a6a2a",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 14,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.85,
  },
  cancel: {
    borderWidth: 1,
    borderColor: sellerBorderStrong,
    backgroundColor: "#FFFFFF",
  },
  cancelText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  save: {
    backgroundColor: SELLER_INK,
  },
  saveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.paper.cream,
  },
  disabled: {
    opacity: 0.4,
  },
});
