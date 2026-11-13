import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { createSellerStore, getSellerStore, updateSellerStore } from "@/lib/api";
import { uploadStorefrontImage } from "@/lib/upload";
import { markSellerOnboardingComplete } from "@/lib/seller-onboarding";
import { themedAlert } from "@/lib/themed-alert";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";
import { AUTH_PLACEHOLDER, AuthField, PrimaryButton, authStyles } from "@/components/auth/auth-ui";
import type { Store } from "@/lib/types";

/**
 * Seller onboarding — mobile mirror of web /seller/onboarding.
 * Sign-up already creates the store (name only), so this fills in the rest:
 *   1. Store info   — name, description
 *   2. Branding     — logo + banner
 *   3. Pickup       — where couriers collect orders (stores.delivery_*)
 * If sign-up's store creation failed, step 1 creates the store.
 */

type ImageField = "logo_url" | "banner_url";

const STEPS = [
  { title: "Store info", heading: "Tell shoppers about your store" },
  { title: "Branding", heading: "Make it recognisable" },
  { title: "Pickup", heading: "Where do we collect orders?" },
] as const;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function SellerOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // Each step starts at the top, not where the previous one was scrolled to.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<ImageField | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [descFocused, setDescFocused] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [province, setProvince] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const res = await getSellerStore(user.id);
      if (cancelled) return;
      const s = res.ok ? res.data : null;
      const meta = user.user_metadata as { store_name?: unknown } | undefined;
      setStore(s);
      setName(s?.name ?? (typeof meta?.store_name === "string" ? meta.store_name : ""));
      setDescription(s?.description ?? "");
      setLogoUrl(s?.logo_url ?? "");
      setBannerUrl(s?.banner_url ?? "");
      setLine1(s?.delivery_address_line1 ?? "");
      setLine2(s?.delivery_address_line2 ?? "");
      setCity(s?.delivery_city ?? "");
      setPostal(s?.delivery_postal_code ?? "");
      setProvince(s?.delivery_state ?? "");
      if (s?.delivery_latitude != null && s?.delivery_longitude != null) {
        setCoords({ lat: Number(s.delivery_latitude), lng: Number(s.delivery_longitude) });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const finish = async () => {
    if (user) await markSellerOnboardingComplete(user.id);
    router.replace("/(seller)");
  };

  const pickImage = async (field: ImageField) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      themedAlert("Permission needed", "Allow photo library access in Settings to add images.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: field === "logo_url" ? [1, 1] : [3, 1],
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      toast("Image must be under 5 MB", "error");
      return;
    }
    setUploading(field);
    const up = await uploadStorefrontImage(asset.uri, { mimeType: asset.mimeType, fileName: asset.fileName });
    setUploading(null);
    if (!up.url) {
      toast(up.error ?? "Upload failed", "error");
      return;
    }
    if (field === "logo_url") setLogoUrl(up.url);
    else setBannerUrl(up.url);
  };

  const validate = (): string | null => {
    if (uploading) return "Wait for the image to finish uploading";
    if (step === 0 && name.trim().length < 2) return "Store name must be at least 2 characters";
    if (step === 2 && (!line1.trim() || !city.trim())) return "Street address and city are required";
    return null;
  };

  // Each step saves what it collected, so quitting midway keeps progress.
  const saveStep = async (): Promise<boolean> => {
    if (!user) return false;
    let current = store;
    if (!current) {
      const created = await createSellerStore(user.id, { name: name.trim(), description: description.trim() });
      if (!created.ok) {
        toast(created.error, "error");
        return false;
      }
      current = created.data;
      setStore(current);
      // Same default as sign-up: app sellers run online stores.
      await updateSellerStore(current.id, { is_online: true });
    }
    const patch: Partial<Store> =
      step === 0
        ? { name: name.trim(), description: description.trim() }
        : step === 1
          ? { logo_url: logoUrl || undefined, banner_url: bannerUrl || undefined }
          : {
              delivery_address_line1: line1.trim(),
              delivery_address_line2: line2.trim() || null,
              delivery_city: city.trim(),
              delivery_state: province.trim() || null,
              delivery_postal_code: postal.trim() || null,
              delivery_country: current.delivery_country || "Sri Lanka",
              delivery_latitude: coords?.lat ?? null,
              delivery_longitude: coords?.lng ?? null,
            };
    if (Object.keys(patch).length === 0) return true;
    const res = await updateSellerStore(current.id, patch);
    if (!res.ok) {
      toast(res.error, "error");
      return false;
    }
    setStore(res.data ?? current);
    return true;
  };

  const next = async () => {
    const err = validate();
    if (err) {
      toast(err, "error");
      return;
    }
    setSaving(true);
    const ok = await saveStep();
    setSaving(false);
    if (!ok) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      toast("Store details saved", "success");
      await finish();
    }
  };

  if (loading) {
    return (
      <View style={[authStyles.root, styles.center]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  const isLast = step === STEPS.length - 1;

  return (
    <KeyboardAvoidingView style={authStyles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          authStyles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable
              onPress={() => setStep(step - 1)}
              hitSlop={10}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
            >
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </Pressable>
          ) : (
            <View style={styles.iconBtnGhost} />
          )}
          <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
            <Text style={styles.skip}>Skip for now</Text>
          </Pressable>
        </View>

        <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.progressItem}>
              <View style={[styles.progressBar, i <= step && styles.progressBarOn]} />
              <Text style={[styles.progressLabel, i === step && styles.progressLabelOn]}>{s.title}</Text>
            </View>
          ))}
        </View>

        <Animated.View key={step} entering={FadeInDown.duration(380)}>
          <Text style={styles.kicker}>STEP {step + 1} OF {STEPS.length}</Text>
          <Text style={authStyles.title} accessibilityRole="header">
            {STEPS[step].heading}
          </Text>

          <View style={authStyles.form}>
            {step === 0 ? (
              <>
                <AuthField
                  placeholder="Shop name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  maxLength={80}
                  accessibilityLabel="Shop name"
                  valid={name.trim().length > 1}
                />
                <TextInput
                  placeholder="What do you sell? (optional)"
                  placeholderTextColor={AUTH_PLACEHOLDER}
                  selectionColor={colors.olive[600]}
                  value={description}
                  onChangeText={setDescription}
                  onFocus={() => setDescFocused(true)}
                  onBlur={() => setDescFocused(false)}
                  multiline
                  maxLength={600}
                  accessibilityLabel="Store description"
                  style={[styles.multiline, descFocused && styles.multilineFocused]}
                />
                <Text style={authStyles.hint}>Shown on your store page. {description.length}/600</Text>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.lead}>This is how the top of your store looks to shoppers. Tap to add images.</Text>
                <BrandPreview
                  name={name.trim() || "Your store"}
                  slug={store?.slug}
                  logoUrl={logoUrl}
                  bannerUrl={bannerUrl}
                  uploading={uploading}
                  onPick={pickImage}
                />
                <View style={styles.assetList}>
                  <AssetRow
                    icon="person-circle-outline"
                    title="Logo"
                    spec="Square · at least 400 × 400"
                    done={Boolean(logoUrl)}
                    busy={uploading === "logo_url"}
                    onPick={() => pickImage("logo_url")}
                    onClear={() => setLogoUrl("")}
                  />
                  <View style={styles.assetDivider} />
                  <AssetRow
                    icon="image-outline"
                    title="Banner"
                    spec="Wide 3:1 · at least 1500 × 500"
                    done={Boolean(bannerUrl)}
                    busy={uploading === "banner_url"}
                    onPick={() => pickImage("banner_url")}
                    onClear={() => setBannerUrl("")}
                  />
                </View>
                <Text style={authStyles.hint}>JPG, PNG or WebP up to 5 MB. You can change these any time.</Text>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.lead}>
                  Couriers pick up your orders here. Shoppers never see this address.
                </Text>
                <AuthField
                  placeholder="Street address"
                  value={line1}
                  onChangeText={setLine1}
                  autoComplete="street-address"
                  textContentType="streetAddressLine1"
                  accessibilityLabel="Street address"
                  valid={line1.trim().length > 2}
                />
                <AuthField
                  placeholder="Building, floor or unit (optional)"
                  value={line2}
                  onChangeText={setLine2}
                  textContentType="streetAddressLine2"
                  accessibilityLabel="Building, floor or unit"
                />
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1.4 }}>
                    <AuthField
                      placeholder="City"
                      value={city}
                      onChangeText={setCity}
                      autoCapitalize="words"
                      textContentType="addressCity"
                      accessibilityLabel="City"
                      valid={city.trim().length > 1}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuthField
                      placeholder="Postcode"
                      value={postal}
                      onChangeText={setPostal}
                      keyboardType="number-pad"
                      textContentType="postalCode"
                      accessibilityLabel="Postal code"
                    />
                  </View>
                </View>
                <AuthField
                  placeholder="Province (optional)"
                  value={province}
                  onChangeText={setProvince}
                  autoCapitalize="words"
                  textContentType="addressState"
                  accessibilityLabel="Province"
                />
                <View style={styles.reviewNote}>
                  <Ionicons name="time-outline" size={18} color={C.accent} />
                  <Text style={styles.reviewNoteText}>
                    Your store is reviewed by our team before it goes live, usually within 48 hours.
                  </Text>
                </View>
              </>
            ) : null}

            <PrimaryButton
              label={isLast ? "Finish setup" : step === 1 && !logoUrl && !bannerUrl ? "Add these later" : "Continue"}
              onPress={next}
              loading={saving}
              disabled={
                uploading !== null ||
                (step === 0 && name.trim().length < 2) ||
                (step === 2 && (!line1.trim() || !city.trim()))
              }
              style={{ marginTop: 8 }}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BrandPreview({
  name,
  slug,
  logoUrl,
  bannerUrl,
  uploading,
  onPick,
}: {
  name: string;
  slug?: string;
  logoUrl: string;
  bannerUrl: string;
  uploading: ImageField | null;
  onPick: (field: ImageField) => void;
}) {
  const initial = name.charAt(0).toUpperCase() || "S";
  return (
    <View style={styles.preview}>
      <Pressable
        onPress={() => onPick("banner_url")}
        disabled={uploading !== null}
        style={styles.previewBanner}
        accessibilityRole="button"
        accessibilityLabel={bannerUrl ? "Change banner" : "Add banner"}
      >
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.bannerEmpty}>
            <View style={[styles.bannerBlob, { left: -30, top: -40 }]} />
            <View style={[styles.bannerBlob, styles.bannerBlobGold, { right: -20, bottom: -50 }]} />
          </View>
        )}
        {uploading === "banner_url" ? (
          <View style={styles.previewBusy}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <View style={styles.bannerChip}>
            <Ionicons name={bannerUrl ? "camera-outline" : "add"} size={14} color={C.text} />
            <Text style={styles.bannerChipText}>{bannerUrl ? "Change" : "Add banner"}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.previewBody}>
        <Pressable
          onPress={() => onPick("logo_url")}
          disabled={uploading !== null}
          style={styles.previewLogo}
          accessibilityRole="button"
          accessibilityLabel={logoUrl ? "Change logo" : "Add logo"}
        >
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text style={styles.previewInitial}>{initial}</Text>
          )}
          {uploading === "logo_url" ? (
            <View style={styles.previewBusy}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={styles.logoBadge} pointerEvents="none">
          <Ionicons name="camera" size={12} color={C.cream} />
        </View>
        <Text style={styles.previewName} numberOfLines={1}>{name}</Text>
        <Text style={styles.previewMeta} numberOfLines={1}>
          {slug ? `@${slug}` : "Boutique"} · New on VESTARA
        </Text>
      </View>
    </View>
  );
}

function AssetRow({
  icon,
  title,
  spec,
  done,
  busy,
  onPick,
  onClear,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  spec: string;
  done: boolean;
  busy: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.assetRow}>
      <View style={[styles.assetIcon, done && styles.assetIconDone]}>
        <Ionicons name={done ? "checkmark" : icon} size={18} color={done ? C.lime : C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.assetTitle}>{title}</Text>
        <Text style={styles.assetSpec}>{spec}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={C.accent} />
      ) : done ? (
        <View style={styles.assetActions}>
          <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${title.toLowerCase()}`}>
            <Text style={styles.assetRemove}>Remove</Text>
          </Pressable>
          <Pressable onPress={onPick} style={styles.assetBtn} accessibilityRole="button">
            <Text style={styles.assetBtnText}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onPick} style={[styles.assetBtn, styles.assetBtnPrimary]} accessibilityRole="button">
          <Text style={[styles.assetBtnText, styles.assetBtnTextPrimary]}>Upload</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnGhost: { width: 44, height: 44 },
  skip: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.muted },
  progress: { flexDirection: "row", gap: 8, marginTop: 22, marginBottom: 26 },
  progressItem: { flex: 1, gap: 6 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: "rgba(22,23,15,0.08)" },
  progressBarOn: { backgroundColor: C.ink },
  progressLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: C.muted },
  progressLabelOn: { color: C.text, fontFamily: fontFamilies.sans.semibold },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: C.accent,
    marginBottom: 8,
  },
  multiline: {
    minHeight: 110,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 16,
    backgroundColor: "#efede4",
    borderWidth: 1.5,
    borderColor: "transparent",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15.5,
    lineHeight: 21,
    color: C.text,
    textAlignVertical: "top",
  },
  multilineFocused: { backgroundColor: "#FFFFFF", borderColor: colors.olive[600] },
  lead: { fontFamily: fontFamilies.sans.regular, fontSize: 14.5, lineHeight: 21, color: C.muted, marginTop: -14 },
  preview: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    shadowColor: "#16170f",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  previewBanner: { width: "100%", aspectRatio: 3, backgroundColor: C.ink, overflow: "hidden" },
  bannerEmpty: { ...StyleSheet.absoluteFillObject, backgroundColor: C.ink },
  bannerBlob: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(200,224,138,0.16)",
  },
  bannerBlobGold: { backgroundColor: "rgba(214,182,120,0.22)" },
  bannerChip: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(250,248,241,0.94)",
  },
  bannerChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.text },
  previewBusy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22,23,15,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBody: { paddingHorizontal: 18, paddingBottom: 18 },
  previewLogo: {
    width: 76,
    height: 76,
    marginTop: -38,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: C.glow,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoBadge: {
    position: "absolute",
    left: 18 + 58,
    top: 38 - 22,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  previewInitial: { fontFamily: fontFamilies.display.semibold, fontSize: 30, color: C.ink },
  previewName: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: C.text, marginTop: 10, letterSpacing: -0.3 },
  previewMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 2 },
  assetList: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
  },
  assetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(22,23,15,0.1)", marginLeft: 50 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  assetIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  assetIconDone: { backgroundColor: C.ink },
  assetTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: C.text },
  assetSpec: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 1 },
  assetActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  assetRemove: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: C.muted },
  assetBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  assetBtnPrimary: { backgroundColor: C.accentSoft, borderColor: "rgba(83,94,44,0.18)" },
  assetBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.text },
  assetBtnTextPrimary: { color: C.accent },
  fieldRow: { flexDirection: "row", gap: 10 },
  reviewNote: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
  },
  reviewNoteText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 18, color: C.text },
});
