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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Avatar, Button, useToast } from "@/components/ui";
import { Body, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { pickImage, takePhoto, uploadAvatar } from "@/lib/upload";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    bio: "",
  });

  const displayName = user?.user_metadata?.full_name || form.name || "Guest";

  useEffect(() => {
    if (user?.user_metadata?.avatar_url) {
      const url = resolveImageUrl(user.user_metadata.avatar_url) || user.user_metadata.avatar_url;
      setAvatarUrl(url);
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
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, phone, avatar_url, metadata")
        .eq("id", user.id)
        .maybeSingle();

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
      }
      setLoading(false);
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
    // Alert kept for the system action sheet (camera vs library picker).
    // Success/failure of the chosen action surfaces a toast.
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
    // Read existing metadata so we don't clobber fields we don't manage.
    const { data: existing } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", user.id)
      .maybeSingle();
    const prevMeta = (existing?.metadata as Record<string, unknown> | null) ?? {};

    const { error } = await supabase
      .from("users")
      .update({
        full_name: form.name,
        phone: form.phone || null,
        metadata: { ...prevMeta, dob: form.dob, bio: form.bio },
      })
      .eq("id", user.id);

    // Mirror full_name into Supabase Auth user_metadata so the session
    // reflects the change immediately (useAuth hydrates from this).
    if (!error) {
      await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), full_name: form.name },
      });
    }

    setSaving(false);
    if (error) {
      toast(error.message, "error");
    } else {
      toast("Profile saved", "success");
    }
  }, [user, form, toast]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Profile" />
        <View style={styles.loading}>
          <Body muted>Loading profile…</Body>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Profile" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePhotoSelect}
              disabled={updatingPhoto}
              style={styles.avatarWrapper}
            >
              <Avatar
                name={displayName}
                uri={avatarUrl}
                size={88}
              />
              {updatingPhoto ? (
                <View style={styles.avatarLoader}>
                  <ActivityIndicator size="small" color="#ffffff" />
                </View>
              ) : (
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={14} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePhotoSelect} disabled={updatingPhoto} activeOpacity={0.7}>
              <Body style={styles.changePhotoText}>
                {updatingPhoto ? "Uploading..." : "Change photo"}
              </Body>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <ProfileField
              label="Full name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <ProfileField label="Email" value={form.email} editable={false} />
            <ProfileField
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              keyboardType="phone-pad"
            />
            <ProfileField
              label="Date of birth"
              value={form.dob}
              onChangeText={(v) => setForm((f) => ({ ...f, dob: v }))}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.field}>
              <Label style={styles.fieldLabel}>Bio</Label>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.bio}
                onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                multiline
                numberOfLines={4}
                placeholder="Tell us about yourself"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <Button onPress={handleSave} loading={saving} style={styles.saveBtn}>
            Save changes
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  editable = true,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  editable?: boolean;
  keyboardType?: "default" | "phone-pad";
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>{label}</Label>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  avatarSection: {
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  form: {
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  field: {
    gap: spacing[2],
  },
  fieldLabel: {
    color: colors.light.mutedForeground,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.medium,
  },
  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
  },
  inputDisabled: {
    backgroundColor: colors.olive[50],
    color: colors.light.mutedForeground,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  saveBtn: {
    alignSelf: "stretch",
  },
  avatarWrapper: {
    position: "relative",
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.primary,
    marginTop: spacing[2],
  },
});
