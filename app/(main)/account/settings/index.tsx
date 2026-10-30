import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  type LayoutChangeEvent,

  Image,
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
import { Modal } from "@/components/ui/Modal";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@/components/ui/Icon";
import { Button, useToast } from "@/components/ui";
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
  const [avatarFailed, setAvatarFailed] = useState(false);
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

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const registerSection = (key: string) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const jumpTo = (key: string) => {
    const y = sectionY.current[key];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const safeguards = [
    {
      key: "email",
      label: "Email verified",
      done: !!user?.email_confirmed_at,
      icon: "mail-outline" as const,
      onFix: undefined as undefined | (() => void),
    },
    {
      key: "phone",
      label: "Phone added",
      done: !!phone,
      icon: "call-outline" as const,
      onFix: () => {
        if (!requireAuth()) return;
        setNewPhone(phone);
        setPhoneOtp("");
        setPhoneStep(1);
        setChangePhoneOpen(true);
      },
    },
    {
      key: "bio",
      label: "Biometric lock",
      done: !!local.biometricLock,
      icon: "finger-print-outline" as const,
      onFix: () => updateLocal({ biometricLock: true }),
    },
    {
      key: "sso",
      label: "Backup sign-in",
      done: linkedProviders.google || linkedProviders.apple || linkedProviders.facebook,
      icon: "link-outline" as const,
      onFix: () => jumpTo("06"),
    },
  ];
  const safeguardsDone = safeguards.filter((g) => g.done).length;

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
      {/* 1. Top navigation */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Go back"
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
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color="#85651B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: (dirty ? 150 : 60) + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Profile hero — quiet obsidian card */}
        <View style={styles.heroShell}>
          <LinearGradient
            colors={["#23211C", "#181713", "#0F0E0C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View pointerEvents="none" style={styles.heroGlow} />
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(232,207,143,0)", "rgba(232,207,143,0.6)", "rgba(232,207,143,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroTopHairline}
            />

            <View style={styles.heroProfileRow}>
              <View style={styles.avatarBezel}>
                {avatarUri && !avatarFailed ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    onError={() => setAvatarFailed(true)}
                  />
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

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroKicker}>LUXE · PRIVATE CLIENT</Text>
                <Text style={styles.heroNameText} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.heroEmailText} numberOfLines={1}>
                  {email || "Not signed in"}
                </Text>
              </View>
            </View>

            <LinearGradient
              pointerEvents="none"
              colors={["rgba(232,207,143,0.22)", "rgba(232,207,143,0.06)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroDivider}
            />

            <View style={styles.heroFooter}>
              <View style={styles.rolePill}>
                <Ionicons name="shield-checkmark" size={11} color="#181714" />
                <Text style={styles.rolePillText}>{role ? role.toUpperCase() : "PATRON"}</Text>
              </View>
              <View style={styles.heroSync}>
                <View style={[styles.heroSyncDot, dirty && styles.heroSyncDotDirty]} />
                <Text style={[styles.heroSyncText, dirty && styles.heroSyncTextDirty]}>
                  {dirty ? "Unsaved changes" : "All synced"}
                </Text>
              </View>
              <Text style={styles.heroVersion}>v{appVersion}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* 3. Account protection */}
        <View style={styles.protectCard}>
          <View style={styles.protectHead}>
            <ProtectionRing done={safeguardsDone} total={safeguards.length} />
            <View style={{ flex: 1 }}>
              <Text style={styles.protectKicker}>ACCOUNT PROTECTION</Text>
              <Text style={styles.protectTitle}>
                {safeguardsDone === safeguards.length
                  ? "Fully protected"
                  : safeguardsDone >= safeguards.length / 2
                    ? "Well protected"
                    : "Needs attention"}
              </Text>
              <Text style={styles.protectSub}>
                {safeguardsDone} of {safeguards.length} safeguards active
              </Text>
            </View>
          </View>
          <View style={styles.protectGrid}>
            {safeguards.map((g) => {
              const actionable = !g.done && !!g.onFix;
              return (
                <TouchableOpacity
                  key={g.key}
                  disabled={!actionable}
                  onPress={g.onFix}
                  activeOpacity={0.75}
                  style={[styles.protectItem, g.done && styles.protectItemDone]}
                >
                  <View style={[styles.protectItemIcon, g.done && styles.protectItemIconDone]}>
                    <Ionicons
                      name={g.done ? "checkmark" : g.icon}
                      size={g.done ? 12 : 13}
                      color={g.done ? "#181714" : "#85651B"}
                    />
                  </View>
                  <Text style={[styles.protectItemText, g.done && styles.protectItemTextDone]} numberOfLines={1}>
                    {g.label}
                  </Text>
                  {actionable ? <Ionicons name="add" size={14} color="#85651B" /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Quick jump */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.jumpScroll}
          contentContainerStyle={styles.jumpRow}
        >
          {JUMP_LINKS.map((j) => (
            <TouchableOpacity key={j.key} onPress={() => jumpTo(j.key)} activeOpacity={0.75} style={styles.jumpChip}>
              <Ionicons name={j.icon} size={13} color="#85651B" />
              <Text style={styles.jumpChipText}>{j.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* LANGUAGE & REGION */}
        <Section
          onLayout={registerSection("01")}
          kicker="01"
          icon="globe-outline"
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
          <View style={styles.optionList}>
            {CURRENCIES.map((item) => {
              const [code, ...rest] = item.label.split(" · ");
              return (
                <OptionCard
                  key={item.value}
                  selected={currency === item.value}
                  code={code}
                  name={rest.join(" · ")}
                  onPress={() => setCurrency(item.value)}
                />
              );
            })}
          </View>
        </Section>

        {/* EMAIL & PHONE */}
        <Section onLayout={registerSection("02")} kicker="02"
          icon="mail-outline" title="Email & phone" subtitle="How we verify it's you.">
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
          onLayout={registerSection("03")}
          kicker="03"
          icon="eye-off-outline"
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
          onLayout={registerSection("04")}
          kicker="04"
          icon="shield-checkmark-outline"
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
          onLayout={registerSection("05")}
          kicker="05"
          icon="notifications-outline"
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
        <Section onLayout={registerSection("06")} kicker="06"
          icon="link-outline" title="Connected accounts" subtitle="Single sign-on providers.">
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
          onLayout={registerSection("07")}
          kicker="07"
          icon="server-outline"
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
        <Section onLayout={registerSection("08")} kicker="08"
          icon="document-text-outline" title="Legal & about" subtitle="Policies, licences, and build info.">
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

      {/* Floating save capsule — only while there are unsaved edits */}
      {dirty ? (
        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 14) }]} pointerEvents="box-none">
          <LinearGradient
            colors={["#262420", "#141311"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBarInner}
          >
            <View style={styles.saveBarStatusRow}>
              <View style={styles.saveStatusDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.saveStatusTitle}>Unsaved changes</Text>
                <Text style={styles.saveStatusText}>Review, then save to sync</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.discardButton} onPress={discard} activeOpacity={0.7} disabled={saving}>
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveChangesButton, saving && styles.saveChangesButtonDisabled]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#F1DFA6", "#C8A44A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveChangesGradient}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#181714" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={14} color="#181714" />
                    <Text style={styles.saveChangesText}>Save</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ) : null}

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
  icon,
  title,
  subtitle,
  children,
  onLayout,
}: {
  onLayout?: (e: LayoutChangeEvent) => void;
  kicker?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      {kicker ? <Text style={styles.sectionKickerText}>{kicker}</Text> : null}
      <View style={styles.sectionHeader}>
        {icon ? (
          <LinearGradient
            colors={["#FBF3DC", "#EFDDA8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sectionIconTile}
          >
            <Ionicons name={icon} size={18} color="#85651B" />
          </LinearGradient>
        ) : null}
        <View style={{ flex: 1, paddingRight: 28 }}>
          <Text style={styles.sectionTitleText}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitleText}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const JUMP_LINKS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "01", label: "Region", icon: "globe-outline" },
  { key: "02", label: "Contact", icon: "mail-outline" },
  { key: "03", label: "Privacy", icon: "eye-off-outline" },
  { key: "04", label: "Security", icon: "shield-checkmark-outline" },
  { key: "05", label: "Alerts", icon: "notifications-outline" },
  { key: "06", label: "Accounts", icon: "link-outline" },
  { key: "07", label: "Data", icon: "server-outline" },
  { key: "08", label: "Legal", icon: "document-text-outline" },
];

function ProtectionRing({ done, total }: { done: number; total: number }) {
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EFE9DA" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#C8A44A"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.protectRingValue}>
          {done}
          <Text style={styles.protectRingTotal}>/{total}</Text>
        </Text>
      </View>
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
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.settingChip, selected && styles.settingChipSelected]}
    >
      {selected ? (
        <View style={styles.settingChipCheck}>
          <Ionicons name="checkmark" size={9} color="#181714" />
        </View>
      ) : null}
      <Text style={[styles.settingChipText, selected && styles.settingChipTextSelected]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

function OptionCard({
  selected,
  code,
  name,
  onPress,
}: {
  selected?: boolean;
  code: string;
  name: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: !!selected }}
      style={[styles.optionCard, selected && styles.optionCardSelected]}
    >
      <View style={[styles.optionCode, selected && styles.optionCodeSelected]}>
        <Text style={[styles.optionCodeText, selected && styles.optionCodeTextSelected]}>
          {code}
        </Text>
      </View>
      <Text style={[styles.optionName, selected && styles.optionNameSelected]} numberOfLines={1}>
        {name}
      </Text>
      <View style={[styles.optionRadio, selected && styles.optionRadioSelected]}>
        {selected ? <View style={styles.optionRadioDot} /> : null}
      </View>
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
  const body = (
    <>
      <View style={styles.commsIcon}>
        <Ionicons name={icon} size={16} color="#85651B" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.commsLabel}>{label}</Text>
        {value ? (
          <Text style={styles.commsSub} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
    </>
  );
  if (!onPress) {
    return <View style={[styles.commsRow, isLast && styles.commsRowLast]}>{body}</View>;
  }
  return (
    <TouchableOpacity
      style={[styles.commsRow, isLast && styles.commsRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {body}
      <View style={styles.commsChevron}>
        <Ionicons name="chevron-forward" size={13} color="#85651B" />
      </View>
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

const CARD_SHADOW = {
  shadowColor: "#2A2620",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.07,
  shadowRadius: 22,
  elevation: 4,
} as const;

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

  /* Top header */
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: "#F8F7F2",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DFD3",
    ...CARD_SHADOW,
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  headerTitleCenter: { alignItems: "center", justifyContent: "center" },
  headerEyebrow: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.4,
  },
  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DFD3",
    ...CARD_SHADOW,
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },

  /* Hero */
  heroShell: {
    marginTop: spacing[2],
    marginBottom: spacing[3],
    borderRadius: 26,
    shadowColor: "#0F0E0C",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 12,
  },
  heroCard: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,207,143,0.16)",
  },
  heroGlow: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(200,164,74,0.09)",
  },
  heroTopHairline: {
    position: "absolute",
    top: 0,
    left: 32,
    right: 32,
    height: 1,
  },
  heroProfileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarBezel: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    borderWidth: 1.5,
    borderColor: "rgba(232,207,143,0.7)",
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 32 },
  monogramFallback: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: "#2C2A23",
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    fontSize: 22,
    fontFamily: fontFamilies.display.semibold,
    color: "#E8CF8F",
    letterSpacing: 0.5,
  },
  heroKicker: {
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
    color: "rgba(232,207,143,0.7)",
    letterSpacing: 1.8,
  },
  heroNameText: {
    fontSize: 24,
    fontFamily: fontFamilies.display.semibold,
    color: "#FAF8F5",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  heroEmailText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.regular,
    color: "rgba(250,248,245,0.55)",
    marginTop: 1,
  },
  heroDivider: { height: 1, marginTop: 18, marginBottom: 14 },
  heroFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#E8CF8F",
  },
  rolePillText: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    color: "#181714",
    letterSpacing: 1.2,
  },
  heroSync: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  heroSyncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#9DB08A" },
  heroSyncDotDirty: { backgroundColor: "#E8CF8F" },
  heroSyncText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.medium,
    color: "rgba(250,248,245,0.6)",
  },
  heroSyncTextDirty: { color: "#E8CF8F" },
  heroVersion: {
    fontSize: 10.5,
    fontFamily: fontFamilies.mono.regular,
    color: "rgba(250,248,245,0.38)",
    letterSpacing: 0.4,
  },

  /* Protection card */
  protectCard: {
    backgroundColor: "#FFFDF8",
    borderRadius: 24,
    padding: 18,
    marginBottom: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DFD3",
    ...CARD_SHADOW,
  },
  protectHead: { flexDirection: "row", alignItems: "center", gap: 16 },
  protectRingValue: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
  },
  protectRingTotal: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.medium,
    color: "#A39D90",
  },
  protectKicker: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.6,
  },
  protectTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.4,
    marginTop: 3,
  },
  protectSub: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#7A766C",
    marginTop: 1,
  },
  protectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ECE8DD",
  },
  protectItem: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#FBF6E7",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.35)",
    borderStyle: "dashed",
  },
  protectItemDone: {
    backgroundColor: "#F7F4EC",
    borderColor: "transparent",
    borderStyle: "solid",
  },
  protectItemIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  protectItemIconDone: { backgroundColor: "#E8CF8F" },
  protectItemText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.semibold,
    color: "#85651B",
  },
  protectItemTextDone: { color: "#3D3A33", fontFamily: fontFamilies.sans.medium },

  /* Quick jump */
  jumpScroll: { marginHorizontal: -spacing[5], marginBottom: spacing[4] },
  jumpRow: { gap: 8, paddingHorizontal: spacing[5], paddingVertical: 4 },
  jumpChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DFD3",
  },
  jumpChipText: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.semibold,
    color: "#3D3A33",
  },

  /* Section card */
  section: {
    backgroundColor: "#FFFDF8",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    marginBottom: spacing[4],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DFD3",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECE8DD",
  },
  sectionIconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.3)",
  },
  sectionKickerText: {
    position: "absolute",
    top: 8,
    right: 16,
    fontSize: 34,
    fontFamily: fontFamilies.display.italic,
    color: "rgba(200,164,74,0.2)",
  },
  sectionTitleText: {
    fontSize: 19,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    letterSpacing: -0.4,
  },
  sectionSubtitleText: {
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fontFamilies.sans.regular,
    color: "#7A766C",
    marginTop: 2,
  },
  sectionBody: { paddingTop: 6, paddingBottom: 8 },
  subLabel: {
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    color: "#85651B",
    letterSpacing: 1.6,
    marginTop: 10,
    marginBottom: 10,
  },
  subLabelTop: { marginTop: 18 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  /* Currency options */
  optionList: { gap: 8 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    paddingRight: 14,
    borderRadius: 16,
    backgroundColor: "#F7F4EC",
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionCardSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(200,164,74,0.55)",
    ...CARD_SHADOW,
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  optionCode: {
    minWidth: 48,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#ECE8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  optionCodeSelected: { backgroundColor: "#181714" },
  optionCodeText: {
    fontSize: 11,
    fontFamily: fontFamilies.mono.semibold,
    color: "#5E5A51",
    letterSpacing: 0.8,
  },
  optionCodeTextSelected: { color: "#E8CF8F" },
  optionName: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamilies.sans.medium,
    color: "#3D3A33",
  },
  optionNameSelected: { fontFamily: fontFamilies.sans.semibold, color: "#141311" },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CFCABD",
    alignItems: "center",
    justifyContent: "center",
  },
  optionRadioSelected: { borderColor: "#C8A44A" },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#C8A44A" },

  /* Load error */
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DFD3",
    ...CARD_SHADOW,
  },
  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.display.semibold,
    color: "#141311",
    marginBottom: 6,
  },
  errorCopy: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.regular,
    color: "#6B675E",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  errorRetry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: "#181714",
  },
  errorRetryText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },

  /* Chips */
  settingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "#F7F4EC",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DFD3",
  },
  settingChipSelected: {
    backgroundColor: "#181714",
    borderColor: "#181714",
    paddingLeft: 9,
    shadowColor: "#141311",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  settingChipCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E8CF8F",
    alignItems: "center",
    justifyContent: "center",
  },
  settingChipText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.medium,
    color: "#3D3A33",
  },
  settingChipTextSelected: { color: "#FAF8F5", fontFamily: fontFamilies.sans.semibold },

  /* Rows */
  commsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECE8DD",
  },
  commsRowLast: { borderBottomWidth: 0 },
  commsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F7F1DF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  commsLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.semibold,
    color: "#181714",
  },
  commsSub: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: "#7A766C",
    marginTop: 2,
  },
  commsChevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F7F4EC",
    alignItems: "center",
    justifyContent: "center",
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECE8DD",
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECE8DD",
  },
  notificationRowLast: { borderBottomWidth: 0 },
  notificationInfo: { flex: 1, paddingRight: spacing[2] },
  notificationSwitches: { flexDirection: "row", alignItems: "center" },
  notificationSwitchWrap: { width: 50, alignItems: "center" },

  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECE8DD",
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
    backgroundColor: "#FFFDF8",
    borderRadius: 24,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
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
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.45)",
  },
  deactivateButtonText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: "#85651B",
  },

  /* Danger card */
  danger: {
    backgroundColor: "#FFFDFC",
    borderRadius: 24,
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
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
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

  /* Floating save capsule */
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  saveBarInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(232,207,143,0.25)",
    shadowColor: "#141311",
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  saveBarStatusRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  saveStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E8CF8F",
    shadowColor: "#E8CF8F",
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  saveStatusTitle: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: "#FAF8F5",
  },
  saveStatusText: {
    fontSize: 10.5,
    fontFamily: fontFamilies.sans.regular,
    color: "rgba(250,248,245,0.5)",
    marginTop: 1,
  },
  discardButton: { paddingHorizontal: 10, paddingVertical: 10 },
  discardButtonText: {
    fontSize: 12.5,
    fontFamily: fontFamilies.sans.medium,
    color: "rgba(250,248,245,0.6)",
  },
  saveChangesButton: { borderRadius: 20, overflow: "hidden" },
  saveChangesButtonDisabled: { opacity: 0.6 },
  saveChangesGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minWidth: 84,
    paddingHorizontal: 18,
    height: 40,
  },
  saveChangesText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.bold,
    color: "#181714",
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
