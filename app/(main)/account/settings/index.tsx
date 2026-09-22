import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { Avatar, Button, useToast } from "@/components/ui";
import { Body, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "expo-router";
import {
  getNotificationPrefs,
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
} from "@/lib/settings-prefs";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { safeOpenUrl } from "@/lib/utils/safe-open-url";
import { normalizePhoneE164 } from "@/lib/contact-validation";
import {
  changePasswordBackend,
  checkUniqueBackend,
  deleteAccountBackend,
  deactivateAccountBackend,
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

/** Where guest (signed-out) preferences are kept so they survive relaunch. */
const GUEST_SETTINGS_KEY = "luxe:local:guest-settings";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState("");

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
          // Guests keep their region/privacy choices on-device so the
          // controls still mean something after relaunch.
          let guest: ServerSnapshot = {
            locale: "en-LK",
            timezone: "Asia/Colombo",
            currency: "LKR",
            phone: "",
            email: "",
            privacy: DEFAULT_PRIVACY,
            notifications: DEFAULT_NOTIFICATION_PREFS,
          };
          try {
            const raw = await AsyncStorage.getItem(GUEST_SETTINGS_KEY);
            if (raw) {
              const stored = JSON.parse(raw) as Partial<ServerSnapshot>;
              guest = {
                ...guest,
                ...stored,
                privacy: { ...DEFAULT_PRIVACY, ...(stored.privacy ?? {}) },
                notifications: {
                  ...DEFAULT_NOTIFICATION_PREFS,
                  ...(stored.notifications ?? {}),
                },
              };
            }
          } catch {
            /* fall back to defaults */
          }
          if (!cancelled) {
            setLocale(guest.locale);
            setTimezone(guest.timezone);
            setCurrency(guest.currency);
            setPrivacy(guest.privacy);
            setNotifications(guest.notifications);
            initialSnapshot.current = JSON.stringify(guest);
            setLoadError(null);
            setLoading(false);
          }
          return;
        }

        const userEmail = user.email ?? "";

        const [settingsRes, prefsRes] = await Promise.all([
          getSettingsBackend(),
          getNotificationPrefs(user.id),
        ]);

        if (cancelled) return;

        if (!settingsRes.ok) {
          throw new Error(settingsRes.error ?? "Could not load settings");
        }
        if (!prefsRes.ok) {
          throw new Error(prefsRes.error ?? "Could not load notification preferences");
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
          notifications: { ...DEFAULT_NOTIFICATION_PREFS, ...prefsRes.data },
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
        setLoadError(null);
      } catch (error: any) {
        if (!cancelled) setLoadError(error?.message ?? "Could not load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, loadAttempt]);

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
      try {
        await AsyncStorage.setItem(GUEST_SETTINGS_KEY, JSON.stringify(snapshot));
        initialSnapshot.current = JSON.stringify(snapshot);
        setDirty(false);
        toast("Preferences saved on this device", "success");
      } catch {
        toast("Could not save preferences", "error");
      }
      return;
    }
    setSaving(true);
    try {
      const res = await updateSettingsBackend({
        locale,
        timezone,
        currency,
        email,
        ...(phone ? { phone } : {}),
        privacy,
      });
      if (!res.ok) throw new Error(res.error ?? "Could not save settings");

      const prefsRes = await saveNotificationPrefs(user.id, notifications);
      if (!prefsRes.ok) throw new Error(prefsRes.error ?? "Could not save notification preferences");

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

  const requireAuth = () => {
    if (user?.id) return true;
    toast("Sign in to manage your account", "info");
    return false;
  };

  const requestEmailChange = async () => {
    if (!requireAuth()) return;
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
    // The address only changes once the confirmation link is clicked —
    // keep displaying the current one until then.
    toast("Confirmation sent — click the link in your inbox to finish", "success");
    setNewEmail("");
    setChangeEmailOpen(false);
  };

  const requestPhoneChange = async () => {
    if (!requireAuth()) return;
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
    if (!requireAuth()) return;
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
    if (!requireAuth()) return;
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
    if (!requireAuth()) return;
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

  const rawName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "";
  const name = rawName || "Patron";
  const avatarUri = user?.user_metadata?.avatar_url as string | undefined;

  const initials = useMemo(() => {
    if (!name || name === "Patron" || name === "Guest") return "";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

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
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#141311" />
          </TouchableOpacity>
          <View style={styles.headerTitleCenter}>
            <Text style={styles.headerEyebrow}>SYSTEM & PROFILE</Text>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color="#C8A44A" size="large" />
          <Text style={styles.loadingText}>Synchronizing patron preferences…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#141311" />
          </TouchableOpacity>
          <View style={styles.headerTitleCenter}>
            <Text style={styles.headerEyebrow}>SYSTEM & PROFILE</Text>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loading}>
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="cloud-offline-outline" size={22} color="#85651B" />
            </View>
            <Text style={styles.errorTitle}>Couldn&apos;t load settings</Text>
            <Text style={styles.errorCopy} numberOfLines={3}>
              {loadError}
            </Text>
            <TouchableOpacity
              style={styles.errorRetry}
              onPress={() => setLoadAttempt((n) => n + 1)}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={14} color="#FAF8F5" />
              <Text style={styles.errorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 1. Atelier Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="#141311" />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerEyebrow}>SYSTEM & PROFILE</Text>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <TouchableOpacity
          onPress={handleSignOut}
          style={styles.logoutButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="log-out-outline" size={18} color="#85651B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Velvet Obsidian Hero Card */}
        <LinearGradient
          colors={["#191815", "#24221C", "#12110F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTagBadge}>
              <Ionicons name="sparkles" size={10} color="#C8A44A" />
              <Text style={styles.heroTagText}>ATELIER PATRON PREFERENCES</Text>
            </View>
            <View style={styles.heroSyncBadge}>
              <View style={[styles.heroSyncDot, dirty && styles.heroSyncDotDirty]} />
              <Text style={[styles.heroSyncText, dirty && styles.heroSyncTextDirty]}>
                {dirty ? "MODIFIED" : "SYNCHRONIZED"}
              </Text>
            </View>
          </View>

          <View style={styles.heroProfileRow}>
            <View style={styles.avatarBezel}>
              {avatarUri ? (
                <Avatar name={name} uri={avatarUri} size={56} />
              ) : initials ? (
                <View style={styles.monogramFallback}>
                  <Text style={styles.monogramText}>{initials}</Text>
                </View>
              ) : (
                <View style={styles.monogramFallback}>
                  <Ionicons name="person" size={22} color="#E8CF8F" />
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.heroNameText} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.heroEmailText} numberOfLines={1}>
                {email || "Private Client · Not signed in"}
              </Text>
              <View style={styles.rolePill}>
                <View style={styles.roleDot} />
                <Text style={styles.rolePillText}>
                  {role ? role.toUpperCase() : "PATRON"}
                </Text>
              </View>
            </View>
          </View>

          {/* Micro Atelier Status Strip */}
          <View style={styles.heroStatusStrip}>
            <View style={styles.heroStatusItem}>
              <Text style={styles.heroStatusLabel}>MEMBERSHIP</Text>
              <Text style={styles.heroStatusVal}>Atelier Select</Text>
            </View>
            <View style={styles.heroStatusDivider} />
            <View style={styles.heroStatusItem}>
              <Text style={styles.heroStatusLabel}>SECURITY</Text>
              <Text style={styles.heroStatusVal}>End-to-End</Text>
            </View>
            <View style={styles.heroStatusDivider} />
            <View style={styles.heroStatusItem}>
              <Text style={styles.heroStatusLabel}>BUILD</Text>
              <Text style={styles.heroStatusVal}>v{appVersion}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* LANGUAGE & REGION */}
        <Section
          kicker="01"
          title="Language & region"
          subtitle="How LUXE adapts prices, dates, and copy."
        >
          <Text style={styles.subLabel}>LOCALE</Text>
          <ChipRow>
            {LOCALES.map((item) => (
              <SettingChip
                key={item.value}
                selected={locale === item.value}
                onPress={() => setLocale(item.value)}
              >
                {item.label}
              </SettingChip>
            ))}
          </ChipRow>

          <Text style={[styles.subLabel, styles.subLabelTop]}>TIMEZONE</Text>
          <ChipRow>
            {TIMEZONES.map((item) => (
              <SettingChip
                key={item.value}
                selected={timezone === item.value}
                onPress={() => setTimezone(item.value)}
              >
                {item.label}
              </SettingChip>
            ))}
          </ChipRow>

          <Text style={[styles.subLabel, styles.subLabelTop]}>CURRENCY</Text>
          <ChipRow>
            {CURRENCIES.map((item) => (
              <SettingChip
                key={item.value}
                selected={currency === item.value}
                onPress={() => setCurrency(item.value)}
              >
                {item.label}
              </SettingChip>
            ))}
          </ChipRow>
        </Section>

        {/* EMAIL & PHONE */}
        <Section kicker="02" title="Email & phone" subtitle="How we verify it's you.">
          <CommsRow
            icon="mail-outline"
            label="Email"
            value={email || "Add an email"}
            onPress={() => {
              if (!requireAuth()) return;
              setNewEmail(email);
              setChangeEmailOpen(true);
            }}
          />
          <CommsRow
            icon="call-outline"
            label="Phone"
            value={phone || "Add a phone"}
            onPress={() => {
              if (!requireAuth()) return;
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
          kicker="03"
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
          kicker="04"
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
            onPress={() => {
              if (!requireAuth()) return;
              setPasswordOpen(true);
            }}
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
          kicker="05"
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
        <Section kicker="06" title="Connected accounts" subtitle="Single sign-on providers.">
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
          kicker="07"
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
        <Section kicker="08" title="Legal & about" subtitle="Policies, licences, and build info.">
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

        {/* DEACTIVATE (reversible) */}
        <View style={styles.deactivateCard}>
          <View style={styles.deactivateHeader}>
            <View style={styles.deactivateIcon}>
              <Ionicons name="pause-circle-outline" size={18} color="#85651B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deactivateKicker}>TAKE A BREAK</Text>
              <Text style={styles.deactivateTitle}>Deactivate account</Text>
            </View>
          </View>
          <Text style={styles.deactivateCopy}>
            Hide your profile and pause new orders. Sign back in any time to reactivate.
          </Text>
          <TouchableOpacity
            style={styles.deactivateButton}
            onPress={() => {
              if (!requireAuth()) return;
              setDeactivateOpen(true);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.deactivateButtonText}>Deactivate account</Text>
          </TouchableOpacity>
        </View>

        {/* DANGER ZONE */}
        <View style={styles.danger}>
          <View style={styles.dangerHeader}>
            <View style={styles.dangerIcon}>
              <Ionicons name="warning-outline" size={18} color={colors.light.destructive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerKicker}>DANGER ZONE</Text>
              <Text style={styles.dangerTitle}>Delete account</Text>
            </View>
          </View>
          <Text style={styles.dangerCopy}>
            Permanently remove your account, order history, saved addresses, and wishlist.
            This cannot be undone.
          </Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => {
              if (!requireAuth()) return;
              setDeleteOpen(true);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.dangerButtonText}>Request account deletion</Text>
          </TouchableOpacity>
        </View>

        <Body muted size="xs" style={styles.footerHint}>
          LUXE · Crafted for collectors
        </Body>
      </ScrollView>

      {/* Sticky luxury save bar */}
      <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.saveBarInner}>
          <View style={styles.saveBarStatusRow}>
            <View style={[styles.saveStatusDot, !dirty && styles.saveStatusDotClean]} />
            <Text style={[styles.saveStatusText, dirty && styles.saveStatusTextDirty]}>
              {dirty ? "Unsaved revisions pending" : "All preferences synchronized"}
            </Text>
          </View>
          <View style={styles.saveBarActions}>
            {dirty ? (
              <TouchableOpacity
                style={styles.discardButton}
                onPress={discard}
                activeOpacity={0.7}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
            ) : null}
            {dirty ? (
              <TouchableOpacity
                style={[
                  styles.saveChangesButton,
                  saving && styles.saveChangesButtonDisabled,
                ]}
                onPress={save}
                disabled={saving}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#262420", "#141311"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveChangesGradient}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FAF8F5" />
                  ) : (
                    <>
                      <Ionicons
                        name="sparkles"
                        size={13}
                        color="#E8CF8F"
                      />
                      <Text style={styles.saveChangesText}>
                        Save Preferences
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.syncedPill}>
                <Ionicons name="shield-checkmark" size={13} color="#7D8B6F" />
                <Text style={styles.syncedPillText}>Up to date</Text>
              </View>
            )}
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

      <CenteredModal
        visible={deactivateOpen}
        onClose={() => { setDeactivateOpen(false); setDeactivateReason(""); }}
        kicker="Take a break"
        title="Deactivate account"
        copy={
          <Body muted size="sm" style={styles.modalCopy}>
            Your profile and listings are hidden. New orders are paused. Sign back in any time to reactivate.
          </Body>
        }
      >
        <View style={{ gap: 6, marginTop: 8 }}>
          <Label>Reason (optional)</Label>
          <TextInput
            value={deactivateReason}
            onChangeText={setDeactivateReason}
            placeholder="…"
            maxLength={280}
            editable={!saving}
            style={{ borderWidth: 1, borderColor: colors.light.border, borderRadius: 8, padding: 10 }}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <Button variant="outline" onPress={() => setDeactivateOpen(false)}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onPress={async () => {
              try {
                setSaving(true);
                const res = await deactivateAccountBackend(deactivateReason.trim() || undefined);
                if (!res.ok) {
                  Alert.alert("Couldn't deactivate", res.error || "Try again later.");
                  return;
                }
                Alert.alert(
                  "Account deactivated",
                  "Sign back in any time to reactivate.",
                );
                setDeactivateOpen(false);
                setDeactivateReason("");
                await signOut();
              } catch (err) {
                Alert.alert("Couldn't deactivate", err instanceof Error ? err.message : "Unknown error");
              } finally {
                setSaving(false);
              }
            }}
          >
            Deactivate
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
        {kicker ? (
          <View style={styles.sectionKickerBadge}>
            <Text style={styles.sectionKickerText}>{kicker}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitleText}>{title}</Text>
          {subtitle ? (
            <Text style={styles.sectionSubtitleText}>{subtitle}</Text>
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

function SettingChip({
  selected,
  onPress,
  children,
}: {
  selected?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.settingChip, selected && styles.settingChipSelected]}
    >
      {selected ? (
        <View style={styles.settingChipCheck}>
          <Ionicons name="checkmark" size={10} color="#181714" />
        </View>
      ) : null}
      <Text style={[styles.settingChipText, selected && styles.settingChipTextSelected]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
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
          <Ionicons name={icon} size={16} color="#85651B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.commsLabel}>{label}</Text>
          <Text style={styles.commsSub} numberOfLines={1}>
            {value || "—"}
          </Text>
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
        <Ionicons name={icon} size={16} color="#85651B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.commsLabel}>{label}</Text>
        <Text style={styles.commsSub} numberOfLines={1}>
          {value || "—"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#B5B0A4" />
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
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDetail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E6E2D8", true: "#181714" }}
        thumbColor={value ? "#C8A44A" : "#FAF8F5"}
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
  channels?: ("email" | "sms" | "push")[];
  isLast?: boolean;
}) {
  const activeChannels: ("email" | "sms" | "push")[] = channels ?? ["email", "sms", "push"];
  return (
    <View style={[styles.notificationRow, isLast && styles.notificationRowLast]}>
      <View style={styles.notificationInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDetail}>{detail}</Text>
      </View>
      <View style={styles.notificationSwitches}>
        {activeChannels.map((channel) => {
          const key = `${prefix}_${channel}` as NotificationPreferenceKey;
          const isChecked = !!value[key];
          return (
            <TouchableOpacity
              key={channel}
              onPress={() => onToggle(key)}
              activeOpacity={0.8}
              accessibilityRole="switch"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={`${label} ${channel} notifications`}
              style={styles.notificationSwitchWrap}
            >
              {/* Switch is display-only — the row handles the toggle so a
                  tap can never fire both handlers and cancel itself out. */}
              <View pointerEvents="none">
                <Switch
                  value={isChecked}
                  trackColor={{ false: "#E6E2D8", true: "#181714" }}
                  thumbColor={isChecked ? "#C8A44A" : "#FAF8F5"}
                />
              </View>
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
        <Ionicons name={icon} size={16} color="#85651B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.commsLabel}>{label}</Text>
        <Text style={styles.commsSub}>
          {linked ? "Connected to LUXE Atelier" : "Not connected"}
        </Text>
      </View>
      {linked ? (
        <View style={styles.linkedBadge}>
          <Ionicons name="checkmark-circle" size={13} color="#7D8B6F" />
          <Text style={styles.linkedBadgeText}>Linked</Text>
        </View>
      ) : (
        <Text style={styles.notLinkedText}>Not linked</Text>
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
                <Text style={[styles.modalKicker, kickerColor ? { color: kickerColor } : null]}>
                  {kicker}
                </Text>
              ) : null}
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>
          {typeof copy === "string" ? (
            <Text style={styles.modalCopy}>
              {copy}
            </Text>
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
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  content: { padding: spacing[5] },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: fontFamilies.mono.regular,
    color: "#6B675E",
    letterSpacing: 0.5,
  },

  /* Top Atelier Header */
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAE7DF",
    backgroundColor: "#F8F7F2",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.3,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },

  /* Velvet Obsidian Hero Card */
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#E8CF8F",
    letterSpacing: 1.4,
  },
  heroSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  heroSyncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7D8B6F",
  },
  heroSyncDotDirty: {
    backgroundColor: "#C8A44A",
  },
  heroSyncText: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "#FAF8F5",
    letterSpacing: 1,
  },
  heroSyncTextDirty: {
    color: "#E8CF8F",
  },
  heroProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  avatarBezel: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    borderWidth: 1.5,
    borderColor: "#C8A44A",
    backgroundColor: "#1B1916",
    alignItems: "center",
    justifyContent: "center",
  },
  monogramFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#22201C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  monogramText: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  heroNameText: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: "#FAF8F5",
    letterSpacing: -0.2,
  },
  heroEmailText: {
    fontSize: 12,
    fontFamily: fontFamilies.mono.regular,
    color: "#A49E93",
    marginBottom: 4,
  },
  rolePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  roleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#C8A44A",
    marginRight: 6,
  },
  rolePillText: {
    color: "#E8CF8F",
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1.2,
  },
  heroStatusStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 164, 74, 0.15)",
  },
  heroStatusItem: {
    flex: 1,
    alignItems: "center",
  },
  heroStatusLabel: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.medium,
    color: "rgba(232, 207, 143, 0.7)",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  heroStatusVal: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
    letterSpacing: 0.2,
  },
  heroStatusDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
  },

  /* Sections */
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    marginBottom: 16,
    ...shadows.soft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  sectionKickerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionKickerText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651B",
    letterSpacing: 1,
  },
  sectionTitleText: {
    fontSize: 16.5,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.2,
  },
  sectionSubtitleText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#6B675E",
    marginTop: 2,
    lineHeight: 17,
  },
  sectionBody: { gap: spacing[3] },

  subLabel: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  subLabelTop: { marginTop: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  /* Load error */
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    marginBottom: 6,
  },
  errorCopy: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#6B675E",
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 16,
  },
  errorRetry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#181714",
  },
  errorRetryText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },

  /* Setting Chips */
  settingChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#FAF8F5",
    borderWidth: 1,
    borderColor: "#E7E3D8",
  },
  settingChipSelected: {
    backgroundColor: "#181714",
    borderColor: "#C8A44A",
  },
  settingChipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#C8A44A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  settingChipText: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.medium,
    color: "#4A463E",
  },
  settingChipTextSelected: {
    color: "#FAF8F5",
    fontFamily: fontFamilies.sans.semibold,
  },

  commsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "#F4F1EA",
  },
  commsRowLast: { borderBottomWidth: 0 },
  commsIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F5EE",
    borderWidth: 1,
    borderColor: "#ECE8DD",
  },
  commsLabel: {
    fontSize: 13.5,
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  commsSub: {
    fontSize: 12,
    fontFamily: fontFamilies.mono.regular,
    color: colors.light.mutedForeground,
    marginTop: 1,
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
    borderColor: "#EAE7DF",
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F1EA",
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleInfo: { flex: 1, paddingRight: spacing[2] },
  toggleLabel: {
    fontSize: 13.5,
    fontFamily: fontFamilies.sans.semibold,
    color: "#181714",
    marginBottom: 2,
  },
  toggleDetail: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#736F66",
    lineHeight: 16,
  },

  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: "#EAE7DF",
  },
  notifChannel: {
    width: 50,
    textAlign: "center",
    color: "#85651B",
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "#F4F1EA",
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
    borderBottomColor: "#F4F1EA",
  },
  providerRowLast: { borderBottomWidth: 0 },
  linkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(125, 139, 111, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(125, 139, 111, 0.3)",
  },
  linkedBadgeText: {
    fontSize: 11,
    fontFamily: fontFamilies.mono.semibold,
    color: "#5C6A4F",
  },
  notLinkedText: {
    color: "#A49E93",
    fontSize: 11,
    fontFamily: fontFamilies.mono.medium,
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

  /* Deactivate card */
  deactivateCard: {
    backgroundColor: "#FAF9F5",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    marginBottom: spacing[4],
    gap: spacing[3],
    ...shadows.soft,
  },
  deactivateHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  deactivateIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  deactivateKicker: {
    color: "#85651B",
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1.2,
  },
  deactivateTitle: {
    marginTop: 2,
    fontSize: 16,
    fontFamily: fontFamilies.display.semibold,
    color: "#181714",
  },
  deactivateCopy: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#6B675E",
    lineHeight: 18,
  },
  deactivateButton: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E1D5",
  },
  deactivateButtonText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: "#85651B",
  },

  /* Danger card */
  danger: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(180, 50, 50, 0.22)",
    marginBottom: spacing[4],
    gap: spacing[3],
    ...shadows.soft,
  },
  dangerHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dangerIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(180, 50, 50, 0.08)",
  },
  dangerKicker: {
    color: colors.light.destructive,
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1.2,
  },
  dangerTitle: {
    marginTop: 2,
    fontSize: 16,
    fontFamily: fontFamilies.display.semibold,
    color: "#181714",
  },
  dangerCopy: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    lineHeight: 18,
  },
  dangerButton: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.light.destructive,
  },
  dangerButtonText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },
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

  footerHint: {
    textAlign: "center",
    marginTop: spacing[2],
    fontFamily: fontFamilies.mono.regular,
    color: "#8E8B82",
    letterSpacing: 1.2,
    fontSize: 10,
  },

  /* Sticky luxury save bar */
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FAF8F5",
    borderTopWidth: 1,
    borderTopColor: "#EAE7DF",
    paddingHorizontal: 20,
    paddingTop: 12,
    ...shadows.soft,
  },
  saveBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  saveBarStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  saveStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C8A44A",
  },
  saveStatusDotClean: {
    backgroundColor: "#7D8B6F",
  },
  saveStatusText: {
    fontSize: 11,
    fontFamily: fontFamilies.mono.medium,
    color: "#6B675E",
    letterSpacing: 0.2,
  },
  saveStatusTextDirty: {
    color: "#85651B",
    fontFamily: fontFamilies.mono.semibold,
  },
  saveBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  discardButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  discardButtonText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.medium,
    color: "#8E8B82",
    textDecorationLine: "underline",
  },
  saveChangesButton: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
  },
  saveChangesButtonDisabled: {
    opacity: 0.6,
  },
  saveChangesGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveChangesText: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
    letterSpacing: 0.2,
  },
  saveChangesTextDisabled: {
    color: "#8E8B82",
  },
  syncedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#F2EFE8",
    borderWidth: 1,
    borderColor: "#E6E2D8",
  },
  syncedPillText: {
    fontSize: 11,
    fontFamily: fontFamilies.mono.semibold,
    color: "#5C6A4F",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[4],
  },
  modal: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: radii["2xl"],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "#EAE7DF",
    ...shadows.soft,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[3],
  },
  modalKicker: {
    color: "#85651B",
    marginBottom: 2,
    fontSize: 10,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: "#181714",
  },
  modalCopy: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    marginBottom: spacing[4],
    lineHeight: 18,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F5EE",
    borderWidth: 1,
    borderColor: "#EAE7DF",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing[2],
  },
});
