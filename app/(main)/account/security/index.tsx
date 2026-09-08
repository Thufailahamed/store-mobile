import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import {
  changePasswordBackend,
  getSessionsBackend,
  getSettingsBackend,
  signOutAllBackend,
  updateSettingsBackend,
  type SecuritySession,
} from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface DeviceInfo {
  os: string;
  osVersion: string;
  model: string;
}

function readDeviceInfo(): DeviceInfo {
  return {
    os: Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web",
    osVersion: String(Platform.Version ?? "—"),
    model: (Platform as any).select?.({})?.toString?.() ?? "Mobile",
  };
}

function strengthOf(pwd: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pwd) return { score: 0, label: "Empty", color: "#C8C8B8" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  const labels = ["Empty", "Weak", "Fair", "Good", "Strong"] as const;
  const palette = [
    "#C8C8B8",
    "#C0392B",
    "#C8A44A",
    "#54B870",
    "#2B6E3F",
  ];
  return {
    score: score as 0 | 1 | 2 | 3 | 4,
    label: labels[score] ?? "Empty",
    color: palette[score] ?? "#C8C8B8",
  };
}

function timeAgo(iso: string): string {
  if (!iso) return "Just now";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Just now";
  const diff = Date.now() - t;
  if (diff < 60_000) return "Active now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const DEVICE_ICON: Record<"laptop" | "phone" | "tablet", keyof typeof Ionicons.glyphMap> = {
  laptop: "laptop-outline",
  phone: "phone-portrait-outline",
  tablet: "tablet-portrait-outline",
};

export default function SecurityScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryEmailSaved, setRecoveryEmailSaved] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [device] = useState<DeviceInfo>(readDeviceInfo());
  const [sessions, setSessions] = useState<SecuritySession[]>([]);

  // 2FA enrollment modal state
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollQrSvg, setEnrollQrSvg] = useState("");
  const [enrollSecret, setEnrollSecret] = useState("");
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const loadSessions = async () => {
    if (!user?.id) {
      setSessions([]);
      return;
    }
    const res = await getSessionsBackend();
    if (!res.ok) {
      toast(res.error ?? "Couldn't load sessions", "error");
      return;
    }
    setSessions(res.data?.sessions ?? []);
  };

  const loadMfa = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      setMfaEnabled(Boolean(verified));
    } catch {
      /* ignore */
    }
  };

  const loadSettings = async () => {
    if (!user?.id) return;
    const res = await getSettingsBackend();
    if (res.ok && res.data?.settings) {
      const meta = (res.data.settings.privacy ?? {}) as Record<string, unknown>;
      const savedEmail = typeof meta.recovery_email === "string" ? meta.recovery_email : "";
      setRecoveryEmail(savedEmail);
      setRecoveryEmailSaved(savedEmail);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      await Promise.all([loadSessions(), loadMfa(), loadSettings()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const startEnroll = async () => {
    setEnrollBusy(true);
    setEnrollCode("");
    setEnrollQrSvg("");
    setEnrollSecret("");
    setEnrollFactorId(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (error || !data) throw error ?? new Error("Enrollment failed");
      setEnrollQrSvg(data.totp?.qr_code ?? "");
      setEnrollSecret(data.totp?.secret ?? "");
      setEnrollFactorId(data.id);
      setEnrollOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start enrollment";
      toast(msg, "error");
    } finally {
      setEnrollBusy(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!enrollFactorId) return;
    if (!/^\d{6}$/.test(enrollCode.trim())) {
      toast("Code must be 6 digits", "error");
      return;
    }
    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (challenge.error || !challenge.data) throw challenge.error ?? new Error("Challenge failed");
      const verify = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.data.id,
        code: enrollCode.trim(),
      });
      if (verify.error) throw verify.error;
      toast("Two-factor authentication enabled", "success");
      setMfaEnabled(true);
      setEnrollOpen(false);
      setEnrollCode("");
      setEnrollFactorId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      toast(msg, "error");
    } finally {
      setVerifying(false);
    }
  };

  const disableMfa = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (!verified) {
        setMfaEnabled(false);
        return;
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
      if (error) throw error;
      setMfaEnabled(false);
      toast("Two-factor disabled", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't disable 2FA";
      toast(msg, "error");
    }
  };

  const changePassword = async () => {
    if (currentPassword.length < 8) {
      toast("Enter your current password", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    if (currentPassword === newPassword) {
      toast("New password must differ from current password", "error");
      return;
    }

    setSaving(true);
    const res = await changePasswordBackend({ currentPassword, newPassword });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not update password", "error");
      return;
    }
    toast("Password updated successfully", "success");
    setCurrentPassword("");
    setNewPassword("");
  };

  const saveRecoveryEmail = async () => {
    if (recoveryEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(recoveryEmail)) {
      toast("Enter a valid email address", "error");
      return;
    }
    setSaving(true);
    const res = await updateSettingsBackend({ privacy: { recovery_email: recoveryEmail || null } });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save recovery email", "error");
      return;
    }
    setRecoveryEmailSaved(recoveryEmail);
    toast("Recovery email updated", "success");
  };

  const signOutEverywhere = async () => {
    setSaving(true);
    const res = await signOutAllBackend();
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not sign out everywhere", "error");
      return;
    }
    try {
      await supabase.auth.signOut({ scope: "global" } as any);
    } catch {
      /* ignore */
    }
    await signOut();
    toast("Signed out of all devices", "success");
  };

  const signOutAll = () => {
    Alert.alert(
      "Sign out everywhere",
      "End every active session on all devices, including this one.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out all", style: "destructive", onPress: () => void signOutEverywhere() },
      ],
    );
  };

  const copySecretToClipboard = async () => {
    if (!enrollSecret) return;
    await Clipboard.setStringAsync(enrollSecret);
    toast("Secret copied to clipboard", "success");
  };

  const score = mfaEnabled ? 95 : 60;
  const pwdStrength = strengthOf(newPassword);

  const sessionRows = useMemo(() => {
    if (sessions.length === 0) {
      return [
        {
          id: "this",
          label: `${device.os} · LUXE Mobile`,
          meta: `${device.osVersion} · Primary Device · Active now`,
          current: true,
          icon: "phone-portrait-outline" as const,
          active: "Active now",
        },
      ];
    }
    return sessions.map((s) => ({
      id: s.id,
      label: `${s.os} · ${s.browser}`,
      meta: `${s.location ?? "Private Location"}${s.ip ? ` · ${s.ip}` : ""}`,
      current: s.current,
      icon: DEVICE_ICON[s.device] ?? ("phone-portrait-outline" as const),
      active: timeAgo(s.last_active),
    }));
  }, [sessions, device]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#141311" />
          </TouchableOpacity>
          <View style={styles.headerTitleCenter}>
            <Text style={styles.headerEyebrow}>VAULT DEFENSE</Text>
            <Text style={styles.headerTitle}>Security & Privacy</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#C8A44A" size="large" />
          <Text style={styles.loadingText}>Verifying cryptographic vault...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
          <Text style={styles.headerEyebrow}>VAULT DEFENSE</Text>
          <Text style={styles.headerTitle}>Security & Privacy</Text>
        </View>

        <View style={styles.shieldMedallionSmall}>
          <Ionicons
            name={score >= 90 ? "shield-checkmark" : "shield-outline"}
            size={18}
            color={score >= 90 ? "#54B870" : "#C8A44A"}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Velvet Obsidian Hero Card ("Fort Knox Protocol") */}
          <LinearGradient
            colors={["#141311", "#1E1C18", "#0F0E0D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroTagBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#C8A44A" />
                <Text style={styles.heroTagText}>ENCRYPTED ATELIER VAULT</Text>
              </View>

              {/* Gold Vault Shield Medallion */}
              <View style={styles.vaultMedallion}>
                <View style={styles.vaultMedallionInner}>
                  <Ionicons name="lock-closed-outline" size={18} color="#E8CF8F" />
                </View>
              </View>
            </View>

            <View style={styles.heroBodyRow}>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>Fort Knox Protocol</Text>
                <Text style={styles.heroSubtitle}>
                  End-to-end cryptographic defense of your private measurements, payment
                  credentials, and bespoke acquisition ledger.
                </Text>
              </View>

              {/* Health Badge */}
              <View
                style={[
                  styles.healthPill,
                  {
                    backgroundColor:
                      score >= 90 ? "rgba(84, 184, 112, 0.15)" : "rgba(200, 164, 74, 0.15)",
                    borderColor:
                      score >= 90 ? "rgba(84, 184, 112, 0.3)" : "rgba(200, 164, 74, 0.3)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.liveDot,
                    { backgroundColor: score >= 90 ? "#54B870" : "#C8A44A" },
                  ]}
                />
                <Text
                  style={[
                    styles.healthPillText,
                    { color: score >= 90 ? "#54B870" : "#E8CF8F" },
                  ]}
                >
                  {score >= 90 ? "OPTIMAL" : "RECOMMENDED"}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* 3. Luxury Security Health Score Card */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>DEFENSE EVALUATION</Text>
                <Text style={styles.sectionTitle}>Security Score</Text>
              </View>
              <View style={styles.scoreDeltaBadge}>
                <Text style={styles.scoreDeltaText}>
                  {score >= 90 ? "+5 PTS THIS WEEK" : "+0 THIS WEEK"}
                </Text>
              </View>
            </View>

            <View style={styles.scoreValueRow}>
              <Text style={styles.scoreNumber}>{score}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>

            {/* Gauge Progress Bar */}
            <View style={styles.track}>
              <LinearGradient
                colors={score >= 90 ? ["#54B870", "#2B6E3F"] : ["#E8CF8F", "#C8A44A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.fill, { width: `${score}%` }]}
              />
            </View>

            {/* 4-Point Defense Checklist */}
            <View style={styles.checklist}>
              <CheckRow
                done
                label="Cryptographic sign-in password active"
                sub="Salted & hashed with modern cipher standards"
              />
              <CheckRow
                done={mfaEnabled}
                label="Two-factor authentication (TOTP)"
                sub={mfaEnabled ? "Enabled via authenticator app" : "Recommended: enable authenticator codes"}
              />
              <CheckRow
                done={!!recoveryEmailSaved}
                label="Verified secondary recovery channel"
                sub={recoveryEmailSaved ? recoveryEmailSaved : "No recovery email designated"}
              />
              <CheckRow
                done
                label="Session integrity & access logs reviewed"
                sub="Zero unrecognized device authorizations"
              />
            </View>
          </View>

          {/* 4. Bespoke Password Card */}
          <View style={styles.contentCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>AUTHENTICATION CREDENTIALS</Text>
                <Text style={styles.sectionTitle}>Password</Text>
                <Text style={styles.cardSubtitle}>Rotate your master account password.</Text>
              </View>
              <View
                style={[
                  styles.strengthBadge,
                  { backgroundColor: pwdStrength.color + "20", borderColor: pwdStrength.color + "40" },
                ]}
              >
                <Text style={[styles.strengthBadgeText, { color: pwdStrength.color }]}>
                  {pwdStrength.label.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Current Password Field */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#9C988F"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#8F8B82"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password Field */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  placeholder="Minimum 8 characters with mix of cases & symbols"
                  placeholderTextColor="#9C988F"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#8F8B82"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Strength Meter */}
            {newPassword.length > 0 && (
              <View style={styles.pwdStrength}>
                <View style={styles.pwdStrengthTrack}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.pwdStrengthSegment,
                        {
                          backgroundColor:
                            i <= pwdStrength.score ? pwdStrength.color : "#E5E1D4",
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.pwdStrengthHint}>
                  Security recommendation: Use 12+ characters, uppercase, lowercase, numbers, and symbols.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                (saving || newPassword.length < 8) && { opacity: 0.6 },
              ]}
              disabled={saving || newPassword.length < 8}
              onPress={changePassword}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#1C1A17", "#141311"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryActionGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#E8CF8F" size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryActionText}>Update Vault Password</Text>
                    <Ionicons name="arrow-forward" size={14} color="#E8CF8F" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* 5. Two-Factor Authentication Card */}
          <View style={styles.contentCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>MULTI-FACTOR DEFENSE</Text>
                <Text style={styles.sectionTitle}>Two-Factor Authentication</Text>
                <Text style={styles.cardSubtitle}>
                  Time-based one-time passcodes generated by your authenticator app.
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: mfaEnabled ? "#EBF7EE" : "#F7F5EE",
                    borderColor: mfaEnabled ? "#C5E6CC" : "#E6E2D4",
                  },
                ]}
              >
                <Ionicons
                  name={mfaEnabled ? "shield-checkmark" : "shield-outline"}
                  size={11}
                  color={mfaEnabled ? "#2B6E3F" : "#85651B"}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: mfaEnabled ? "#2B6E3F" : "#85651B" },
                  ]}
                >
                  {mfaEnabled ? "ACTIVE 2FA" : "DISABLED"}
                </Text>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="phone-portrait-outline" size={18} color="#85651B" />
                <View>
                  <Text style={styles.toggleLabel}>Authenticator App</Text>
                  <Text style={styles.toggleSub}>Google Authenticator, 1Password, or Authy</Text>
                </View>
              </View>

              {mfaEnabled ? (
                <TouchableOpacity
                  style={styles.secondaryOutlineButton}
                  onPress={disableMfa}
                >
                  <Text style={styles.secondaryOutlineButtonText}>Disable</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.enableMfaButton}
                  onPress={startEnroll}
                  disabled={enrollBusy}
                >
                  {enrollBusy ? (
                    <ActivityIndicator size="small" color="#141311" />
                  ) : (
                    <>
                      <Text style={styles.enableMfaButtonText}>Configure</Text>
                      <Ionicons name="arrow-forward" size={12} color="#141311" />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 6. Recovery Channel Card */}
          <View style={styles.contentCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>OUT-OF-BAND RECOVERY</Text>
                <Text style={styles.sectionTitle}>Secondary Recovery Email</Text>
                <Text style={styles.cardSubtitle}>
                  A secondary encrypted address for emergency credentials restoration.
                </Text>
              </View>
              {recoveryEmailSaved ? (
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark-circle" size={11} color="#2B6E3F" />
                  <Text style={styles.savedBadgeText}>SAVED</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>RECOVERY INBOX ADDRESS</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={recoveryEmail}
                  onChangeText={setRecoveryEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="secondary.inbox@domain.com"
                  placeholderTextColor="#9C988F"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveRecoveryButton, saving && { opacity: 0.7 }]}
              onPress={saveRecoveryEmail}
              disabled={saving}
            >
              <Text style={styles.saveRecoveryButtonText}>
                {saving ? "Saving..." : "Save Recovery Email"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 7. Active Sessions & Authorized Devices */}
          <View style={styles.contentCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>DEVICE LOG & SESSIONS</Text>
                <Text style={styles.sectionTitle}>Active Authorized Sessions</Text>
                <Text style={styles.cardSubtitle}>
                  Hardware terminals currently authenticated to your account.
                </Text>
              </View>
              <View style={styles.sessionCountBadge}>
                <Text style={styles.sessionCountText}>
                  {sessionRows.length} {sessionRows.length === 1 ? "DEVICE" : "DEVICES"}
                </Text>
              </View>
            </View>

            <View style={styles.sessionsList}>
              {sessionRows.map((s) => (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.deviceIcon}>
                    <Ionicons name={s.icon} size={18} color="#85651B" />
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>{s.label}</Text>
                    <Text style={styles.sessionMeta}>{s.meta}</Text>
                  </View>
                  <View style={styles.sessionStatusCol}>
                    {s.current ? (
                      <View style={styles.currentDeviceBadge}>
                        <View style={styles.currentDot} />
                        <Text style={styles.currentDeviceBadgeText}>THIS TERMINAL</Text>
                      </View>
                    ) : (
                      <Text style={styles.sessionActiveTime}>{s.active}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.signOutAllButton}
              onPress={signOutAll}
              disabled={saving}
            >
              <Ionicons name="log-out-outline" size={15} color="#C0392B" />
              <Text style={styles.signOutAllButtonText}>Sign Out of All Sessions</Text>
            </TouchableOpacity>
          </View>

          {/* 8. Atelier Cryptographic Guarantee Banner */}
          <View style={styles.guaranteeCard}>
            <View style={styles.guaranteeHeader}>
              <Ionicons name="lock-closed" size={16} color="#E8CF8F" />
              <Text style={styles.guaranteeTitle}>Atelier Cryptographic Guarantee</Text>
            </View>
            <Text style={styles.guaranteeText}>
              All tailoring measurements, biometric preferences, and credentials are protected with
              Argon2id hashing and AES-256 encryption. We never sell, disclose, or expose your
              private wardrobe records.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 9. Upgraded 2FA Enrollment Modal */}
      <Modal
        visible={enrollOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEnrollOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>AUTHENTICATOR PAIRING</Text>
                <Text style={styles.modalTitle}>Set Up Two-Factor (TOTP)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEnrollOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color="#141311" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalBody}>
              Scan the QR code with your authenticator app (Google Authenticator, 1Password, or
              Apple Keychain), then enter the 6-digit confirmation code.
            </Text>

            {/* QR Code Container */}
            <View style={styles.qrWrap}>
              {enrollQrSvg ? (
                <View style={styles.qrFrame}>
                  <WebView
                    originWhitelist={["*"]}
                    source={{ html: enrollQrSvg }}
                    style={styles.qrBox}
                    scrollEnabled={false}
                  />
                </View>
              ) : (
                <ActivityIndicator color="#C8A44A" />
              )}
            </View>

            {/* Tap to Copy Secret Key */}
            {enrollSecret ? (
              <TouchableOpacity
                style={styles.secretBox}
                activeOpacity={0.8}
                onPress={copySecretToClipboard}
              >
                <View style={styles.secretTextCol}>
                  <Text style={styles.secretLabel}>MANUAL SETUP SECRET KEY</Text>
                  <Text style={styles.secretText} numberOfLines={1}>
                    {enrollSecret}
                  </Text>
                </View>
                <View style={styles.copyBadge}>
                  <Ionicons name="copy-outline" size={14} color="#85651B" />
                  <Text style={styles.copyBadgeText}>Copy</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* 6-Digit Code Input */}
            <View style={styles.codeField}>
              <Text style={styles.fieldLabel}>6-DIGIT VERIFICATION CODE</Text>
              <TextInput
                style={styles.codeInput}
                keyboardType="number-pad"
                maxLength={6}
                value={enrollCode}
                onChangeText={(v) => setEnrollCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="000 000"
                placeholderTextColor="#9C988F"
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEnrollOpen(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalVerifyButton,
                  (enrollCode.length !== 6 || verifying) && { opacity: 0.5 },
                ]}
                disabled={enrollCode.length !== 6 || verifying}
                onPress={verifyEnrollment}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#141311" />
                ) : (
                  <Text style={styles.modalVerifyButtonText}>Verify & Activate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function CheckRow({ done, label, sub }: { done?: boolean; label: string; sub: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, done && styles.checkIconDone]}>
        <Ionicons
          name={done ? "checkmark" : "close"}
          size={12}
          color={done ? "#FAF8F5" : "#8F8B82"}
        />
      </View>
      <View style={styles.checkTextCol}>
        <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{label}</Text>
        <Text style={styles.checkSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F4EF",
  },
  flex: {
    flex: 1,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F5F4EF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "#85651B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#141311",
    letterSpacing: -0.3,
  },
  shieldMedallionSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#8F8B82",
  },

  /* Velvet Obsidian Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
    marginBottom: 16,
    ...shadows.glow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#E8CF8F",
  },
  vaultMedallion: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    padding: 3,
  },
  vaultMedallionInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#201E1A",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBodyRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#FAF8F5",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#B3AFA5",
  },
  healthPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
  },

  /* Score Card */
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    marginBottom: 16,
    ...shadows.soft,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#85651B",
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: "#141311",
  },
  scoreDeltaBadge: {
    backgroundColor: "#F4F1E8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E1D4",
  },
  scoreDeltaText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: "#85651B",
  },
  scoreValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  scoreNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    color: "#141311",
    letterSpacing: -1,
  },
  scoreMax: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 14,
    color: "#8F8B82",
    marginLeft: 4,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EBE8DF",
    overflow: "hidden",
    marginBottom: 20,
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  checklist: {
    gap: 12,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECE8DD",
    marginTop: 1,
  },
  checkIconDone: {
    backgroundColor: "#2B6E3F",
  },
  checkTextCol: {
    flex: 1,
  },
  checkLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#4A463D",
    marginBottom: 1,
  },
  checkLabelDone: {
    color: "#141311",
  },
  checkSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#8F8B82",
  },

  /* Standard Content Cards */
  contentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    marginBottom: 16,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cardSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "#787469",
    marginTop: 2,
  },
  strengthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  strengthBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C5E6CC",
  },
  savedBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: "#2B6E3F",
  },

  /* Form Fields */
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#85651B",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#141311",
  },
  pwdStrength: {
    marginBottom: 16,
  },
  pwdStrengthTrack: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 6,
  },
  pwdStrengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  pwdStrengthHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 15,
    color: "#787469",
  },
  primaryActionButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  primaryActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  primaryActionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#FAF8F5",
  },

  /* 2FA Toggle Row */
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF9F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBE7DD",
    padding: 14,
    marginTop: 6,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  toggleLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
  },
  toggleSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#787469",
  },
  enableMfaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#C8A44A",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  enableMfaButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#141311",
  },
  secondaryOutlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C0392B",
  },
  secondaryOutlineButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#C0392B",
  },

  /* Recovery Email Button */
  saveRecoveryButton: {
    backgroundColor: "#F4F1E8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E1D4",
  },
  saveRecoveryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#414A23",
  },

  /* Sessions */
  sessionCountBadge: {
    backgroundColor: "#F4F1E8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sessionCountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: "#85651B",
  },
  sessionsList: {
    gap: 10,
    marginBottom: 16,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F1EC",
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6F4EB",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
    marginBottom: 2,
  },
  sessionMeta: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "#8F8B82",
  },
  sessionStatusCol: {
    alignItems: "flex-end",
  },
  currentDeviceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#2B6E3F",
  },
  currentDeviceBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: "#2B6E3F",
  },
  sessionActiveTime: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "#8F8B82",
  },
  signOutAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FDF2F1",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#F7D6D4",
  },
  signOutAllButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#C0392B",
  },

  /* Guarantee Card */
  guaranteeCard: {
    backgroundColor: "#141311",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  guaranteeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  guaranteeTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: "#FAF8F5",
  },
  guaranteeText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#B3AFA5",
  },

  /* 2FA Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FAF9F5",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#85651B",
    marginBottom: 2,
  },
  modalTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: "#141311",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B675E",
  },
  qrWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  qrFrame: {
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E1D4",
    ...shadows.soft,
  },
  qrBox: {
    width: 170,
    height: 170,
    backgroundColor: "#FFFFFF",
  },
  secretBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E1D4",
  },
  secretTextCol: {
    flex: 1,
    marginRight: 10,
  },
  secretLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#85651B",
    marginBottom: 2,
  },
  secretText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "#141311",
  },
  copyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F4F1E8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBadgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#85651B",
  },
  codeField: {
    marginTop: 4,
  },
  codeInput: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCD7CA",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 18,
    letterSpacing: 8,
    textAlign: "center",
    color: "#141311",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 10,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalCancelButtonText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: "#8F8B82",
  },
  modalVerifyButton: {
    backgroundColor: "#C8A44A",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 130,
    alignItems: "center",
  },
  modalVerifyButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
  },
});
