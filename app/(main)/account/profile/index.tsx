import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Text,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { getProfileBackend, updateProfileBackend } from "@/lib/api/backend";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { pickImage, takePhoto, uploadAvatar } from "@/lib/upload";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type ProfileForm = { name: string; email: string; phone: string; dob: string; bio: string };

const EMPTY_FORM: ProfileForm = { name: "", email: "", phone: "", dob: "", bio: "" };
const BIO_MAX = 280;

/** Auto-insert dashes as the user types digits: 19950412 → 1995-04-12. */
function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function isValidDob(v: string): boolean {
  if (!v) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return false;
  return d.getTime() < Date.now() && d.getFullYear() > 1900;
}

function formatMemberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading, role } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [wardrobeCount, setWardrobeCount] = useState<number | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<ProfileForm>(EMPTY_FORM);

  const displayName = user?.user_metadata?.full_name || form.name || "Guest";
  const initials = getInitials(displayName);
  const showAvatar = Boolean(avatarUrl) && !avatarError;
  const dirty =
    form.name !== savedForm.name ||
    form.phone !== savedForm.phone ||
    form.dob !== savedForm.dob ||
    form.bio !== savedForm.bio;
  const dobInvalid = !isValidDob(form.dob);
  const emailVerified = Boolean(user?.email_confirmed_at);
  const memberSince = formatMemberSince(user?.created_at);
  const completeness = [form.name, form.phone, form.dob, form.bio, showAvatar ? "y" : ""].filter(
    (v) => String(v).trim().length > 0
  ).length;
  const completenessPct = Math.round((completeness / 5) * 100);

  useEffect(() => {
    if (user?.user_metadata?.avatar_url) {
      const url = resolveImageUrl(user.user_metadata.avatar_url) || user.user_metadata.avatar_url;
      setAvatarUrl(url);
      setAvatarError(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    let cancelled = false;
    (async () => {
      const res = await getProfileBackend();
      const profile = res.ok ? res.data.user : null;

      if (cancelled) return;

      const loaded: ProfileForm = {
        name: profile?.full_name ?? user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        phone: profile?.phone ?? "",
        dob: (profile as { metadata?: { dob?: string } } | null)?.metadata?.dob ?? "",
        bio: (profile as { metadata?: { bio?: string } } | null)?.metadata?.bio ?? "",
      };
      setForm(loaded);
      setSavedForm(loaded);
      if (profile?.avatar_url) {
        setAvatarUrl(resolveImageUrl(profile.avatar_url) || profile.avatar_url);
        setAvatarError(false);
      }
      setLoading(false);

      // Wardrobe snapshot (best-effort — never blocks profile).
      try {
        const { listWardrobeItems, getWardrobeStats } = await import("@/lib/api/wardrobe");
        const [itemsRes, statsRes] = await Promise.all([
          listWardrobeItems({ limit: 1 }),
          getWardrobeStats(),
        ]);
        if (cancelled) return;
        if (statsRes.ok) {
          setWardrobeCount(statsRes.data?.totals?.total_items ?? (itemsRes.ok ? itemsRes.data.items.length : 0));
        } else if (itemsRes.ok) {
          setWardrobeCount(itemsRes.data.items.length);
        }
      } catch {
        /* ignore — profile renders without wardrobe count */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const uploadSelectedPhoto = async (
    uri: string,
    asset?: { mimeType?: string | null; fileName?: string | null }
  ) => {
    if (!user) return;
    setUpdatingPhoto(true);
    try {
      const res = await uploadAvatar(user.id, uri, {
        mimeType: asset?.mimeType,
        fileName: asset?.fileName,
      });
      if (res.error || !res.url) {
        toast(res.error || "Upload failed", "error");
        return;
      }
      const patch = await updateProfileBackend({ avatar_url: res.url });
      if (!patch.ok) {
        toast(patch.error || "Failed to save avatar", "error");
        return;
      }
      await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), avatar_url: res.url },
      });
      setAvatarUrl(resolveImageUrl(res.url) || res.url);
      setAvatarError(false);
      toast("Profile photo updated", "success");
    } catch (err: any) {
      toast(err.message || "Upload failed", "error");
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handleRemovePhoto = useCallback(async () => {
    if (!user) return;
    setUpdatingPhoto(true);
    try {
      const patch = await updateProfileBackend({ avatar_url: null });
      if (!patch.ok) {
        toast(patch.error || "Remove failed", "error");
        return;
      }
      await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), avatar_url: null },
      });
      setAvatarUrl(null);
      setAvatarError(false);
      toast("Profile photo removed", "success");
    } catch (err: any) {
      toast(err.message || "Remove failed", "error");
    } finally {
      setUpdatingPhoto(false);
    }
  }, [user, toast]);

  const handlePickedAsset = async (
    result: Awaited<ReturnType<typeof pickImage>>
  ) => {
    if (!result || result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    await uploadSelectedPhoto(asset.uri, {
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    });
  };

  const handlePhotoSelect = useCallback(() => {
    Alert.alert(
      "Update Profile Photo",
      "Choose an option",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const result = await takePhoto();
            if (!result) {
              toast("Camera permission is required", "error");
              return;
            }
            await handlePickedAsset(result);
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            const result = await pickImage();
            if (!result) {
              toast("Photo library permission is required", "error");
              return;
            }
            await handlePickedAsset(result);
          },
        },
        {
          text: "Remove portrait",
          style: "destructive",
          onPress: handleRemovePhoto,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }, [user, toast, handleRemovePhoto]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast("Please enter your name", "error");
      return;
    }
    if (dobInvalid) {
      toast("Date of birth must be a valid date (YYYY-MM-DD)", "error");
      return;
    }
    setSaving(true);
    const res = await updateProfileBackend({
      full_name: form.name,
      phone: form.phone || null,
      metadata: { dob: form.dob, bio: form.bio },
    });
    const error = res.ok ? null : { message: res.error };

    if (!error) {
      await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), full_name: form.name },
      });
    }

    setSaving(false);
    if (error) {
      toast(error.message, "error");
    } else {
      setSavedForm(form);
      toast("Profile updated", "success");
    }
  }, [user, form, toast, dobInvalid]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Profile</Text>
          <View style={styles.navBtnPlaceholder} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.olive[700]} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) return null;

  const wardrobeSub =
    wardrobeCount == null
      ? "Your personal closet & outfits"
      : wardrobeCount > 0
        ? `${wardrobeCount} piece${wardrobeCount === 1 ? "" : "s"} in your closet`
        : "Pieces from delivered orders appear here";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profile</Text>
        <View style={styles.navBtnPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, dirty && { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Identity hero ───────────────────────────────── */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePhotoSelect}
                disabled={updatingPhoto}
                accessibilityLabel="Change profile photo"
              >
                <View style={styles.avatarRing}>
                  <View style={styles.avatarInner}>
                    {showAvatar ? (
                      <Image
                        source={{ uri: avatarUrl! }}
                        style={styles.avatarImg}
                        contentFit="cover"
                        transition={200}
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <LinearGradient
                        colors={[colors.olive[600], colors.olive[800]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatarFallback}
                      >
                        <Text style={styles.avatarInitialsText}>{initials}</Text>
                      </LinearGradient>
                    )}
                    {updatingPhoto ? (
                      <View style={styles.avatarLoadingScrim}>
                        <ActivityIndicator size="small" color="#ffffff" />
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={12} color={colors.olive[950]} />
                </View>
              </TouchableOpacity>

              <View style={styles.heroInfo}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.heroEmail} numberOfLines={1}>
                  {form.email}
                </Text>
                <View style={styles.heroRolePill}>
                  <Ionicons
                    name={role === "admin" ? "shield-checkmark" : "diamond-outline"}
                    size={10}
                    color={colors.accent2.ochre}
                  />
                  <Text style={styles.heroRolePillText}>
                    {role === "admin" ? "PLATFORM EXECUTIVE" : "LUXE MEMBER"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroStats}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.heroStatHead}>
                  <Text style={styles.heroStatKey}>PROFILE</Text>
                  <Text style={styles.heroStatVal}>{completenessPct}% complete</Text>
                </View>
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${completenessPct}%` }]} />
                </View>
              </View>
              {memberSince ? (
                <View style={styles.heroSince}>
                  <Text style={styles.heroStatKey}>MEMBER SINCE</Text>
                  <Text style={styles.heroStatVal}>{memberSince}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Wardrobe shortcut ───────────────────────────── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/(main)/account/wardrobe" as never)}
            style={styles.linkCard}
          >
            <View style={styles.linkIcon}>
              <Ionicons name="shirt-outline" size={20} color={colors.olive[700]} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.linkTitle}>Wardrobe & outfits</Text>
              <Text style={styles.linkSub} numberOfLines={1}>
                {wardrobeSub}
              </Text>
            </View>
            {wardrobeCount ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{wardrobeCount}</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
          </TouchableOpacity>

          {/* ── Personal details ────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionKicker}>PERSONAL DETAILS</Text>
          </View>

          <View style={styles.formCard}>
            <Field
              icon="person-outline"
              label="Full name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Your full name"
              autoCapitalize="words"
              textContentType="name"
            />
            <View style={styles.fieldSeparator} />
            <Field
              icon="mail-outline"
              label="Email"
              value={form.email}
              editable={false}
              trailing={
                emailVerified ? (
                  <View style={styles.verifiedPill}>
                    <Ionicons name="checkmark-circle" size={11} color={colors.olive[600]} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : (
                  <Ionicons name="lock-closed-outline" size={14} color={colors.light.mutedForeground} />
                )
              }
            />
            <View style={styles.fieldSeparator} />
            <Field
              icon="call-outline"
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              keyboardType="phone-pad"
              placeholder="+94 7X XXX XXXX"
              textContentType="telephoneNumber"
            />
            <View style={styles.fieldSeparator} />
            <Field
              icon="calendar-outline"
              label="Date of birth"
              value={form.dob}
              onChangeText={(v) => setForm((f) => ({ ...f, dob: formatDobInput(v) }))}
              keyboardType="number-pad"
              placeholder="YYYY-MM-DD"
              maxLength={10}
              error={form.dob.length === 10 && dobInvalid ? "Enter a valid past date" : undefined}
            />
          </View>
          <Text style={styles.helperText}>
            Your email is used to sign in and can't be changed here.
          </Text>

          {/* ── Bio ─────────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionKicker}>STYLE NOTES</Text>
          </View>

          <View style={[styles.formCard, styles.bioCard]}>
            <TextInput
              style={styles.bioTextArea}
              value={form.bio}
              onChangeText={(v) => setForm((f) => ({ ...f, bio: v.slice(0, BIO_MAX) }))}
              multiline
              placeholder="Favourite brands, fits, colours — anything that helps us recommend better."
              placeholderTextColor={colors.light.mutedForeground + "99"}
            />
            <Text style={styles.bioCounter}>
              {form.bio.length}/{BIO_MAX}
            </Text>
          </View>
        </ScrollView>

        {/* ── Sticky save bar (only when there are unsaved edits) ── */}
        {dirty ? (
          <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
            <TouchableOpacity
              style={styles.discardBtn}
              onPress={() => setForm(savedForm)}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.light.primaryForeground} />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  icon,
  label,
  value,
  onChangeText,
  editable = true,
  trailing,
  error,
  ...inputProps
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  editable?: boolean;
  trailing?: React.ReactNode;
  error?: string;
} & Pick<
  React.ComponentProps<typeof TextInput>,
  "keyboardType" | "placeholder" | "autoCapitalize" | "textContentType" | "maxLength"
>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.fieldRow, focused && styles.fieldRowFocused]}>
      <Ionicons
        name={icon}
        size={18}
        color={error ? colors.light.destructive : focused ? colors.olive[700] : colors.light.mutedForeground}
      />
      <View style={styles.fieldContent}>
        <Text style={[styles.fieldLabel, focused && { color: colors.olive[700] }]}>{label}</Text>
        <TextInput
          style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          placeholderTextColor={colors.light.mutedForeground + "80"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[2] },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    backgroundColor: colors.light.background,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.light.border + "99",
  },
  navBtnPlaceholder: { width: 40, height: 40 },
  topBarTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },

  /* Hero */
  heroCard: {
    backgroundColor: colors.olive[900],
    borderRadius: radii["3xl"],
    padding: spacing[5],
    gap: spacing[4],
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: colors.accent2.ochre,
    padding: 3,
  },
  avatarInner: { flex: 1, borderRadius: 40, overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitialsText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: "#F4E2B2",
    letterSpacing: 0.5,
  },
  avatarLoadingScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent2.ochre,
    borderWidth: 2,
    borderColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: { flex: 1, gap: 4 },
  heroName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.paper.cream,
    letterSpacing: -0.4,
  },
  heroEmail: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.olive[200],
  },
  heroRolePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.14)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.3)",
  },
  heroRolePillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.accent2.ochre,
  },
  heroDivider: { height: 1, backgroundColor: "rgba(250,248,241,0.1)" },
  heroStats: { flexDirection: "row", alignItems: "flex-end", gap: spacing[5] },
  heroStatHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  heroStatKey: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.olive[300],
  },
  heroStatVal: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.paper.cream,
  },
  heroSince: { gap: 6, alignItems: "flex-end" },
  meterTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(250,248,241,0.14)",
    overflow: "hidden",
  },
  meterFill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent2.ochre },

  /* Link card */
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border + "99",
    borderRadius: radii["2xl"],
    padding: spacing[4],
  },
  linkIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  linkSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  countPill: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
    alignItems: "center",
  },
  countPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },

  /* Sections */
  sectionHeader: { paddingHorizontal: spacing[1], marginTop: spacing[3] },
  sectionKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1.5,
  },
  formCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border + "99",
    overflow: "hidden",
  },
  helperText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    paddingHorizontal: spacing[1],
    marginTop: -spacing[1],
  },

  /* Fields */
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  fieldRowFocused: { backgroundColor: colors.olive[50] },
  fieldContent: { flex: 1, gap: 1 },
  fieldLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  fieldInput: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
    paddingVertical: 2,
  },
  fieldInputDisabled: { color: colors.light.mutedForeground },
  fieldError: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.destructive,
  },
  fieldSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginLeft: spacing[4] + 18 + spacing[3],
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  verifiedText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[700],
  },

  /* Bio */
  bioCard: { padding: spacing[4], gap: spacing[2] },
  bioTextArea: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14.5,
    color: colors.light.foreground,
    minHeight: 96,
    lineHeight: 21,
    textAlignVertical: "top",
    padding: 0,
  },
  bioCounter: {
    alignSelf: "flex-end",
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },

  /* Sticky save bar */
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    ...shadows.soft,
  },
  discardBtn: {
    paddingHorizontal: spacing[5],
    height: 50,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  discardText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  saveBtn: {
    flex: 1,
    height: 50,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[700],
  },
  saveBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.light.primaryForeground,
  },
});
