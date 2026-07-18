import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Avatar, Button, Chip, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "expo-router";
import {
  saveNotificationPrefs,
  type NotificationPreferenceKey,
  type NotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
} from "@/lib/api";
import { readEvents, clearEvents, clearNotInterested } from "@/lib/recommender";
import {
  DEFAULT_LOCAL_PREFS,
  getLocalSettingsPrefs,
  setLocalSettingsPrefs,
  type LocalSettingsPrefs,
  type TextSize,
} from "@/lib/settings-prefs";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { safeOpenUrl } from "@/lib/utils/safe-open-url";
import { normalizePhoneE164 } from "@/lib/contact-validation";
import {
  changePasswordBackend,
  checkUniqueBackend,
  deleteAccountBackend,
  exportUserDataBackend,
  getSettingsBackend,
  updateSettingsBackend,
} from "@/lib/api/backend";

type PrivacyKey =
  | "public_profile"
  | "personalized_picks"
  | "activity_status"
  | "block_tracking"
  | "search_indexing";

const DEFAULT_PRIVACY: Record<PrivacyKey, boolean> = {
  public_profile: true,
  personalized_picks: true,
  activity_status: false,
  block_tracking: false,
  search_indexing: false,
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

const TEXT_SIZE_LABEL: Record<TextSize, string> = { sm: "Small", md: "Default", lg: "Large" };

const PRIVACY_DESCRIPTIONS: Record<PrivacyKey, { title: string; detail: string }> = {
  public_profile: {
    title: "Public profile",
    detail: "Show your profile to stores and other members.",
  },
  personalized_picks: {
    title: "Personalized picks",
    detail: "Use your activity to tailor product recommendations.",
  },
  activity_status: {
    title: "Activity status",
    detail: "Let others see when you are browsing or active.",
  },
  block_tracking: {
    title: "Block tracking",
    detail: "Limit analytics used for personalization.",
  },
  search_indexing: {
    title: "Search engine indexing",
    detail: "Allow your public profile to appear in search results.",
  },
};

type ServerSnapshot = {
  locale: string;
  timezone: string;
  currency: string;
  phone: string;
  email: string;
  privacy: Record<PrivacyKey, boolean>;
  notifications: NotificationPrefs;
};

export default function SettingsScreen() {
  const { user, signOut, role } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Server-side
  const [locale, setLocale] = useState("en-LK");
  const [timezone, setTimezone] = useState("Asia/Colombo");
  const [currency, setCurrency] = useState("LKR");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState<Record<PrivacyKey, boolean>>(DEFAULT_PRIVACY);
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  // Device-local
  const [local, setLocal] = useState<LocalSettingsPrefs>(DEFAULT_LOCAL_PREFS);

  // Recommendation data (event log + not-interested list)
  const [recEventCount, setRecEventCount] = useState<number>(0);
  const [recLoading, setRecLoading] = useState<boolean>(true);

  // Dirty tracking
  const initialSnapshot = useRef<string>("");
  const [dirty, setDirty] = useState(false);

  // Modals
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changePhoneOpen, setChangePhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  /* ------------------------------ load ------------------------------ */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const localPrefs = await getLocalSettingsPrefs();
        if (!cancelled) setLocal(localPrefs);

        // Load recommendation event count (guest + per-user).
        try {
          const events = await readEvents(user?.id ?? null);
          if (!cancelled) {
            setRecEventCount(events.length);
            setRecLoading(false);
          }
        } catch {
          if (!cancelled) setRecLoading(false);
        }

        if (!user?.id) {
          if (!cancelled) {
            initialSnapshot.current = JSON.stringify({
              locale: "en-LK",
              timezone: "Asia/Colombo",
              currency: "LKR",
              phone: "",
              email: user?.email ?? "",
              privacy: DEFAULT_PRIVACY,
              notifications: DEFAULT_NOTIFICATION_PREFS,
            } satisfies ServerSnapshot);
            setLoading(false);
          }
          return;
        }

        const userId = user.id;
        const userEmail = user.email ?? "";

        const [settingsRes, prefsRes] = await Promise.all([
          getSettingsBackend(),
          supabase
            .from("notification_preferences")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (!settingsRes.ok) {
          throw new Error(settingsRes.error ?? "Could not load settings");
        }
        const settings = settingsRes.data?.settings;
        const privacyFromServer = (settings?.privacy ?? {}) as Record<string, unknown>;
        const filteredPrivacy: Record<PrivacyKey, boolean> = { ...DEFAULT_PRIVACY };
        (Object.keys(DEFAULT_PRIVACY) as PrivacyKey[]).forEach((k) => {
          const v = privacyFromServer[k];
          if (typeof v === "boolean") filteredPrivacy[k] = v;
        });

        const next: ServerSnapshot = {
          locale: settings?.locale ?? "en-LK",
          timezone: settings?.timezone ?? "Asia/Colombo",
          currency: settings?.currency ?? "LKR",
          phone: settings?.phone ?? "",
          email: settings?.email ?? userEmail,
          privacy: filteredPrivacy,
          notifications: { ...DEFAULT_NOTIFICATION_PREFS, ...(prefsRes.data ?? {}) },
        };

        setLocale(next.locale);
        setTimezone(next.timezone);
        setCurrency(next.currency);
        setPhone(next.phone);
        setEmail(next.email);
        setPrivacy(next.privacy);
        setNotifications(next.notifications);
        initialSnapshot.current = JSON.stringify(next);
        setDirty(false);
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

  /* ----------------------------- derived --------------------------- */

  const snapshot = useMemo<ServerSnapshot>(
    () => ({ locale, timezone, currency, phone, email, privacy, notifications }),
    [locale, timezone, currency, phone, email, privacy, notifications]
  );

  useEffect(() => {
    if (loading) return;
    if (!initialSnapshot.current) {
      initialSnapshot.current = JSON.stringify(snapshot);
      return;
    }
    setDirty(JSON.stringify(snapshot) !== initialSnapshot.current);
  }, [snapshot, loading]);

  const togglePrivacy = (key: PrivacyKey) =>
    setPrivacy((current) => ({ ...current, [key]: !current[key] }));

  const toggleNotification = (key: NotificationPreferenceKey) =>
    setNotifications((current) => ({ ...current, [key]: !current[key] }));

  const updateLocal = async (patch: Partial<LocalSettingsPrefs>) => {
    const next = await setLocalSettingsPrefs(patch);
    setLocal(next);
  };

  /* ------------------------------ save ------------------------------ */

  const save = async () => {
    if (!user?.id) {
      initialSnapshot.current = JSON.stringify(snapshot);
      setDirty(false);
      toast("Local preferences saved", "success");
      return;
    }
    setSaving(true);
    try {
      const res = await updateSettingsBackend({
        locale,
        timezone,
        currency,
        phone,
        email,
        privacy,
        notifications,
      });
      if (!res.ok) throw new Error(res.error ?? "Could not save settings");

      const prefsRes = await saveNotificationPrefs(user.id, notifications);
      if (!prefsRes.ok) throw new Error(prefsRes.error);

      initialSnapshot.current = JSON.stringify(snapshot);
      setDirty(false);
      toast("Settings saved", "success");
    } catch (error: any) {
      toast(error?.message ?? "Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    try {
      const snap = JSON.parse(initialSnapshot.current) as ServerSnapshot;
      setLocale(snap.locale);
      setTimezone(snap.timezone);
      setCurrency(snap.currency);
      setPhone(snap.phone);
      setEmail(snap.email);
      setPrivacy(snap.privacy);
      setNotifications(snap.notifications);
    } catch {
      /* noop */
    }
  };

  /* ----------------------------- actions --------------------------- */

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
    const formatted = normalizePhoneE164(newPhone.trim());
    if (formatted === phone) {
      toast("That's already your number", "error");
      return;
    }

    setSaving(true);
    const unique = await checkUniqueBackend({ phone: formatted }, { requireAuth: true });
    if (!unique.ok) {
      setSaving(false);
      toast("Could not verify phone number", "error");
      return;
    }
    if (unique.data.phoneExists) {
      setSaving(false);
      toast("This number is linked to another account", "error");
      return;
    }

    const { error } = await supabase.auth.updateUser({ phone: formatted });
    setSaving(false);
    if (error) {
      toast(error.message ?? "Could not send verification code", "error");
      return;
    }
    setNewPhone(formatted);
    toast("Verification code sent", "success");
    setPhoneOtp("");
    setPhoneStep(2);
  };

  const verifyPhoneChange = async () => {
    if (!user?.id) return;
    if (!phoneOtp.trim()) {
      toast("Enter verification code", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizePhoneE164(newPhone),
        token: phoneOtp.trim(),
        type: "phone_change",
      });
      if (error) {
        toast(error.message, "error");
        return;
      }

      const formatted = normalizePhoneE164(newPhone);
      const res = await updateSettingsBackend({ phone: formatted });
      if (!res.ok) {
        toast("Verified, but could not sync profile", "error");
      }

      setPhone(formatted);
      initialSnapshot.current = JSON.stringify({ ...snapshot, phone: formatted });
      toast("Phone number linked successfully", "success");
      setChangePhoneOpen(false);
    } catch (error: any) {
      toast(error?.message ?? "Verification failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!user?.id) return;
    if (currentPwd.length < 8) {
      toast("Enter your current password", "error");
      return;
    }
    if (newPwd.length < 8) {
      toast("Use at least 8 characters", "error");
      return;
    }
    if (currentPwd === newPwd) {
      toast("New password must differ from current password", "error");
      return;
    }
    setSaving(true);
    const res = await changePasswordBackend({ currentPassword: currentPwd, newPassword: newPwd });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not update password", "error");
      return;
    }
    toast("Password updated", "success");
    setCurrentPwd("");
    setNewPwd("");
    setPasswordOpen(false);
  };

  const deleteAccount = async () => {
    if (!user?.id) return;
    if (deleteConfirm !== "DELETE") {
      toast("Type DELETE to confirm", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await deleteAccountBackend();
      if (!res.ok) {
        throw new Error(res.error ?? "Account deletion failed");
      }
      toast("Account deleted", "success");
      await signOut();
    } catch (error: any) {
      toast(error?.message ?? "Could not delete account", "error");
      setDeleteOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const clearCache = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const drop = keys.filter((k) => {
        if (!k.startsWith("luxe:")) return false;
        // Always keep these
        if (k.startsWith("luxe:local:settings")) return false;
        if (k.includes(":payments") || k.includes(":reviews")) return false;
        if (k.includes("recently_viewed")) return false;
        return true;
      });
      if (drop.length > 0) await AsyncStorage.multiRemove(drop);
      toast(
        `Cleared ${drop.length} cached item${drop.length === 1 ? "" : "s"}`,
        "success"
      );
    } catch (error: any) {
      toast(error?.message ?? "Could not clear cache", "error");
    }
  };

  const clearRecData = async () => {
    try {
      await clearEvents(user?.id ?? null);
      await clearNotInterested(user?.id ?? null);
      setRecEventCount(0);
      toast("Recommendation data cleared", "success");
    } catch (error: any) {
      toast(error?.message ?? "Could not clear recommendation data", "error");
    }
  };

  const exportData = async () => {
    if (!user?.id) {
      toast("Sign in to export your data", "info");
      return;
    }
    try {
      const res = await exportUserDataBackend();
      if (!res.ok) {
        throw new Error(res.error ?? "Export failed");
      }
      const message = `LUXE data export\n\n${JSON.stringify(res.data, null, 2)}`;
      if (Platform.OS === "ios" || Platform.OS === "android") {
        await Share.share({ message, title: "LUXE data export" });
      } else {
        await safeOpenUrl(
          `mailto:support@luxe.com?subject=LUXE%20Data%20Export&body=${encodeURIComponent(message)}`
        );
      }
    } catch (error: any) {
      toast(error?.message ?? "Export failed", "error");
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  /* ----------------------------- derived --------------------------- */

  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Guest";
  const avatarUri = user?.user_metadata?.avatar_url as string | undefined;

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const buildNumber =
    (Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString()) ?? "—";

  const linkedProviders = useMemo(() => {
    const providers = (user?.app_metadata?.providers ?? []) as string[];
    return {
      email: providers.includes("email") || !!user?.email,
      google: providers.includes("google"),
      apple: providers.includes("apple"),
      facebook: providers.includes("facebook"),
    };
  }, [user]);

  /* ------------------------------ render --------------------------- */

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
      <ScreenHeader
        title="Settings"
        right={
          <TouchableOpacity onPress={handleSignOut} style={styles.headerIcon} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.hero}>
          <Avatar name={name} uri={avatarUri} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Display size="xl" numberOfLines={1}>
              {name}
            </Display>
            <Body muted size="sm" numberOfLines={1}>
              {email || "Not signed in"}
            </Body>
            <View style={styles.rolePill}>
              <Label style={styles.rolePillText}>{role.toUpperCase()}</Label>
            </View>
          </View>
        </View>

        {/* LANGUAGE & REGION */}
        <Section
          kicker="01"
          title="Language & region"
          subtitle="How LUXE adapts prices, dates, and copy."
        >
          <Label style={styles.subLabel}>Locale</Label>
          <ChipRow>
            {LOCALES.map((item) => (
              <Chip
                key={item.value}
                selected={locale === item.value}
                onPress={() => setLocale(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </ChipRow>

          <Label style={[styles.subLabel, styles.subLabelTop]}>Timezone</Label>
          <ChipRow>
            {TIMEZONES.map((item) => (
              <Chip
                key={item.value}
                selected={timezone === item.value}
                onPress={() => setTimezone(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </ChipRow>

          <Label style={[styles.subLabel, styles.subLabelTop]}>Currency</Label>
          <ChipRow>
            {CURRENCIES.map((item) => (
              <Chip
                key={item.value}
                selected={currency === item.value}
                onPress={() => setCurrency(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </ChipRow>
        </Section>

        {/* APPEARANCE */}
        <Section
          kicker="02"
          title="Appearance"
          subtitle="Display preferences on this device."
        >
          <Label style={styles.subLabel}>Text size</Label>
          <ChipRow>
            {(["sm", "md", "lg"] as TextSize[]).map((size) => (
              <Chip
                key={size}
                selected={local.textSize === size}
                onPress={() => updateLocal({ textSize: size })}
              >
                {TEXT_SIZE_LABEL[size]}
              </Chip>
            ))}
          </ChipRow>

          <ToggleRow
            label="Reduce motion"
            detail="Minimize transitions and parallax effects."
            value={local.reduceMotion}
            onValueChange={() => updateLocal({ reduceMotion: !local.reduceMotion })}
            isLast
          />
        </Section>

        {/* EMAIL & PHONE */}
        <Section kicker="03" title="Email & phone" subtitle="How we verify it's you.">
          <CommsRow
            icon="mail-outline"
            label="Email"
            value={email || "Add an email"}
            onPress={() => {
              setNewEmail(email);
              setChangeEmailOpen(true);
            }}
          />
          <CommsRow
            icon="call-outline"
            label="Phone"
            value={phone || "Add a phone"}
            onPress={() => {
              setNewPhone(phone);
              setPhoneOtp("");
              setPhoneStep(1);
              setChangePhoneOpen(true);
            }}
            isLast
          />
        </Section>

        {/* PRIVACY */}
        <Section
          kicker="04"
          title="Privacy"
          subtitle="Control what others — and our systems — can see."
        >
          {(Object.keys(PRIVACY_DESCRIPTIONS) as PrivacyKey[]).map((key, idx, arr) => (
            <ToggleRow
              key={key}
              label={PRIVACY_DESCRIPTIONS[key].title}
              detail={PRIVACY_DESCRIPTIONS[key].detail}
              value={privacy[key]}
              onValueChange={() => togglePrivacy(key)}
              isLast={idx === arr.length - 1}
            />
          ))}
        </Section>

        {/* SECURITY */}
        <Section
          kicker="05"
          title="Security"
          subtitle="Lock the app and keep an eye on sign-ins."
        >
          <ToggleRow
            label="Require biometrics on launch"
            detail="Use Face ID / fingerprint to open LUXE."
            value={local.biometricLock}
            onValueChange={() => updateLocal({ biometricLock: !local.biometricLock })}
          />
          <CommsRow
            icon="key-outline"
            label="Change password"
            value="••••••••"
            onPress={() => setPasswordOpen(true)}
          />
          <CommsRow
            icon="shield-checkmark-outline"
            label="Two-factor authentication"
            value="Not configured"
            onPress={() => router.push("/(main)/account/security")}
            isLast
          />
        </Section>

        {/* NOTIFICATIONS */}
        <Section
          kicker="06"
          title="Notifications"
          subtitle="Pick how each topic reaches you."
        >
          <View style={styles.notifHeader}>
            <View style={{ flex: 1 }} />
            <Label style={styles.notifChannel}>Email</Label>
            <Label style={styles.notifChannel}>SMS</Label>
            <Label style={styles.notifChannel}>Push</Label>
          </View>
          <NotificationRow
            label="Orders"
            detail="Confirmations, shipping, delivery, and returns"
            prefix="orders"
            value={notifications}
            onToggle={toggleNotification}
          />
          <NotificationRow
            label="Marketing"
            detail="Drops, promos, and sale alerts"
            prefix="marketing"
            value={notifications}
            onToggle={toggleNotification}
          />
          <NotificationRow
            label="Social"
            detail="Reviews, replies, mentions, and review requests"
            prefix="social"
            value={notifications}
            onToggle={toggleNotification}
            channels={["email", "push"]}
          />
          <NotificationRow
            label="Security"
            detail="Sign-ins, password changes, and MFA"
            prefix="security"
            value={notifications}
            onToggle={toggleNotification}
            isLast
          />
        </Section>

        {/* CONNECTED ACCOUNTS */}
        <Section kicker="07" title="Connected accounts" subtitle="Single sign-on providers.">
          <ProviderRow icon="logo-google" label="Google" linked={linkedProviders.google} />
          <ProviderRow icon="logo-apple" label="Apple" linked={linkedProviders.apple} />
          <ProviderRow
            icon="logo-facebook"
            label="Facebook"
            linked={linkedProviders.facebook}
            isLast
          />
        </Section>

        {/* DATA & STORAGE */}
        <Section
          kicker="08"
          title="Data & storage"
          subtitle="Your data lives in Supabase. Download or wipe local cache here."
        >
          <CommsRow
            icon="download-outline"
            label="Export my data"
            value="JSON via share sheet"
            onPress={exportData}
          />
          <CommsRow
            icon="sparkles-outline"
            label="Recommendation data"
            value={
              recLoading
                ? "Loading…"
                : recEventCount > 0
                  ? `${recEventCount} event${recEventCount === 1 ? "" : "s"} tracked`
                  : "No activity yet"
            }
            onPress={
              recEventCount > 0
                ? () =>
                    Alert.alert(
                      "Clear recommendation data?",
                      "This resets the personalized picks on home, product, and search. Recently viewed stays.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Clear", style: "destructive", onPress: clearRecData },
                      ]
                    )
                : undefined
            }
          />
          <CommsRow
            icon="trash-outline"
            label="Clear local cache"
            value="Keeps payments & recent"
            onPress={() =>
              Alert.alert("Clear cache?", "This wipes cached sessions on this device.", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: clearCache },
              ])
            }
            isLast
          />
        </Section>

        {/* LEGAL & ABOUT */}
        <Section kicker="09" title="Legal & about" subtitle="Policies, licences, and build info.">
          <CommsRow
            icon="document-text-outline"
            label="Terms of service"
            value=""
            onPress={() => safeOpenUrl("https://luxe.com/terms")}
          />
          <CommsRow
            icon="lock-closed-outline"
            label="Privacy policy"
            value=""
            onPress={() => safeOpenUrl("https://luxe.com/privacy")}
          />
          <CommsRow
            icon="information-circle-outline"
            label="Open-source licences"
            value=""
            onPress={() => safeOpenUrl("https://luxe.com/licences")}
          />
          <View style={styles.versionRow}>
            <Label style={styles.versionLabel}>App version</Label>
            <Body size="sm" style={styles.versionValue}>
              {appVersion} ({buildNumber})
            </Body>
          </View>
        </Section>

        {/* DANGER ZONE */}
        <View style={styles.danger}>
          <View style={styles.dangerHeader}>
            <View style={styles.dangerIcon}>
              <Ionicons name="warning-outline" size={16} color={colors.light.destructive} />
            </View>
            <View>
              <Label style={styles.dangerKicker}>Danger zone</Label>
              <Display size="lg" style={styles.dangerTitle}>
                Delete account
              </Display>
            </View>
          </View>
          <Body muted size="sm" style={styles.dangerCopy}>
            Permanently remove your account, orders history, saved addresses, and wishlist.
            This cannot be undone.
          </Body>
          <Button variant="destructive" onPress={() => setDeleteOpen(true)}>
            Request account deletion
          </Button>
        </View>

        <Body muted size="xs" style={styles.footerHint}>
          LUXE · Crafted for collectors
        </Body>
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.saveBarInner}>
          {dirty ? (
            <Body size="sm" style={styles.dirtyText}>
              Unsaved changes
            </Body>
          ) : (
            <Body muted size="sm">
              All changes saved
            </Body>
          )}
          <View style={styles.saveBarActions}>
            {dirty ? (
              <Button variant="ghost" size="sm" onPress={discard}>
                Discard
              </Button>
            ) : null}
            <Button size="sm" loading={saving} onPress={save} disabled={!dirty && !!user?.id}>
              Save changes
            </Button>
          </View>
        </View>
      </View>

      {/* Modals */}
      <CenteredModal
        visible={changeEmailOpen}
        onClose={() => setChangeEmailOpen(false)}
        kicker="Email"
        title="Change email"
        copy="We'll send a confirmation link to both your current and new email. The change takes effect once you click."
      >
        <Field
          label="New email"
          icon="mail-outline"
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType="email-address"
        />
        <View style={styles.modalFooter}>
          <Button variant="outline" onPress={() => setChangeEmailOpen(false)}>
            Cancel
          </Button>
          <Button loading={saving} onPress={requestEmailChange}>
            Send confirmation
          </Button>
        </View>
      </CenteredModal>

      <CenteredModal
        visible={changePhoneOpen}
        onClose={() => setChangePhoneOpen(false)}
        kicker="Phone"
        title={phoneStep === 1 ? "Change phone" : "Verify code"}
        copy={
          phoneStep === 1
            ? "We'll send a 6-digit code to your new number to confirm the change."
            : `Enter the code we sent to ${newPhone}.`
        }
      >
        {phoneStep === 1 ? (
          <Field
            label="New phone"
            icon="call-outline"
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
          />
        ) : (
          <Field
            label="Verification code"
            icon="key-outline"
            value={phoneOtp}
            onChangeText={setPhoneOtp}
            keyboardType="number-pad"
          />
        )}
        <View style={styles.modalFooter}>
          {phoneStep === 2 && (
            <Button
              variant="outline"
              onPress={() => setPhoneStep(1)}
              style={{ marginRight: "auto" }}
            >
              Back
            </Button>
          )}
          <Button variant="outline" onPress={() => setChangePhoneOpen(false)}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onPress={phoneStep === 1 ? requestPhoneChange : verifyPhoneChange}
          >
            {phoneStep === 1 ? "Send code" : "Verify"}
          </Button>
        </View>
      </CenteredModal>

      <CenteredModal
        visible={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          setCurrentPwd("");
          setNewPwd("");
        }}
        kicker="Security"
        title="Change password"
        copy="Use at least 8 characters. We re-verify your current password to confirm it's really you."
      >
        <Field
          label="Current password"
          icon="lock-closed-outline"
          value={currentPwd}
          onChangeText={setCurrentPwd}
          secureTextEntry
          autoComplete="password"
        />
        <Field
          label="New password"
          icon="lock-closed-outline"
          value={newPwd}
          onChangeText={setNewPwd}
          secureTextEntry
          autoComplete="password-new"
        />
        <View style={styles.modalFooter}>
          <Button
            variant="outline"
            onPress={() => {
              setPasswordOpen(false);
              setCurrentPwd("");
              setNewPwd("");
            }}
          >
            Cancel
          </Button>
          <Button loading={saving} onPress={changePassword} disabled={currentPwd.length < 8 || newPwd.length < 8}>
            Update password
          </Button>
        </View>
      </CenteredModal>

      <CenteredModal
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        kicker="Danger"
        kickerColor={colors.light.destructive}
        title="Delete account"
        copy={
          <Body muted size="sm" style={styles.modalCopy}>
            Type{" "}
            <Body
              size="sm"
              style={{ color: colors.light.destructive, fontFamily: fontFamilies.mono.semibold }}
            >
              DELETE
            </Body>{" "}
            to confirm. This is permanent.
          </Body>
        }
      >
        <TextInput
          style={styles.dangerInput}
          value={deleteConfirm}
          onChangeText={setDeleteConfirm}
          autoCapitalize="characters"
          placeholder="Type DELETE"
          placeholderTextColor={colors.light.mutedForeground}
        />
        <View style={styles.modalFooter}>
          <Button
            variant="outline"
            onPress={() => {
              setDeleteOpen(false);
              setDeleteConfirm("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={saving}
            onPress={deleteAccount}
            disabled={deleteConfirm !== "DELETE"}
          >
            Delete account
          </Button>
        </View>
      </CenteredModal>
    </SafeAreaView>
  );
}

/* ----------------------------- subcomponents ----------------------------- */

function Section({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {kicker ? <Label style={styles.sectionKicker}>{kicker}</Label> : null}
        <View style={{ flex: 1 }}>
          <Display size="lg">{title}</Display>
          {subtitle ? (
            <Body muted size="sm" style={styles.sectionSubtitle}>
              {subtitle}
            </Body>
          ) : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function CommsRow({
  icon,
  label,
  value,
  onPress,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  if (!onPress) {
    return (
      <View style={[styles.commsRow, isLast && styles.commsRowLast]}>
        <View style={styles.commsIcon}>
          <Ionicons name={icon} size={16} color={colors.light.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Body size="sm" style={styles.commsLabel}>
            {label}
          </Body>
          <Body muted size="xs" numberOfLines={1}>
            {value || "—"}
          </Body>
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.commsRow, isLast && styles.commsRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.commsIcon}>
        <Ionicons name={icon} size={16} color={colors.light.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Body size="sm" style={styles.commsLabel}>
          {label}
        </Body>
        <Body muted size="xs" numberOfLines={1}>
          {value || "—"}
        </Body>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  icon,
  secureTextEntry,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "email-address" | "phone-pad" | "number-pad" | "default";
  icon?: keyof typeof Ionicons.glyphMap;
  secureTextEntry?: boolean;
  autoComplete?: "password" | "password-new";
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>
        {icon ? <Ionicons name={icon} size={12} color={colors.light.mutedForeground} /> : null}{" "}
        {label}
      </Label>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoComplete={autoComplete}
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
  isLast = false,
}: {
  label: string;
  detail: string;
  value: boolean;
  onValueChange: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, isLast && styles.toggleRowLast]}>
      <View style={styles.toggleInfo}>
        <Body style={styles.toggleLabel}>{label}</Body>
        <Body muted size="xs">
          {detail}
        </Body>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.light.border, true: colors.light.primary }}
        thumbColor={colors.paper.cream}
      />
    </View>
  );
}

function NotificationRow({
  label,
  detail,
  prefix,
  value,
  onToggle,
  channels,
  isLast = false,
}: {
  label: string;
  detail: string;
  prefix: "orders" | "marketing" | "social" | "security";
  value: NotificationPrefs;
  onToggle: (key: NotificationPreferenceKey) => void;
  channels?: Array<"email" | "sms" | "push">;
  isLast?: boolean;
}) {
  const activeChannels: Array<"email" | "sms" | "push"> = channels ?? ["email", "sms", "push"];
  return (
    <View style={[styles.notificationRow, isLast && styles.notificationRowLast]}>
      <View style={styles.notificationInfo}>
        <Body style={styles.toggleLabel}>{label}</Body>
        <Body muted size="xs">
          {detail}
        </Body>
      </View>
      <View style={styles.notificationSwitches}>
        {activeChannels.map((channel) => {
          const key = `${prefix}_${channel}` as NotificationPreferenceKey;
          return (
            <TouchableOpacity
              key={channel}
              onPress={() => onToggle(key)}
              activeOpacity={0.8}
              style={styles.notificationSwitchWrap}
            >
              <Switch
                value={value[key]}
                trackColor={{ false: colors.light.border, true: colors.light.primary }}
                thumbColor={colors.paper.cream}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ProviderRow({
  icon,
  label,
  linked,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  linked: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.providerRow, isLast && styles.providerRowLast]}>
      <View style={styles.commsIcon}>
        <Ionicons name={icon} size={16} color={colors.light.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Body size="sm" style={styles.commsLabel}>
          {label}
        </Body>
        <Body muted size="xs">
          {linked ? "Connected" : "Not connected"}
        </Body>
      </View>
      {linked ? (
        <View style={styles.linkedDot}>
          <Ionicons name="checkmark" size={12} color={colors.light.primaryForeground} />
        </View>
      ) : (
        <Body size="xs" style={styles.linkAction}>
          Link
        </Body>
      )}
    </View>
  );
}

function CenteredModal({
  visible,
  onClose,
  kicker,
  kickerColor,
  title,
  copy,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  kicker?: string;
  kickerColor?: string;
  title: string;
  copy: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalBackdrop}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              {kicker ? (
                <Label style={[styles.modalKicker, kickerColor ? { color: kickerColor } : null]}>
                  {kicker}
                </Label>
              ) : null}
              <Display size="lg">{title}</Display>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>
          {typeof copy === "string" ? (
            <Body muted size="sm" style={styles.modalCopy}>
              {copy}
            </Body>
          ) : (
            copy
          )}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* --------------------------------- styles --------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5] },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
    ...shadows.soft,
  },
  rolePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
    marginTop: 4,
  },
  rolePillText: {
    color: colors.olive[800],
    fontSize: 9,
    letterSpacing: typography.letterSpacing.widest,
  },

  section: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
    ...shadows.soft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  sectionKicker: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.regular,
    marginTop: 6,
  },
  sectionSubtitle: { marginTop: 4 },
  sectionBody: { gap: spacing[3] },

  subLabel: {
    color: colors.light.mutedForeground,
    marginBottom: spacing[2],
  },
  subLabelTop: { marginTop: spacing[2] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  commsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  commsRowLast: { borderBottomWidth: 0 },
  commsIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  commsLabel: {
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.foreground,
  },

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
  toggleRowLast: { borderBottomWidth: 0 },
  toggleInfo: { flex: 1, paddingRight: spacing[2] },
  toggleLabel: { fontWeight: typography.fontWeights.semibold },

  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  notifChannel: {
    width: 50,
    textAlign: "center",
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.regular,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  notificationRowLast: { borderBottomWidth: 0 },
  notificationInfo: { flex: 1, paddingRight: spacing[2] },
  notificationSwitches: { flexDirection: "row", alignItems: "center" },
  notificationSwitchWrap: { width: 50, alignItems: "center" },

  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  providerRowLast: { borderBottomWidth: 0 },
  linkedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  linkAction: {
    color: colors.light.primary,
    fontWeight: typography.fontWeights.semibold,
  },

  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing[3],
  },
  versionLabel: { color: colors.light.mutedForeground },
  versionValue: {
    fontFamily: fontFamilies.mono.regular,
    color: colors.light.foreground,
  },

  danger: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
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
    marginBottom: spacing[2],
  },

  footerHint: { textAlign: "center", marginTop: spacing[2] },

  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.light.card,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingHorizontal: spacing[5],
    paddingTop: 10,
  },
  saveBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  saveBarActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  dirtyText: {
    color: colors.accent2.rust,
    fontWeight: typography.fontWeights.semibold,
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[3],
  },
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
    marginTop: spacing[2],
  },
});
