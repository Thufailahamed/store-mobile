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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
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

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";
const GREEN = "#15803d";

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const healthy = score >= 90;

  const sessionRows = useMemo(() => {
    if (sessions.length === 0) {
      return [
        {
          id: "this",
          label: `${device.os} · LUXE Mobile`,
          meta: `${device.osVersion} · Primary device`,
          current: true,
          icon: "phone-portrait-outline" as const,
          active: "Active now",
        },
      ];
    }
    return sessions.map((s) => ({
      id: s.id,
      label: `${s.os} · ${s.browser}`,
      meta: `${s.location ?? "Private location"}${s.ip ? ` · ${s.ip}` : ""}`,
      current: s.current,
      icon: DEVICE_ICON[s.device] ?? ("phone-portrait-outline" as const),
      active: timeAgo(s.last_active),
    }));
  }, [sessions, device]);

  const header = (
    <View style={styles.navBar}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.navBtn}
        activeOpacity={0.7}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
      </TouchableOpacity>

      <Text style={styles.navTitle}>Security</Text>

      <View style={styles.navBtn}>
        <Ionicons
          name={healthy ? "shield-checkmark" : "shield-outline"}
          size={17}
          color={healthy ? GREEN : GOLD_DEEP}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <PaperBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          {header}
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={GOLD} size="small" />
            <Text style={styles.loadingText}>Loading security settings…</Text>
          </View>
        </SafeAreaView>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Heading */}
            <View style={styles.pageHead}>
              <Text style={styles.eyebrow}>Account protection</Text>
              <Text style={styles.pageTitle}>
                Security &amp; <Text style={styles.pageTitleAccent}>privacy.</Text>
              </Text>
            </View>

            {/* Score hero */}
            <View style={styles.scoreCard}>
              <View style={styles.scoreTop}>
                <View>
                  <Text style={styles.eyebrow}>Security score</Text>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreNum}>{score}</Text>
                    <Text style={styles.scoreMax}>/100</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.scorePill,
                    healthy ? styles.scorePillGood : styles.scorePillWarn,
                  ]}
                >
                  <View
                    style={[
                      styles.scoreDot,
                      { backgroundColor: healthy ? GREEN : GOLD_DEEP },
                    ]}
                  />
                  <Text
                    style={[
                      styles.scorePillText,
                      { color: healthy ? GREEN : GOLD_DEEP },
                    ]}
                  >
                    {healthy ? "Excellent" : "Can improve"}
                  </Text>
                </View>
              </View>

              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${score}%`,
                      backgroundColor: healthy ? GREEN : GOLD,
                    },
                  ]}
                />
              </View>

              <View style={styles.checklist}>
                <CheckRow
                  done
                  label="Password sign-in"
                  sub="Active and up to date"
                />
                <CheckRow
                  done={mfaEnabled}
                  label="Two-factor authentication"
                  sub={mfaEnabled ? "Enabled via authenticator app" : "Enable authenticator codes"}
                />
                <CheckRow
                  done={!!recoveryEmailSaved}
                  label="Recovery email"
                  sub={recoveryEmailSaved ? recoveryEmailSaved : "None set"}
                />
                <CheckRow
                  done
                  label="Sessions reviewed"
                  sub="No unrecognized devices"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.eyebrow}>Credentials</Text>
                  <Text style={styles.cardTitle}>Password</Text>
                </View>
                {newPassword.length > 0 && (
                  <View
                    style={[
                      styles.strengthPill,
                      {
                        backgroundColor: pwdStrength.color + "18",
                      },
                    ]}
                  >
                    <Text style={[styles.strengthPillText, { color: pwdStrength.color }]}>
                      {pwdStrength.label}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardCopy}>Change your account password.</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.light.mutedForeground}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                      size={17}
                      color={colors.light.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={colors.light.mutedForeground}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                      size={17}
                      color={colors.light.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {newPassword.length > 0 && (
                <View style={styles.strengthRow}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSeg,
                        {
                          backgroundColor:
                            i <= pwdStrength.score ? pwdStrength.color : "rgba(22,23,15,0.1)",
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (saving || newPassword.length < 8) && { opacity: 0.5 },
                ]}
                disabled={saving || newPassword.length < 8}
                onPress={changePassword}
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator color={colors.paper.cream} size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Update password</Text>
                    <View style={styles.primaryBtnArrow}>
                      <Ionicons name="checkmark" size={14} color={colors.olive[900]} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* 2FA */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.eyebrow}>Two-factor</Text>
                  <Text style={styles.cardTitle}>Authenticator app</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    mfaEnabled ? styles.statusPillOn : styles.statusPillOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: mfaEnabled ? GREEN : GOLD_DEEP },
                    ]}
                  >
                    {mfaEnabled ? "On" : "Off"}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardCopy}>
                One-time codes from Google Authenticator, 1Password, or Authy add a
                second layer to sign-in.
              </Text>

              {mfaEnabled ? (
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={disableMfa}
                  activeOpacity={0.8}
                >
                  <Text style={styles.outlineBtnText}>Disable two-factor</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={startEnroll}
                  disabled={enrollBusy}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                >
                  {enrollBusy ? (
                    <ActivityIndicator size="small" color={colors.paper.cream} />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Set up two-factor</Text>
                      <View style={styles.primaryBtnArrow}>
                        <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Recovery email */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.eyebrow}>Recovery</Text>
                  <Text style={styles.cardTitle}>Recovery email</Text>
                </View>
                {recoveryEmailSaved ? (
                  <View style={[styles.statusPill, styles.statusPillOn]}>
                    <Text style={[styles.statusPillText, { color: GREEN }]}>Saved</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardCopy}>
                A second address for restoring access if you're ever locked out.
              </Text>

              <View style={styles.fieldGroup}>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={colors.light.mutedForeground}
                  />
                  <TextInput
                    style={styles.input}
                    value={recoveryEmail}
                    onChangeText={setRecoveryEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="backup@example.com"
                    placeholderTextColor={colors.light.mutedForeground}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.outlineBtn, saving && { opacity: 0.6 }]}
                onPress={saveRecoveryEmail}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.outlineBtnText}>
                  {saving ? "Saving…" : "Save recovery email"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sessions */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.eyebrow}>Sessions</Text>
                  <Text style={styles.cardTitle}>Signed-in devices</Text>
                </View>
                <Text style={styles.cardCount}>
                  {sessionRows.length} {sessionRows.length === 1 ? "device" : "devices"}
                </Text>
              </View>
              <Text style={styles.cardCopy}>
                Devices currently signed in to your account.
              </Text>

              <View>
                {sessionRows.map((s, i) => (
                  <View key={s.id} style={[styles.sessionRow, i > 0 && styles.rowDivider]}>
                    <View style={styles.sessionIcon}>
                      <Ionicons name={s.icon} size={16} color={colors.olive[700]} />
                    </View>
                    <View style={styles.sessionBody}>
                      <Text style={styles.sessionTitle}>{s.label}</Text>
                      <Text style={styles.sessionMeta} numberOfLines={1}>
                        {s.meta}
                      </Text>
                    </View>
                    {s.current ? (
                      <View style={styles.thisDevice}>
                        <Text style={styles.thisDeviceText}>This device</Text>
                      </View>
                    ) : (
                      <Text style={styles.sessionActive}>{s.active}</Text>
                    )}
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={signOutAll}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={15} color={colors.accent2.rust} />
                <Text style={styles.dangerBtnText}>Sign out of all devices</Text>
              </TouchableOpacity>
            </View>

            {/* Footnote */}
            <View style={styles.footnote}>
              <Ionicons name="lock-closed-outline" size={13} color={GOLD_DEEP} />
              <Text style={styles.footnoteText}>
                Your data is encrypted at rest and in transit. We never sell or share
                your private information.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* 2FA enrollment sheet */}
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
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setEnrollOpen(false)}
            />
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing[5] }]}>
              <View style={styles.modalGrabber} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Set up two-factor</Text>
                <TouchableOpacity
                  onPress={() => setEnrollOpen(false)}
                  style={styles.modalClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={18} color={colors.light.foreground} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalBody}>
                Scan this code with your authenticator app, then enter the 6-digit
                code it generates.
              </Text>

              {/* QR */}
              <View style={styles.qrWrap}>
                {enrollQrSvg ? (
                  <WebView
                    originWhitelist={["*"]}
                    source={{ html: enrollQrSvg }}
                    style={styles.qrBox}
                    scrollEnabled={false}
                  />
                ) : (
                  <ActivityIndicator color={GOLD} />
                )}
              </View>

              {/* Manual secret */}
              {enrollSecret ? (
                <TouchableOpacity
                  style={styles.secretBox}
                  activeOpacity={0.8}
                  onPress={copySecretToClipboard}
                  accessibilityRole="button"
                >
                  <View style={styles.secretCol}>
                    <Text style={styles.secretLabel}>Or enter this key manually</Text>
                    <Text style={styles.secretText} numberOfLines={1}>
                      {enrollSecret}
                    </Text>
                  </View>
                  <Ionicons name="copy-outline" size={16} color={GOLD_DEEP} />
                </TouchableOpacity>
              ) : null}

              {/* Code input */}
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.codeInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={enrollCode}
                  onChangeText={(v) => setEnrollCode(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.light.mutedForeground}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (enrollCode.length !== 6 || verifying) && { opacity: 0.5 },
                ]}
                disabled={enrollCode.length !== 6 || verifying}
                onPress={verifyEnrollment}
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                {verifying ? (
                  <ActivityIndicator size="small" color={colors.paper.cream} />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Verify &amp; enable</Text>
                    <View style={styles.primaryBtnArrow}>
                      <Ionicons name="checkmark" size={14} color={colors.olive[900]} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </PaperBackground>
  );
}

function CheckRow({
  done,
  label,
  sub,
}: {
  done?: boolean;
  label: string;
  sub: string;
}) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, done ? styles.checkIconDone : styles.checkIconMiss]}>
        <Ionicons
          name={done ? "checkmark" : "add"}
          size={11}
          color={done ? colors.paper.cream : colors.light.mutedForeground}
        />
      </View>
      <View style={styles.checkTextCol}>
        <Text style={[styles.checkLabel, !done && styles.checkLabelMuted]}>{label}</Text>
        <Text style={styles.checkSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 13.5,
    color: colors.light.mutedForeground,
  },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: 14,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },

  /* Score card */
  scoreCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[5],
    ...shadows.soft,
  },
  scoreTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  scoreNum: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 44,
    letterSpacing: -1.2,
    color: colors.light.foreground,
  },
  scoreMax: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: colors.light.mutedForeground,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  scorePillGood: {
    backgroundColor: "rgba(21, 128, 61, 0.1)",
  },
  scorePillWarn: {
    backgroundColor: "rgba(200, 164, 74, 0.14)",
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scorePillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(22, 23, 15, 0.08)",
    overflow: "hidden",
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  checklist: {
    marginTop: spacing[2],
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[2.5],
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkIconDone: {
    backgroundColor: colors.olive[900],
  },
  checkIconMiss: {
    backgroundColor: "rgba(22, 23, 15, 0.08)",
  },
  checkTextCol: {
    flex: 1,
    gap: 1,
  },
  checkLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  checkLabelMuted: {
    color: colors.light.mutedForeground,
  },
  checkSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },

  /* Generic card */
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[5],
    gap: spacing[3],
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardHeaderText: {
    flexShrink: 1,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    marginTop: 2,
  },
  cardCopy: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.light.mutedForeground,
    marginTop: -4,
  },
  cardCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },

  /* Fields */
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
    paddingHorizontal: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.paper.warm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.foreground,
    padding: 0,
  },
  strengthRow: {
    flexDirection: "row",
    gap: 6,
  },
  strengthSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  strengthPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusPillOn: {
    backgroundColor: "rgba(21, 128, 61, 0.1)",
  },
  statusPillOff: {
    backgroundColor: "rgba(200, 164, 74, 0.14)",
  },
  statusPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
  },

  /* Buttons */
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    paddingRight: 6,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: colors.paper.warm,
  },
  outlineBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(184, 92, 58, 0.35)",
  },
  dangerBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.accent2.rust,
  },

  /* Sessions */
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionBody: {
    flex: 1,
    gap: 2,
  },
  sessionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  sessionMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  thisDevice: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.14)",
  },
  thisDeviceText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: GOLD_DEEP,
  },
  sessionActive: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },

  /* Footnote */
  footnote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  footnoteText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.light.mutedForeground,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20, 22, 13, 0.45)",
  },
  modalDismiss: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: colors.paper.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    gap: spacing[4],
  },
  modalGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(22, 23, 15, 0.12)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
  },
  qrWrap: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    overflow: "hidden",
  },
  qrBox: {
    width: 160,
    height: 160,
    backgroundColor: "transparent",
  },
  secretBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.paper.warm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secretCol: {
    flex: 1,
    gap: 2,
  },
  secretLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  secretText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.light.foreground,
  },
  codeInput: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: "center",
    color: colors.light.foreground,
    padding: 0,
  },
});
