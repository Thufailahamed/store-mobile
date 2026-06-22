import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Badge, Button, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface DeviceInfo {
  os: string;
  osVersion: string;
  model: string;
  appVersion: string;
}

function readDeviceInfo(): DeviceInfo {
  return {
    os: Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web",
    osVersion: String(Platform.Version ?? "—"),
    model: (Platform as any).select?.({})?.toString?.() ?? "Mobile",
    appVersion: "1.0.0",
  };
}

function strengthOf(pwd: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pwd) return { score: 0, label: "Empty", color: colors.light.border };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  const labels = ["Empty", "Weak", "Fair", "Good", "Strong"] as const;
  const palette = [
    colors.light.border,
    colors.light.destructive,
    colors.accent2.ochre,
    colors.olive[500],
    colors.olive[700],
  ];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] ?? "Empty", color: palette[score] ?? colors.light.border };
}

export default function SecurityScreen() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryEmailSaved, setRecoveryEmailSaved] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [device] = useState<DeviceInfo>(readDeviceInfo());

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    supabase
      .from("users")
      .select("mfa_enabled, metadata")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setMfaEnabled(Boolean(data.mfa_enabled));
          const savedEmail = (data as any).metadata?.recovery_email ?? "";
          setRecoveryEmail(savedEmail);
          setRecoveryEmailSaved(savedEmail);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleMfa = async (checked: boolean) => {
    if (!user?.id) return;
    setMfaEnabled(checked);
    const { error } = await supabase.from("users").update({ mfa_enabled: checked }).eq("id", user.id);
    if (error) {
      setMfaEnabled(!checked);
      toast(error.message, "error");
    } else {
      toast(checked ? "Two-factor authentication enabled" : "Two-factor authentication disabled", "success");
    }
  };

  const changePassword = async () => {
    if (!newPassword.trim()) {
      toast("Enter a new password", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }

    setSaving(true);
    try {
      const payload: { password: string } = { password: newPassword };
      const { error } = await supabase.auth.updateUser(payload as any);
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      toast("Password updated", "success");
    } catch (error: any) {
      toast(error?.message ?? "Could not update password", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveRecoveryEmail = async () => {
    if (!user?.id) return;
    if (recoveryEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(recoveryEmail)) {
      toast("Enter a valid email", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("update_privacy_prefs", {
      p_patch: { recovery_email: recoveryEmail },
    });
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    setRecoveryEmailSaved(recoveryEmail);
    toast("Recovery email saved", "success");
  };

  const signOutAll = () => {
    Alert.alert("Sign out everywhere", "End every active session on all devices, including this one.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out all",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut({ scope: "global" } as any);
            toast("Signed out of every device", "success");
            await signOut();
          } catch (error: any) {
            toast(error?.message ?? "Could not sign out", "error");
          }
        },
      },
    ]);
  };

  const score = mfaEnabled ? 95 : 60;
  const pwdStrength = strengthOf(newPassword);

  const sessions = useMemo(() => {
    const list: {
      id: string;
      label: string;
      meta: string;
      current: boolean;
      icon: keyof typeof Ionicons.glyphMap;
    }[] = [
      {
        id: "this",
        label: `${device.os} · LUXE Mobile`,
        meta: `${device.osVersion} · This device · Active now`,
        current: true,
        icon: "phone-portrait-outline",
      },
    ];
    return list;
  }, [device]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Security" />
        <View style={styles.loading}><Body muted>Loading security…</Body></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Security" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Label style={styles.heroLabel}>Account protection</Label>
            <Display size="2xl" style={styles.heroTitle}>Fort Knox calm</Display>
            <Body muted>Your account is in good shape. Tighten a few controls and breathe easier.</Body>
          </View>
          <View style={styles.health}>
            <View style={[styles.liveDot, { backgroundColor: score >= 90 ? colors.olive[600] : colors.accent2.ochre }]} />
            <Label>{score >= 90 ? "Healthy" : "Improve"}</Label>
          </View>
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Label style={styles.sectionLabel}>Security score</Label>
            <Label style={styles.scoreDelta}>
              {score >= 90 ? "+5 this week" : "+0 this week"}
            </Label>
          </View>
          <Display size="3xl" style={styles.score}>
            {score}
            <Body size="lg" muted>/100</Body>
          </Display>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${score}%`, backgroundColor: score >= 90 ? colors.olive[600] : colors.accent2.ochre }]} />
          </View>
          <View style={styles.checklist}>
            <CheckRow done label="Strong password" />
            <CheckRow done={mfaEnabled} label="Two-factor on" />
            <CheckRow done={!!recoveryEmailSaved} label="Recovery email set" />
            <CheckRow done label="Recent activity reviewed" />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Display size="lg">Password</Display>
              <Body muted size="xs">Change your sign-in password.</Body>
            </View>
            <Badge style={{ backgroundColor: pwdStrength.color + "30" }}>
              <Label style={{ color: pwdStrength.color, fontSize: 9 }}>{pwdStrength.label.toUpperCase()}</Label>
            </Badge>
          </View>
          <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          {newPassword.length > 0 && (
            <View style={styles.pwdStrength}>
              <View style={styles.pwdStrengthTrack}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.pwdStrengthSegment,
                      { backgroundColor: i <= pwdStrength.score ? pwdStrength.color : colors.light.border },
                    ]}
                  />
                ))}
              </View>
              <Body muted size="xs" style={styles.pwdStrengthHint}>
                Mix upper, lower, numbers, and a symbol for 12+ chars.
              </Body>
            </View>
          )}
          <Button loading={saving} onPress={changePassword} disabled={newPassword.length < 8}>
            Change password
          </Button>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Display size="lg">Two-factor authentication</Display>
              <Body muted size="xs">Authenticator codes on every sign-in.</Body>
            </View>
            <Badge style={{ backgroundColor: mfaEnabled ? colors.olive[100] : colors.light.border }}>
              <Label style={{ color: mfaEnabled ? colors.olive[700] : colors.light.mutedForeground, fontSize: 9 }}>{mfaEnabled ? "ON" : "OFF"}</Label>
            </Badge>
          </View>
          <Body muted>Codes generated by your authenticator app on every sign-in. Keep 2FA enabled for the strongest account protection.</Body>
          <View style={styles.toggleRow}>
            <Body style={styles.toggleLabel}>Authenticator app</Body>
            <Switch
              value={mfaEnabled}
              onValueChange={toggleMfa}
              trackColor={{ false: colors.light.border, true: colors.light.primary }}
              thumbColor={colors.paper.cream}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Display size="lg">Recovery email</Display>
              <Body muted size="xs">A second inbox for password resets and security alerts.</Body>
            </View>
            {recoveryEmailSaved && (
              <Badge style={{ backgroundColor: colors.olive[100] }}>
                <Label style={{ color: colors.olive[700], fontSize: 9 }}>SAVED</Label>
              </Badge>
            )}
          </View>
          <Field label="Email" value={recoveryEmail} onChangeText={setRecoveryEmail} keyboardType="email-address" icon="mail-outline" />
          <Button variant="outline" onPress={saveRecoveryEmail}>Save recovery email</Button>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Display size="lg">Active sessions</Display>
              <Body muted size="xs">Where your account is signed in.</Body>
            </View>
            <Badge style={{ backgroundColor: colors.olive[100] }}>
              <Label style={{ color: colors.olive[700], fontSize: 9 }}>{sessions.length}</Label>
            </Badge>
          </View>
          {sessions.map((s) => (
            <View key={s.id} style={styles.sessionRow}>
              <View style={styles.deviceIcon}>
                <Ionicons name={s.icon} size={20} color={colors.light.primary} />
              </View>
              <View style={styles.sessionInfo}>
                <Body style={styles.sessionTitle}>{s.label}</Body>
                <Body muted size="xs">{s.meta}</Body>
              </View>
              {s.current && (
                <Badge style={{ backgroundColor: colors.olive[100] }}>
                  <Label style={{ color: colors.olive[700], fontSize: 9 }}>THIS DEVICE</Label>
                </Badge>
              )}
            </View>
          ))}
          <Button variant="destructive" onPress={signOutAll}>
            Sign out of all sessions
          </Button>
        </View>

        <View style={styles.tip}>
          <Ionicons name="sparkles" size={22} color={colors.olive[950]} />
          <Display size="lg" style={styles.tipTitle}>Beef it up</Display>
          <Body style={styles.tipText}>Enable 2FA and rotate your password every few months for stronger protection. Set a recovery email so you are never locked out.</Body>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>
        {icon ? <Ionicons name={icon} size={11} color={colors.light.mutedForeground} /> : null} {label}
      </Label>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

function CheckRow({ done, label }: { done?: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, done && styles.checkIconDone]}>
        <Ionicons name={done ? "checkmark" : "close"} size={12} color={done ? colors.paper.cream : colors.light.mutedForeground} />
      </View>
      <Body muted size="xs">{label}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
  },
  heroLabel: { color: colors.light.mutedForeground },
  heroTitle: { marginTop: spacing[2], marginBottom: spacing[2] },
  health: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  scoreCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
  },
  scoreHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { color: colors.light.mutedForeground },
  scoreDelta: {
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
  },
  score: { marginTop: spacing[2], marginBottom: spacing[3] },
  track: {
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.light.border,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radii.full },
  checklist: { marginTop: spacing[4], gap: 8 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.border,
  },
  checkIconDone: { backgroundColor: colors.olive[600] },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 18,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[5],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: spacing[4],
  },
  field: { gap: 7, marginBottom: spacing[3] },
  fieldLabel: {
    color: colors.light.mutedForeground,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  input: {
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
  },
  pwdStrength: { marginBottom: spacing[3] },
  pwdStrengthTrack: { flexDirection: "row", gap: 4 },
  pwdStrengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  pwdStrengthHint: { marginTop: 6 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    marginTop: spacing[2],
  },
  toggleLabel: { fontWeight: typography.fontWeights.semibold },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    marginBottom: spacing[3],
  },
  deviceIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontWeight: typography.fontWeights.semibold },
  tip: {
    backgroundColor: colors.olive[950],
    borderRadius: radii["2xl"],
    padding: 20,
    gap: spacing[2],
  },
  tipTitle: { color: colors.paper.cream },
  tipText: { color: "rgba(245, 244, 239, 0.75)" },
});
