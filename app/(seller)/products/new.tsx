/**
 * Quick product upload (mobile seller) — one photo + price, AI fills the rest.
 * Route: (seller)/products/new — was a dead link in index.tsx (➕ button);
 * this screen IS the create flow default.
 */
import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { pickImage, takePhoto } from "@/lib/upload";
import { quickCreateProduct } from "@/lib/api";
import { radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Body, Display, Label } from "@/components/ui/Typography";
import { PaperBackground, ScreenHeader } from "@/components/layout";

const INK = "#1b1c1c";
const CREAM = "#f0eddf";

export default function QuickCreateScreen() {
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [nameOverride, setNameOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async (source: "camera" | "library") => {
    const picker = source === "camera" ? takePhoto : pickImage;
    const result = await picker({ allowsEditing: true, aspect: [3, 4], quality: 0.85 });
    if (!result || result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
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
      const res = await quickCreateProduct({
        uri: preview,
        price: Math.round(priceNum),
        ...(mrp ? { mrp: Math.round(Number(mrp)) } : {}),
        ...(nameOverride.trim() ? { name: nameOverride.trim() } : {}),
        mimeType,
      });
      if (!res.ok) throw new Error(res.error);
      const f = res.data.extraction;
      const filled = [
        f.name_source === "ai" ? "Name" : null,
        f.description_source === "ai" ? "Description" : null,
        f.category_match && f.category_match !== "none" ? "Category" : null,
        "Tags",
      ].filter(Boolean).join(", ");
      Alert.alert("Product created", filled ? `AI filled: ${filled}.` : undefined);
      router.replace(`/(seller)/products/${res.data.product.id}` as never);
    } catch (e) {
      Alert.alert("Create failed", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [preview, price, mrp, nameOverride, mimeType]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaperBackground>
        <ScreenHeader title="Quick upload" />
        <View style={styles.wrap}>
          <Display size="md">Drop one photo.{"\n"}Type a price. Done.</Display>
          <Body muted style={styles.copy}>
            The AI names it, tags it, writes the description and matches the category. Edit anything after.
          </Body>

          {preview ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
              <TouchableOpacity style={styles.removeBtn} onPress={() => setPreview(null)} accessibilityLabel="Remove photo">
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerRow}>
              <TouchableOpacity style={[styles.pickBtn, styles.pickPrimary]} onPress={() => void pick("camera")}>
                <Ionicons name="camera-outline" size={20} color={CREAM} />
                <Label style={styles.pickPrimaryText}>Camera</Label>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={() => void pick("library")}>
                <Ionicons name="images-outline" size={20} color={INK} />
                <Label style={styles.pickBtnText}>Gallery</Label>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.fieldRow}>
            <View style={[styles.field, styles.fieldGrow]}>
              <Label style={styles.fieldLabel}>Selling price (LKR) *</Label>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="number-pad"
                placeholder="3000"
                placeholderTextColor="#a09a93"
              />
            </View>
            <View style={[styles.field, styles.fieldGrow]}>
              <Label style={styles.fieldLabel}>MRP</Label>
              <TextInput
                style={styles.input}
                value={mrp}
                onChangeText={setMrp}
                keyboardType="number-pad"
                placeholder="4000"
                placeholderTextColor="#a09a93"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Label style={styles.fieldLabel}>Name (optional — AI names it otherwise)</Label>
            <TextInput
              style={styles.input}
              value={nameOverride}
              onChangeText={setNameOverride}
              placeholder="Nike Airforces"
              placeholderTextColor="#a09a93"
              maxLength={200}
            />
          </View>

          <TouchableOpacity
            style={[styles.submit, (busy || !preview || !price) && styles.submitDisabled]}
            disabled={busy || !preview || !price}
            onPress={() => void submit()}
            activeOpacity={0.85}
          >
            {busy ? (
              <View style={styles.submitRow}>
                <ActivityIndicator size="small" color={CREAM} />
                <Label style={styles.submitText}>Reading image…</Label>
              </View>
            ) : (
              <View style={styles.submitRow}>
                <Ionicons name="sparkles-outline" size={16} color={CREAM} />
                <Label style={styles.submitText}>Create with AI</Label>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </PaperBackground>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: spacing[4],
  },
  copy: {
    marginTop: -spacing[2],
  },
  pickerRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  pickBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(27,28,28,0.12)",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  pickPrimary: {
    backgroundColor: "#2c3119",
    borderColor: "#2c3119",
  },
  pickPrimaryText: {
    color: CREAM,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
  },
  pickBtnText: {
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
  },
  previewWrap: {
    alignSelf: "center",
    width: 220,
    height: 260,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  field: {
    gap: 4,
    marginBottom: spacing[1],
  },
  fieldGrow: {
    flex: 1,
  },
  fieldLabel: {
    color: "#5e5e5d",
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  input: {
    height: 46,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(27,28,28,0.12)",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: INK,
  },
  submit: {
    height: 54,
    borderRadius: radii.full,
    backgroundColor: "#414a23",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: CREAM,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14.5,
  },
});
