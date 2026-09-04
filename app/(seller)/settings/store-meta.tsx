import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getStoreMeta, updateStoreMeta, getSellerStore } from "@/lib/api";
import { pickImage, uploadAvatar } from "@/lib/upload";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { StoreMeta as StoreMetaType, StoreMetaSocialLinks, StoreMetaFooterLink } from "@/lib/api/backend";

const EMPTY_SOCIAL: StoreMetaSocialLinks = {
  instagram: "",
  tiktok: "",
  facebook: "",
  twitter: "",
  youtube: "",
};

const SOCIAL_FIELDS: Array<{ key: keyof StoreMetaSocialLinks; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourstore" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourstore" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourstore" },
  { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/yourstore" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourstore" },
];

export default function SellerStoreMeta() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [announcement, setAnnouncement] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [social, setSocial] = useState<StoreMetaSocialLinks>(EMPTY_SOCIAL);
  const [footerLinks, setFooterLinks] = useState<StoreMetaFooterLink[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await getStoreMeta();
    if (res.ok) {
      const m: StoreMetaType = res.data;
      setAnnouncement(m.announcement ?? "");
      setContactPhone(m.contact_phone ?? "");
      setContactEmail(m.contact_email ?? "");
      setSocial({ ...EMPTY_SOCIAL, ...m.social_links });
      setFooterLinks(Array.isArray(m.footer_links) ? m.footer_links : []);
      setLogoUrl(m.logo_url ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    const cleanedSocial: StoreMetaSocialLinks = {
      instagram: social.instagram?.trim() || undefined,
      tiktok: social.tiktok?.trim() || undefined,
      facebook: social.facebook?.trim() || undefined,
      twitter: social.twitter?.trim() || undefined,
      youtube: social.youtube?.trim() || undefined,
    };
    const cleanedFooter: StoreMetaFooterLink[] = footerLinks
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label && l.url);
    const res = await updateStoreMeta({
      announcement: announcement.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      social_links: cleanedSocial,
      footer_links: cleanedFooter,
      logo_url: logoUrl,
    });
    setSaving(false);
    if (res.ok) {
      Alert.alert("Saved", "Storefront header & footer updated.");
    } else {
      Alert.alert("Save failed", res.error);
    }
  };

  const handleAddFooter = () => {
    if (footerLinks.length >= 8) {
      Alert.alert("Limit reached", "You can add up to 8 footer links.");
      return;
    }
    setFooterLinks((prev) => [...prev, { label: "", url: "" }]);
  };

  const handlePickLogo = async () => {
    if (!user) return;
    const picked = await pickImage({ aspect: [1, 1], quality: 0.85 });
    if (!picked || picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setUploadingLogo(true);
    // uploadAvatar targets the user-avatars bucket — the seller settings
    // already use this path for store logos (it persists avatar_url on
    // the user, which the header also surfaces). StoreMeta persists
    // logo_url on the store record via updateStoreMeta.
    const uploaded = await uploadAvatar(user.id, asset.uri, {
      mimeType: asset.mimeType ?? undefined,
      fileName: asset.fileName ?? undefined,
    });
    setUploadingLogo(false);
    if (uploaded.error || !uploaded.url) {
      Alert.alert("Upload failed", uploaded.error ?? "Could not upload logo");
      return;
    }
    setLogoUrl(uploaded.url);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator accessibilityLabel="Loading storefront meta" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Storefront header & footer</Text>
          <Text style={styles.subtitle}>
            Announcement bar, contact, social handles and footer links shown on your public storefront.
          </Text>

          {/* Logo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Logo</Text>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImg} />
                ) : (
                  <Ionicons name="image-outline" size={28} color={colors.light.mutedForeground} />
                )}
              </View>
              <TouchableOpacity
                style={styles.logoBtn}
                onPress={handlePickLogo}
                disabled={uploadingLogo}
              >
                <Text style={styles.logoBtnText}>
                  {uploadingLogo ? "Uploading..." : logoUrl ? "Replace logo" : "Upload logo"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Announcement */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Announcement bar</Text>
            <Text style={styles.fieldHint}>
              Short promo shown across the top of your storefront (max 240 chars).
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={announcement}
              onChangeText={(t) => setAnnouncement(t.slice(0, 240))}
              placeholder="e.g. Free shipping on orders over LKR 12,000."
              placeholderTextColor={colors.light.mutedForeground}
              multiline
              maxLength={240}
            />
            <Text style={styles.charCount}>{announcement.length}/240</Text>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="+94 77 123 4567"
              placeholderTextColor={colors.light.mutedForeground}
              keyboardType="phone-pad"
            />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="hello@studio.com"
              placeholderTextColor={colors.light.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Social */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social handles</Text>
            {SOCIAL_FIELDS.map((f) => (
              <View key={f.key} style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  value={social[f.key] ?? ""}
                  onChangeText={(t) => setSocial((s) => ({ ...s, [f.key]: t }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.light.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            ))}
          </View>

          {/* Footer links */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Footer links</Text>
              <TouchableOpacity onPress={handleAddFooter}>
                <Text style={styles.addBtnText}>+ Add link</Text>
              </TouchableOpacity>
            </View>
            {footerLinks.length === 0 ? (
              <Text style={styles.emptyText}>No footer links yet. Add up to 8.</Text>
            ) : (
              footerLinks.map((link, i) => (
                <View key={i} style={styles.footerRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={link.label}
                      onChangeText={(t) =>
                        setFooterLinks((prev) => prev.map((l, j) => (j === i ? { ...l, label: t } : l)))
                      }
                      placeholder="Label (e.g. About)"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                    <TextInput
                      style={[styles.input, { marginTop: 6 }]}
                      value={link.url}
                      onChangeText={(t) =>
                        setFooterLinks((prev) => prev.map((l, j) => (j === i ? { ...l, url: t } : l)))
                      }
                      placeholder="https://..."
                      placeholderTextColor={colors.light.mutedForeground}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() =>
                      setFooterLinks((prev) => prev.filter((_, j) => j !== i))
                    }
                    accessibilityLabel={`Remove footer link ${i + 1}`}
                  >
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "Saving..." : "Save changes"}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Silence unused-import lint while keeping the helper available for future
// navigation reuse (router uses it implicitly via the expo-router file
// conventions — the dynamic route segment is keyed at /settings/store-meta).
void getSellerStore;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },

  headerRow: { marginBottom: 8 },
  backButton: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium as any,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginBottom: 20,
    lineHeight: 20,
  },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  fieldGroup: { marginBottom: 12 },
  fieldLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  charCount: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    textAlign: "right",
    marginTop: 4,
  },
  emptyText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    paddingVertical: 12,
    textAlign: "center",
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
  },

  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: 64, height: 64 },
  logoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.light.primary,
    borderRadius: radii.lg,
  },
  logoBtnText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },

  addBtnText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium as any,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  removeBtn: {
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: radii.md,
    marginTop: 4,
  },

  saveButton: {
    backgroundColor: colors.light.primary,
    padding: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
  },
});