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
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading, role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [wardrobeCount, setWardrobeCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    bio: "",
  });

  const displayName = user?.user_metadata?.full_name || form.name || "Guest";
  const initials = getInitials(displayName);
  const showAvatar = Boolean(avatarUrl) && !avatarError;

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

      setForm({
        name: profile?.full_name ?? user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        phone: profile?.phone ?? "",
        dob: (profile as { metadata?: { dob?: string } } | null)?.metadata?.dob ?? "",
        bio: (profile as { metadata?: { bio?: string } } | null)?.metadata?.bio ?? "",
      });
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
      if (res.error) {
        toast(res.error, "error");
      } else {
        if (res.url) {
          setAvatarUrl(resolveImageUrl(res.url) || res.url);
          setAvatarError(false);
        }
        toast("Profile photo updated", "success");
      }
    } catch (err: any) {
      toast(err.message || "Upload failed", "error");
    } finally {
      setUpdatingPhoto(false);
    }
  };

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
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }, [user, toast]);

  const handleSave = useCallback(async () => {
    if (!user) return;
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
      toast("Profile credentials updated", "success");
    }
  }, [user, form, toast]);

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
          <Text style={styles.loadingText}>Loading credentials…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Luxury Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.topBarKicker}>MEMBERSHIP</Text>
          <Text style={styles.topBarTitle}>Profile</Text>
        </View>

        <TouchableOpacity
          style={[styles.headerSaveBtn, saving && styles.headerSaveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.75}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.headerSaveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Luxury Portrait Hero Header */}
          <View style={styles.heroSection}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePhotoSelect}
              disabled={updatingPhoto}
              style={styles.avatarTouchable}
            >
              {/* Double Bezel Fluted Frame */}
              <View style={styles.avatarOuterBezel}>
                <View style={styles.avatarInnerBezel}>
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
                      colors={["#272e18", "#15180f"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.avatarFallback}
                    >
                      <Ionicons name="sparkles" size={12} color="#E8CF8F" style={styles.crownSparkle} />
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

              {/* Camera Action Badge */}
              <View style={styles.cameraPillBadge}>
                <Ionicons name="camera" size={13} color="#16190e" />
              </View>
            </TouchableOpacity>

            <View style={styles.heroInfoBlock}>
              <Text style={styles.heroNameText} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.heroRolePill}>
                <Ionicons
                  name={role === "admin" ? "shield-checkmark" : "diamond-outline"}
                  size={11}
                  color="#947629"
                />
                <Text style={styles.heroRolePillText}>
                  {role === "admin" ? "PLATFORM EXECUTIVE" : "LUXE PRIVILEGE MEMBER"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handlePhotoSelect}
                disabled={updatingPhoto}
                activeOpacity={0.7}
                style={styles.changePhotoBtn}
              >
                <Ionicons name="image-outline" size={13} color={colors.olive[800]} />
                <Text style={styles.changePhotoBtnText}>
                  {updatingPhoto ? "Uploading photo…" : "Change portrait"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Wardrobe Showcase Card */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push("/(main)/account/wardrobe" as never)}
            style={styles.wardrobeCard}
          >
            <View style={styles.wardrobeIconWrap}>
              <Ionicons name="shirt-outline" size={22} color={colors.olive[700]} />
            </View>
            <View style={styles.wardrobeContent}>
              <Text style={styles.wardrobeKicker}>DIGITAL ATELIER</Text>
              <Text style={styles.wardrobeTitle}>Wardrobe & Outfits</Text>
              <Text style={styles.wardrobeSub}>
                {wardrobeCount == null
                  ? "Your personal closet & style curation"
                  : wardrobeCount > 0
                    ? `${wardrobeCount} piece${wardrobeCount === 1 ? "" : "s"} cataloged · Tap to view`
                    : "Empty — sync pieces from delivered purchases"}
              </Text>
            </View>
            <View style={styles.wardrobeArrowWrap}>
              <Ionicons name="arrow-forward" size={15} color={colors.light.mutedForeground} />
            </View>
          </TouchableOpacity>

          {/* Credentials Form Section */}
          <View style={styles.formContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>CREDENTIALS</Text>
              <Text style={styles.sectionHeading}>Personal details</Text>
            </View>

            <View style={styles.formCard}>
              <LuxuryField
                icon="person-outline"
                label="Full name"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Enter full name"
              />

              <View style={styles.fieldSeparator} />

              <LuxuryField
                icon="mail-outline"
                label="Email address"
                value={form.email}
                editable={false}
                badge="VERIFIED"
              />

              <View style={styles.fieldSeparator} />

              <LuxuryField
                icon="call-outline"
                label="Phone number"
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                keyboardType="phone-pad"
                placeholder="+1 (555) 000-0000"
              />

              <View style={styles.fieldSeparator} />

              <LuxuryField
                icon="calendar-outline"
                label="Date of birth"
                value={form.dob}
                onChangeText={(v) => setForm((f) => ({ ...f, dob: v }))}
                placeholder="YYYY-MM-DD"
              />
            </View>

            {/* Editorial Bio Section */}
            <View style={[styles.sectionHeader, { marginTop: spacing[5] }]}>
              <Text style={styles.sectionKicker}>ABOUT YOU</Text>
              <Text style={styles.sectionHeading}>Editorial bio</Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.bioWrap}>
                <View style={styles.bioHeader}>
                  <View style={styles.bioIconBox}>
                    <Ionicons name="create-outline" size={16} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.fieldLabel}>Style Notes & Bio</Text>
                </View>
                <TextInput
                  style={styles.bioTextArea}
                  value={form.bio}
                  onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                  multiline
                  numberOfLines={4}
                  placeholder="Share your aesthetic preferences, style philosophy, or personal notes…"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.mainSaveBtn, saving && styles.mainSaveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#faf8f1" />
                  <Text style={styles.mainSaveBtnText}>Save profile changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LuxuryField({
  icon,
  label,
  value,
  onChangeText,
  editable = true,
  keyboardType,
  placeholder,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  editable?: boolean;
  keyboardType?: "default" | "phone-pad";
  placeholder?: string;
  badge?: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIconBox}>
        <Ionicons name={icon} size={17} color={colors.olive[700]} />
      </View>

      <View style={styles.fieldContent}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {badge ? (
            <View style={styles.badgePill}>
              <Ionicons name="lock-closed" size={9} color={colors.olive[700]} />
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>

        <TextInput
          style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f7f2",
  },
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },

  /* Top Navigation Bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
    backgroundColor: "#f8f7f2",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navBtnPlaceholder: {
    width: 38,
    height: 38,
  },
  titleBlock: {
    alignItems: "center",
    gap: 1,
  },
  topBarKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  topBarTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  headerSaveBtn: {
    backgroundColor: colors.olive[700],
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSaveBtnDisabled: {
    opacity: 0.6,
  },
  headerSaveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#faf8f1",
  },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },

  /* Hero Section */
  heroSection: {
    alignItems: "center",
    marginBottom: spacing[5],
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  avatarTouchable: {
    position: "relative",
    marginBottom: spacing[3],
  },
  avatarOuterBezel: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "#C8A44A",
    padding: 3,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInnerBezel: {
    width: "100%",
    height: "100%",
    borderRadius: 43,
    overflow: "hidden",
    backgroundColor: "#1c2012",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  crownSparkle: {
    position: "absolute",
    top: 8,
  },
  avatarInitialsText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: "#F4E2B2",
    marginTop: 8,
    letterSpacing: 1,
  },
  avatarLoadingScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraPillBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#C8A44A",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  heroInfoBlock: {
    alignItems: "center",
    gap: 6,
  },
  heroNameText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
    letterSpacing: -0.4,
  },
  heroRolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  heroRolePillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: "#85651b",
    textTransform: "uppercase",
  },
  changePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing[2],
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  changePhotoBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[800],
  },

  /* Wardrobe Card */
  wardrobeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    borderRadius: radii["2xl"],
    padding: spacing[4],
    marginBottom: spacing[5],
    ...shadows.soft,
  },
  wardrobeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  wardrobeContent: {
    flex: 1,
    gap: 2,
  },
  wardrobeKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[700],
    letterSpacing: 1.2,
  },
  wardrobeTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  wardrobeSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  wardrobeArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f5f4ef",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Form Sections */
  formContainer: {
    gap: spacing[2],
  },
  sectionHeader: {
    gap: 1,
    paddingHorizontal: spacing[1],
    marginBottom: spacing[2],
  },
  sectionKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[700],
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sectionHeading: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    overflow: "hidden",
    ...shadows.soft,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
  },
  fieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f7f6f0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(83, 94, 44, 0.1)",
  },
  fieldContent: {
    flex: 1,
    gap: 2,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  badgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: colors.olive[800],
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14.5,
    color: colors.light.foreground,
    paddingVertical: 2,
    letterSpacing: -0.2,
  },
  fieldInputDisabled: {
    color: "#6b7280",
  },
  fieldSeparator: {
    height: 1,
    backgroundColor: "#f3f2eb",
    marginLeft: spacing[4] + 36 + spacing[3],
  },

  /* Bio Textarea */
  bioWrap: {
    padding: spacing[4],
    gap: spacing[2],
  },
  bioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bioIconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#f7f6f0",
    alignItems: "center",
    justifyContent: "center",
  },
  bioTextArea: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
    minHeight: 88,
    lineHeight: 20,
    textAlignVertical: "top",
    backgroundColor: "#faf9f4",
    borderRadius: radii.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
  },

  /* Save CTA */
  mainSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.olive[700],
    borderRadius: radii.full,
    paddingVertical: spacing[4],
    marginTop: spacing[4],
    ...shadows.soft,
  },
  mainSaveBtnDisabled: {
    opacity: 0.7,
  },
  mainSaveBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: "#faf8f1",
    letterSpacing: 0.4,
  },
});
