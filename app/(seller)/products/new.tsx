/**
 * Quick product upload (mobile seller) — one photo + price, AI fills the rest.
 * Route: (seller)/products/new — was a dead link in index.tsx (➕ button);
 * this screen IS the create flow default.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pickImage, takePhoto } from "@/lib/upload";
import { quickAnalyzeProduct } from "@/lib/api";

export const QUICK_AI_DRAFT_STORAGE_KEY = "luxe:mobile-quick-ai-draft";
/** Mirrors the backend vision download cap (glm-vision.ts). */
const VISION_MAX_BYTES = 4 * 1024 * 1024;
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";

const INK = colors.olive[950];
const CREAM = colors.paper.cream;
const GOLD = colors.accent2.ochre;
const RUST = colors.accent2.rust;
const PLACEHOLDER = "rgba(101,104,77,0.45)";

const AI_FIELDS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Name", icon: "text-outline" },
  { label: "Description", icon: "document-text-outline" },
  { label: "Category", icon: "albums-outline" },
  { label: "Tags", icon: "pricetags-outline" },
];

/** Display-only thousands grouping; state stays raw digits. */
function groupDigits(raw: string) {
  return raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
}

export default function QuickCreateScreen() {
  const insets = useSafeAreaInsets();
  const priceRef = useRef<TextInput>(null);
  const mrpRef = useRef<TextInput>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [nameOverride, setNameOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async (source: "camera" | "library") => {
    const picker = source === "camera" ? takePhoto : pickImage;
    // 0.7 keeps high-MP camera shots under the backend vision 4 MB cap.
    const result = await picker({ allowsEditing: true, aspect: [3, 4], quality: 0.7 });
    if (!result || result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > VISION_MAX_BYTES) {
      Alert.alert("Photo too large", "The AI can read photos up to 4 MB. Crop tighter or pick a smaller photo.");
      return;
    }
    setPreview(asset.uri);
    setMimeType(asset.mimeType ?? null);
  }, []);

  const submit = useCallback(async () => {
    const priceNum = Number(price);
    if (!preview) { Alert.alert("Add a photo", "The AI reads everything from the image."); return; }
    if (!priceNum || priceNum <= 0) { Alert.alert("Add a price", "Selling price is required."); return; }
    if (mrp && Number(mrp) < priceNum) { Alert.alert("MRP below price", "MRP must be greater than or equal to the price."); return; }

    setBusy(true);
    try {
      // Analyze-only: extract details, then hand off to the full product-add
      // editor prefilled so the seller reviews/edits before anything is created.
      const res = await quickAnalyzeProduct({
        uri: preview,
        price: Math.round(priceNum),
        ...(mrp ? { mrp: Math.round(Number(mrp)) } : {}),
        ...(nameOverride.trim() ? { name: nameOverride.trim() } : {}),
        mimeType,
      });
      if (!res.ok) throw new Error(res.error);
      const payload = {
        ...res.data.draft,
        // Keep the local URI so the editor can show + upload the exact photo
        // the seller picked (remote URL is vision-only, not reused for save).
        localUri: preview,
        localMimeType: mimeType,
        price: res.data.draft.price ?? Math.round(priceNum),
        mrp: res.data.draft.mrp ?? (mrp ? Math.round(Number(mrp)) : null),
        name: nameOverride.trim() || res.data.draft.name,
        extraction: res.data.extraction,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(QUICK_AI_DRAFT_STORAGE_KEY, JSON.stringify(payload));
      const f = res.data.extraction;
      const filled = [
        f.name_source === "ai" || nameOverride.trim() ? "Name" : null,
        f.description_source === "ai" ? "Description" : null,
        f.category_match && f.category_match !== "none" ? "Category" : null,
        "Tags",
      ].filter(Boolean).join(", ");
      if (f.vision_error === "unconfigured") {
        Alert.alert("AI vision is not configured", "The server is missing its AI keys, so nothing was extracted. Your photo and price are carried over — fill the rest manually.");
      } else if (f.vision_error) {
        Alert.alert("AI couldn't read this photo", `Reason: ${f.vision_error}. Your photo and price are carried over — use a clear JPG/PNG under 4 MB.`);
      } else {
        Alert.alert("AI draft ready", filled ? `AI filled: ${filled}. Review and publish.` : "Review the details and publish.");
      }
      router.push("/(seller)/products/create" as never);
    } catch (e) {
      Alert.alert("Analyze failed", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [preview, price, mrp, nameOverride, mimeType]);

  const priceNum = Number(price) || 0;
  const mrpNum = Number(mrp) || 0;
  const discount = priceNum > 0 && mrpNum > priceNum ? Math.round((1 - priceNum / mrpNum) * 100) : 0;
  const mrpInvalid = mrpNum > 0 && priceNum > 0 && mrpNum < priceNum;
  const ready = Boolean(preview) && priceNum > 0;
  const missing = !preview ? "Add a photo to continue" : priceNum <= 0 ? "Add a selling price to continue" : null;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(seller)/products" as never);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={INK} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text style={styles.topKicker}>New product</Text>
            <Text style={styles.topTitle}>Quick upload</Text>
          </View>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={11} color={GOLD} />
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hero}>
            One photo.{"\n"}
            <Text style={styles.heroItalic}>One price. </Text>
            Done.
          </Text>
          <Text style={styles.heroSub}>
            The AI names it, tags it, writes the description and matches the category. Edit anything after.
          </Text>

          <View style={styles.modeSwitch}>
            <View style={[styles.modeOption, styles.modeOptionOn]}>
              <Ionicons name="sparkles" size={13} color={GOLD} />
              <Text style={[styles.modeText, styles.modeTextOn]}>Quick with AI</Text>
            </View>
            <TouchableOpacity
              style={styles.modeOption}
              onPress={() => router.replace("/(seller)/products/create" as never)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Add product manually with the full editor"
            >
              <Ionicons name="create-outline" size={14} color={colors.ink.soft} />
              <Text style={styles.modeText}>Fill in manually</Text>
            </TouchableOpacity>
          </View>

          {/* 01 — Photo */}
          <StepLabel n="01" label="Photo" done={Boolean(preview)} />
          {preview ? (
            <View style={styles.stage}>
              <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(22,26,10,0)", "rgba(22,26,10,0.65)"]}
                style={styles.stageShade}
              />
              <TouchableOpacity
                style={styles.stageClose}
                onPress={() => setPreview(null)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Ionicons name="close" size={16} color={INK} />
              </TouchableOpacity>
              <View style={styles.stageFooter}>
                <View style={styles.stageReady}>
                  <View style={styles.stageReadyDot} />
                  <Text style={styles.stageReadyText}>{busy ? "Reading image…" : "Ready for AI"}</Text>
                </View>
                {!busy ? (
                  <View style={styles.stageSwap}>
                    <TouchableOpacity
                      style={styles.stageSwapBtn}
                      onPress={() => void pick("camera")}
                      accessibilityRole="button"
                      accessibilityLabel="Retake photo"
                    >
                      <Ionicons name="camera-outline" size={15} color={CREAM} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stageSwapBtn}
                      onPress={() => void pick("library")}
                      accessibilityRole="button"
                      accessibilityLabel="Choose another photo"
                    >
                      <Ionicons name="images-outline" size={15} color={CREAM} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
              {busy ? (
                <View style={styles.stageBusy}>
                  <ActivityIndicator color={CREAM} />
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.dropZone}>
              <View style={styles.dropHalo}>
                <View style={styles.dropCore}>
                  <Ionicons name="scan-outline" size={24} color={GOLD} />
                </View>
              </View>
              <Text style={styles.dropTitle}>Add the hero shot</Text>
              <Text style={styles.dropHint}>Plain background, soft light, the whole piece in frame.</Text>
              <View style={styles.pickerRow}>
                <TouchableOpacity
                  style={[styles.pickBtn, styles.pickPrimary]}
                  onPress={() => void pick("camera")}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Ionicons name="camera-outline" size={18} color={CREAM} />
                  <Text style={styles.pickPrimaryText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={() => void pick("library")}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Ionicons name="images-outline" size={18} color={INK} />
                  <Text style={styles.pickBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 02 — Price */}
          <StepLabel n="02" label="Price" done={priceNum > 0 && !mrpInvalid} />
          <View style={styles.card}>
            <View style={styles.priceRow}>
              <Pressable style={styles.priceCol} onPress={() => priceRef.current?.focus()}>
                <Text style={styles.fieldLabel}>Selling price</Text>
                <View style={styles.moneyInput}>
                  <Text style={styles.currency}>LKR</Text>
                  <TextInput
                    style={styles.moneyText}
                    value={groupDigits(price)}
                    onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="3,000"
                    placeholderTextColor={PLACEHOLDER}
                    accessibilityLabel="Selling price in LKR"
                    ref={priceRef}
                    returnKeyType="next"
                  />
                </View>
              </Pressable>
              <View style={styles.priceDivider} />
              <Pressable style={styles.priceCol} onPress={() => mrpRef.current?.focus()}>
                <Text style={styles.fieldLabel}>MRP · optional</Text>
                <View style={styles.moneyInput}>
                  <Text style={styles.currency}>LKR</Text>
                  <TextInput
                    style={[styles.moneyText, styles.moneyTextMuted]}
                    value={groupDigits(mrp)}
                    onChangeText={(t) => setMrp(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="4,000"
                    placeholderTextColor={PLACEHOLDER}
                    accessibilityLabel="MRP in LKR"
                    ref={mrpRef}
                  />
                </View>
              </Pressable>
            </View>
            {discount > 0 || mrpInvalid ? (
              <View style={[styles.priceNote, mrpInvalid && styles.priceNoteWarn]}>
                <Ionicons
                  name={mrpInvalid ? "alert-circle-outline" : "pricetag"}
                  size={13}
                  color={mrpInvalid ? RUST : colors.olive[700]}
                />
                <Text style={[styles.priceNoteText, mrpInvalid && { color: RUST }]}>
                  {mrpInvalid
                    ? "MRP should be at least the selling price"
                    : `Shoppers see ${discount}% off · save ${formatPrice(mrpNum - priceNum)}`}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 03 — Name */}
          <StepLabel n="03" label="Name" optional done={nameOverride.trim().length > 0} />
          <View style={styles.card}>
            <TextInput
              style={styles.nameInput}
              value={nameOverride}
              onChangeText={setNameOverride}
              placeholder="Leave blank and the AI will name it"
              placeholderTextColor={PLACEHOLDER}
              maxLength={200}
              accessibilityLabel="Product name, optional"
            />
          </View>

          <View style={styles.aiFills}>
            <Text style={styles.aiFillsLabel}>The AI fills in</Text>
            <View style={styles.aiChips}>
              {AI_FIELDS.map((f) => (
                <View key={f.label} style={styles.aiChip}>
                  <Ionicons name={f.icon} size={12} color={colors.olive[700]} />
                  <Text style={styles.aiChipText}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submit, !ready && styles.submitDisabled]}
            disabled={busy || !ready}
            onPress={() => void submit()}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Analyze with AI and review details"
          >
            <View style={[styles.submitIcon, !ready && styles.submitIconDisabled]}>
              {busy ? (
                <ActivityIndicator size="small" color={INK} />
              ) : (
                <Ionicons name="sparkles" size={15} color={ready ? INK : colors.ink.mute} />
              )}
            </View>
            <Text style={[styles.submitText, !ready && styles.submitTextDisabled]}>
              {busy ? "Reading image…" : "Analyze with AI"}
            </Text>
            {!busy && ready ? <Ionicons name="arrow-forward" size={16} color={CREAM} /> : null}
          </TouchableOpacity>
          <Text style={styles.footerHint}>{missing ?? "Takes about 10 seconds · review everything on the next screen"}</Text>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function StepLabel({ n, label, optional, done }: { n: string; label: string; optional?: boolean; done?: boolean }) {
  return (
    <View style={styles.stepLabel}>
      <Text style={styles.stepNum}>{n}</Text>
      <Text style={styles.stepText}>{label}</Text>
      {optional ? <Text style={styles.stepOptional}>optional</Text> : null}
      <View style={styles.stepRule} />
      {done ? (
        <View style={styles.stepDone}>
          <Ionicons name="checkmark" size={11} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: "#161a0a",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper.DEFAULT },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingBottom: 10,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  topBarCenter: { flex: 1, alignItems: "center" },
  topKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  topTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: INK, marginTop: 1 },
  aiBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.olive[900],
  },
  aiBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: GOLD },

  scroll: { paddingHorizontal: spacing[5], paddingTop: 10, paddingBottom: 28 },
  hero: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: INK,
  },
  heroItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink.mute,
    marginTop: 10,
    maxWidth: 330,
  },

  modeSwitch: {
    flexDirection: "row",
    marginTop: 20,
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: "#FFFFFF",
    shadowColor: "#161a0a",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  modeOption: {
    flex: 1,
    height: 40,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modeOptionOn: { backgroundColor: INK },
  modeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.ink.soft },
  modeTextOn: { color: CREAM, fontFamily: fontFamilies.sans.bold },

  stepLabel: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 26, marginBottom: 10 },
  stepNum: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 1.2, color: GOLD },
  stepText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: INK,
  },
  stepOptional: { fontFamily: fontFamilies.display.italic, fontSize: 12, color: colors.ink.mute },
  stepRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.25)" },
  stepDone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#5f9a4a",
    alignItems: "center",
    justifyContent: "center",
  },

  // Photo — empty
  dropZone: {
    alignItems: "center",
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(200,164,74,0.55)",
  },
  dropHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(200,164,74,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  dropCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  dropTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: INK,
    marginTop: 14,
  },
  dropHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink.mute,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 240,
  },
  pickerRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 20 },
  pickBtn: {
    flex: 1,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  pickPrimary: { backgroundColor: INK },
  pickPrimaryText: { color: CREAM, fontFamily: fontFamilies.sans.bold, fontSize: 14 },
  pickBtnText: { color: INK, fontFamily: fontFamilies.sans.bold, fontSize: 14 },

  // Photo — preview
  stage: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
  },
  stageShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" },
  stageClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(250,248,241,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageFooter: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stageReady: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.92)",
  },
  stageReadyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5f9a4a" },
  stageReadyText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: INK },
  stageSwap: { flexDirection: "row", gap: 8 },
  stageSwapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(22,26,10,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageBusy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22,26,10,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Cards + fields
  card: { backgroundColor: "#FFFFFF", borderRadius: 22, ...CARD_SHADOW },
  priceRow: { flexDirection: "row" },
  priceCol: { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  priceDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.2)", marginVertical: 14 },
  fieldLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.ink.mute,
  },
  moneyInput: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
  currency: { fontFamily: fontFamilies.mono.medium, fontSize: 11, letterSpacing: 1, color: colors.ink.mute },
  moneyText: {
    flex: 1,
    paddingVertical: 2,
    fontFamily: fontFamilies.display.regular,
    fontSize: 28,
    letterSpacing: -0.6,
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  moneyTextMuted: { color: colors.ink.soft },
  priceNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
  },
  priceNoteWarn: { backgroundColor: "rgba(184,92,58,0.1)" },
  priceNoteText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
  nameInput: {
    height: 56,
    paddingHorizontal: 16,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: INK,
  },

  aiFills: { marginTop: 22 },
  aiFillsLabel: { fontFamily: fontFamilies.display.italic, fontSize: 13, color: colors.ink.mute, marginBottom: 8 },
  aiChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.08)",
  },
  aiChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: colors.olive[800] },

  // Footer CTA
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.paper.DEFAULT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.15)",
  },
  submit: {
    height: 56,
    borderRadius: radii.full,
    backgroundColor: INK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#161a0a",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  submitDisabled: { backgroundColor: colors.paper.warm, shadowOpacity: 0, elevation: 0 },
  submitIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  submitIconDisabled: { backgroundColor: "rgba(83,94,44,0.1)" },
  submitText: { color: CREAM, fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: 0.2 },
  submitTextDisabled: { color: colors.ink.mute },
  footerHint: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.ink.mute,
  },
});
