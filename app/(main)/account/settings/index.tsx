import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import {
  saveNotificationPrefs,
  type NotificationPreferenceKey,
  type NotificationPrefs,
} from "@/lib/api";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type PrivacyKey = "public_profile" | "personalized_picks" | "activity_status" | "block_tracking";

const DEFAULT_PRIVACY: Record<PrivacyKey, boolean> = {
  public_profile: true,
  personalized_picks: true,
  activity_status: false,
  block_tracking: false,
};

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  orders_email: true,
  orders_sms: false,
  orders_push: true,
  marketing_email: true,
  marketing_sms: false,
  marketing_push: false,
  social_email: true,
  social_push: true,
  security_email: true,
  security_sms: true,
  security_push: true,
};

const LOCALES = [
  { value: "en-LK", label: "English (LK)" },
  { value: "si-LK", label: "Sinhala" },
  { value: "ta-LK", label: "Tamil" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
];

const TIMEZONES = [
  { value: "Asia/Colombo", label: "Colombo" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Europe/London", label: "London" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
];

const CURRENCIES = [
  { value: "LKR", label: "LKR · Sri Lankan Rupee" },
  { value: "USD", label: "USD · US Dollar" },
  { value: "EUR", label: "EUR · Euro" },
  { value: "GBP", label: "GBP · British Pound" },
  { value: "SGD", label: "SGD · Singapore Dollar" },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locale, setLocale] = useState("en-LK");
  const [timezone, setTimezone] = useState("Asia/Colombo");
  const [currency, setCurrency] = useState("LKR");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState<Record<PrivacyKey, boolean>>(DEFAULT_PRIVACY);
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changePhoneOpen, setChangePhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const userEmail = user.email ?? "";
    let cancelled = false;

    async function load() {
      try {
        const [{ data: profile }, { data: prefs }] = await Promise.all([
          supabase.from("users").select("email, phone, locale, timezone, currency, metadata").eq("id", userId).maybeSingle(),
          supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
        ]);

        if (!cancelled) {
          setLocale(profile?.locale ?? "en-LK");
          setTimezone(profile?.timezone ?? "Asia/Colombo");
          setCurrency(profile?.currency ?? "LKR");
          setPhone(profile?.phone ?? "");
          setEmail(profile?.email ?? userEmail);
          if (profile?.metadata?.privacy) {
            setPrivacy((current) => ({ ...current, ...profile.metadata.privacy }));
          }
          setNotifications({
            ...DEFAULT_NOTIFICATIONS,
            ...(prefs ?? {}),
            orders_email: Boolean(prefs?.orders_email),
            orders_sms: Boolean(prefs?.orders_sms),
            orders_push: Boolean(prefs?.orders_push),
            marketing_email: Boolean(prefs?.marketing_email),
            marketing_sms: Boolean(prefs?.marketing_sms),
            marketing_push: Boolean(prefs?.marketing_push),
            social_email: Boolean(prefs?.social_email),
            social_push: Boolean(prefs?.social_push),
            security_email: Boolean(prefs?.security_email),
            security_sms: Boolean(prefs?.security_sms),
            security_push: Boolean(prefs?.security_push),
          });
        }
      } catch (error: any) {
        if (!cancelled) toast(error?.message ?? "Could not load settings", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, toast]);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const usersPatch: Record<string, string> = {
        locale,
        timezone,
        currency,
        phone,
        email,
      };
      const { error: settingsError } = await supabase.rpc("update_user_settings", { p_patch: usersPatch });
      if (settingsError) throw settingsError;

      const { error: privacyError } = await supabase.rpc("update_privacy_prefs", {
        p_patch: privacy,
      });
      if (privacyError) throw privacyError;

      const prefsRes = await saveNotificationPrefs(user.id, notifications);
      if (!prefsRes.ok) throw new Error(prefsRes.error);

      toast("Settings saved", "success");
    } catch (error: any) {
      toast(error?.message ?? "Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const requestEmailChange = async () => {
    if (!user?.id) return;
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(newEmail)) {
      toast("Enter a valid email", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast("Confirmation sent to both addresses", "success");
    setEmail(newEmail);
    setNewEmail("");
    setChangeEmailOpen(false);
  };

  const requestPhoneChange = async () => {
    if (!user?.id) return;
    if (!/^\+?[0-9\s-]{7,}$/.test(newPhone)) {
      toast("Enter a valid phone", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ phone: newPhone });
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast("Verification code sent", "success");
    setNewPhone("");
    setChangePhoneOpen(false);
  };

  const deleteAccount = async () => {
    if (!user?.id) return;
    if (deleteConfirm !== "DELETE") {
      toast("Type DELETE to confirm", "error");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ user_id: user.id }),
      }).catch(() => null);
      if (res && !res.ok) {
        const body = await res.text();
        throw new Error(body || "Account deletion failed");
      }
      toast("Account deletion requested", "success");
      await signOut();
    } catch (error: any) {
      // Fallback: mark deleted_at locally even if edge function not configured
      await supabase.from("users").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);
      toast("Account marked for deletion. Contact support to confirm.", "success");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const togglePrivacy = (key: PrivacyKey) => {
    setPrivacy((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleNotification = (key: NotificationPreferenceKey) => {
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Settings" />
        <View style={styles.loading}>
          <Body muted>Loading preferences…</Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="settings-outline" size={22} color={colors.light.primaryForeground} />
          </View>
          <Display size="2xl" style={styles.heroTitle}>Preferences</Display>
          <Body muted>Language, privacy, and how LUXE reaches you.</Body>
        </View>

        <Section title="Language & region">
          <Label style={styles.subLabel}>Locale</Label>
          <View style={styles.chipRow}>
            {LOCALES.map((item) => (
              <Chip key={item.value} selected={locale === item.value} onPress={() => setLocale(item.value)}>
                {item.label}
              </Chip>
            ))}
          </View>
          <Label style={[styles.subLabel, styles.subLabelTop]}>Timezone</Label>
          <View style={styles.chipRow}>
            {TIMEZONES.map((item) => (
              <Chip key={item.value} selected={timezone === item.value} onPress={() => setTimezone(item.value)}>
                {item.label}
              </Chip>
            ))}
          </View>
          <Label style={[styles.subLabel, styles.subLabelTop]}>Currency</Label>
          <View style={styles.chipRow}>
            {CURRENCIES.map((item) => (
              <Chip key={item.value} selected={currency === item.value} onPress={() => setCurrency(item.value)}>
                {item.label}
              </Chip>
            ))}
          </View>
        </Section>

        <Section title="Email & phone">
          <TouchableOpacity style={styles.commsRow} onPress={() => { setNewEmail(email); setChangeEmailOpen(true); }}>
            <View style={styles.commsIcon}><Ionicons name="mail-outline" size={16} color={colors.light.primary} /></View>
            <View style={{ flex: 1 }}>
              <Body size="sm" style={styles.commsLabel}>Email</Body>
              <Body muted size="xs">{email || "Add an email"}</Body>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.commsRow} onPress={() => { setNewPhone(phone); setChangePhoneOpen(true); }}>
            <View style={styles.commsIcon}><Ionicons name="call-outline" size={16} color={colors.light.primary} /></View>
            <View style={{ flex: 1 }}>
              <Body size="sm" style={styles.commsLabel}>Phone</Body>
              <Body muted size="xs">{phone || "Add a phone"}</Body>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        </Section>

        <Section title="Privacy">
          <ToggleRow
            label="Public profile"
            detail="Show your profile to stores and other members."
            value={privacy.public_profile}
            onValueChange={() => togglePrivacy("public_profile")}
          />
          <ToggleRow
            label="Personalized picks"
            detail="Use your activity to tailor product recommendations."
            value={privacy.personalized_picks}
            onValueChange={() => togglePrivacy("personalized_picks")}
          />
          <ToggleRow
            label="Activity status"
            detail="Let others see when you are browsing or active."
            value={privacy.activity_status}
            onValueChange={() => togglePrivacy("activity_status")}
          />
          <ToggleRow
            label="Block tracking"
            detail="Limit analytics used for personalization."
            value={privacy.block_tracking}
            onValueChange={() => togglePrivacy("block_tracking")}
          />
        </Section>

        <Section title="Notifications">
          <NotificationRow label="Orders" detail="Confirmations, shipping, delivery, and returns" prefix="orders" value={notifications} onToggle={toggleNotification} />
          <NotificationRow label="Marketing" detail="Drops, promos, and sale alerts" prefix="marketing" value={notifications} onToggle={toggleNotification} />
          <NotificationRow label="Social" detail="Reviews, replies, mentions, and review requests" prefix="social" value={notifications} onToggle={toggleNotification} />
          <NotificationRow label="Security" detail="Sign-ins, password changes, and MFA" prefix="security" value={notifications} onToggle={toggleNotification} />
        </Section>

        <View style={styles.danger}>
          <View style={styles.dangerHeader}>
            <View style={styles.dangerIcon}>
              <Ionicons name="warning-outline" size={16} color={colors.light.destructive} />
            </View>
            <View>
              <Label style={styles.dangerKicker}>Danger zone</Label>
              <Display size="lg" style={styles.dangerTitle}>Delete account</Display>
            </View>
          </View>
          <Body muted size="sm" style={styles.dangerCopy}>
            Permanently remove your account, orders history, saved addresses, and wishlist. This cannot be undone.
          </Body>
          <Button variant="destructive" onPress={() => setDeleteOpen(true)}>
            Request account deletion
          </Button>
        </View>

        <View style={styles.actions}>
          <Button variant="outline" onPress={() => Alert.alert("Help", "Contact support@luxe.com for any settings issues.")}>
            Help
          </Button>
          <Button loading={saving} onPress={save}>Save changes</Button>
        </View>
      </ScrollView>

      <Modal visible={changeEmailOpen} transparent animationType="fade" onRequestClose={() => setChangeEmailOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Label style={styles.modalKicker}>Email</Label>
                <Display size="lg">Change email</Display>
              </View>
              <TouchableOpacity onPress={() => setChangeEmailOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>
            <Body muted size="sm" style={styles.modalCopy}>
              We'll send a confirmation link to both your current and new email. The change takes effect once you click.
            </Body>
            <Field label="New email" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" icon="mail-outline" />
            <View style={styles.modalFooter}>
              <Button variant="outline" onPress={() => setChangeEmailOpen(false)}>Cancel</Button>
              <Button loading={saving} onPress={requestEmailChange}>Send confirmation</Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={changePhoneOpen} transparent animationType="fade" onRequestClose={() => setChangePhoneOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Label style={styles.modalKicker}>Phone</Label>
                <Display size="lg">Change phone</Display>
              </View>
              <TouchableOpacity onPress={() => setChangePhoneOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>
            <Body muted size="sm" style={styles.modalCopy}>
              We'll send a 6-digit code to your new number to confirm the change.
            </Body>
            <Field label="New phone" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" icon="call-outline" />
            <View style={styles.modalFooter}>
              <Button variant="outline" onPress={() => setChangePhoneOpen(false)}>Cancel</Button>
              <Button loading={saving} onPress={requestPhoneChange}>Send code</Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Label style={[styles.modalKicker, { color: colors.light.destructive }]}>Danger</Label>
                <Display size="lg">Delete account</Display>
              </View>
              <TouchableOpacity onPress={() => setDeleteOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>
            <Body muted size="sm" style={styles.modalCopy}>
              Type <Body size="sm" style={{ color: colors.light.destructive, fontFamily: fontFamilies.mono.semibold }}>DELETE</Body> to confirm. This is permanent.
            </Body>
            <TextInput
              style={styles.dangerInput}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              autoCapitalize="characters"
              placeholder="Type DELETE"
              placeholderTextColor={colors.light.mutedForeground}
            />
            <View style={styles.modalFooter}>
              <Button variant="outline" onPress={() => { setDeleteOpen(false); setDeleteConfirm(""); }}>Cancel</Button>
              <Button variant="destructive" loading={deleting} onPress={deleteAccount} disabled={deleteConfirm !== "DELETE"}>
                Delete account
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Display size="lg" style={styles.sectionTitle}>{title}</Display>
      {children}
    </View>
  );
}

function Chip({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Body size="xs" style={[styles.chipText, selected && styles.chipTextSelected]}>{children}</Body>
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "email-address" | "phone-pad" | "default";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>
        {icon ? <Ionicons name={icon} size={12} color={colors.light.mutedForeground} /> : null} {label}
      </Label>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

function ToggleRow({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onValueChange: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Body style={styles.toggleLabel}>{label}</Body>
        <Body muted size="xs">{detail}</Body>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.light.border, true: colors.light.primary }} thumbColor={colors.paper.cream} />
    </View>
  );
}

function NotificationRow({
  label,
  detail,
  prefix,
  value,
  onToggle,
}: {
  label: string;
  detail: string;
  prefix: "orders" | "marketing" | "social" | "security";
  value: NotificationPrefs;
  onToggle: (key: NotificationPreferenceKey) => void;
}) {
  const keys: NotificationPreferenceKey[] =
    prefix === "social"
      ? [`${prefix}_email`, `${prefix}_push`].flatMap((k) => k as NotificationPreferenceKey)
      : [`${prefix}_email`, `${prefix}_sms`, `${prefix}_push`].flatMap((k) => k as NotificationPreferenceKey);

  return (
    <View style={styles.notificationRow}>
      <View style={styles.notificationInfo}>
        <Body style={styles.toggleLabel}>{label}</Body>
        <Body muted size="xs">{detail}</Body>
      </View>
      <View style={styles.notificationSwitches}>
        {keys.map((key) => (
          <TouchableOpacity key={key} onPress={() => onToggle(key)} activeOpacity={0.8}>
            <Switch
              value={value[key]}
              trackColor={{ false: colors.light.border, true: colors.light.primary }}
              thumbColor={colors.paper.cream}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
    marginBottom: spacing[3],
  },
  heroTitle: { marginBottom: spacing[2] },
  section: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
  },
  sectionTitle: { marginBottom: spacing[4] },
  subLabel: {
    color: colors.light.mutedForeground,
    marginBottom: spacing[2],
  },
  subLabelTop: { marginTop: spacing[4] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chipSelected: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  chipText: { color: colors.light.foreground },
  chipTextSelected: { color: colors.light.primaryForeground },
  commsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  commsIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  commsLabel: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  field: { gap: 8, marginBottom: spacing[4] },
  fieldLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    color: colors.light.mutedForeground,
  },
  input: {
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontWeight: typography.fontWeights.semibold },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  notificationInfo: { flex: 1 },
  notificationSwitches: { flexDirection: "row", gap: 2 },
  danger: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 18,
    borderWidth: 1,
    borderColor: colors.light.destructive + "30",
    marginBottom: spacing[5],
    gap: spacing[3],
  },
  dangerHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dangerIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.destructive + "15",
  },
  dangerKicker: { color: colors.light.destructive, fontSize: 10 },
  dangerTitle: { marginTop: 2 },
  dangerCopy: { color: colors.light.mutedForeground },
  dangerInput: {
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.destructive + "40",
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: spacing[2],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[4],
  },
  modal: {
    width: "100%",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[3] },
  modalKicker: { color: colors.light.mutedForeground, marginBottom: 2 },
  modalCopy: { marginBottom: spacing[4] },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing[4],
  },
});
