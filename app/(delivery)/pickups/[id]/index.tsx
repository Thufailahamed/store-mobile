import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import { deliveryPickupVerify, getReturnPickups, type ReturnPickup } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function ReturnPickupDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [pickup, setPickup] = useState<ReturnPickup | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [otp, setOtp] = useState("");
  const [failReason, setFailReason] = useState("");

  const load = useCallback(async () => {
    const res = await getReturnPickups();
    if (res.ok) {
      setPickup(res.data.pickups.find((p) => p.id === id) ?? null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = (action: "start" | "verify" | "complete" | "fail") => {
    if (!pickup || !user) return;

    const confirmAndRun = async () => {
      setActing(true);
      const res = await deliveryPickupVerify(pickup.id, action, {
        otp: action === "verify" ? otp.trim() : undefined,
        reason: action === "fail" ? failReason.trim() || "Pickup failed" : undefined,
      });
      setActing(false);
      if (res.ok) {
        Alert.alert("Updated", `Pickup marked as ${res.data.status}.`);
        load();
      } else {
        Alert.alert("Error", res.error);
      }
    };

    if (action === "fail") {
      Alert.alert("Mark failed?", "The buyer will be notified and pickup may be rescheduled.", [
        { text: "Cancel", style: "cancel" },
        { text: "Fail", style: "destructive", onPress: confirmAndRun },
      ]);
      return;
    }

    if (action === "verify" && otp.trim().length < 4) {
      Alert.alert("OTP required", "Enter the pickup verification code.");
      return;
    }

    confirmAndRun();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.light.primary} />
      </View>
    );
  }

  if (!pickup) {
    return (
      <View style={styles.center}>
        <Text>Pickup not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const addr = pickup.pickup_address;
  const mapsUrl = addr
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        [addr.line1, addr.city, addr.postal_code].filter(Boolean).join(", "),
      )}`
    : null;

  const canStart = pickup.status === "scheduled";
  const canVerify = pickup.status === "out_for_pickup";
  const canComplete = pickup.status === "picked_up";
  const canFail = !["completed", "cancelled", "failed"].includes(pickup.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backLink}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Return pickup</Text>
      <Text style={styles.status}>{pickup.status.replace(/_/g, " ")}</Text>

      {addr ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup address</Text>
          <Text style={styles.body}>
            {addr.full_name ? `${addr.full_name}\n` : ""}
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ""}
            {"\n"}
            {addr.city}, {addr.state} {addr.postal_code}
          </Text>
          {addr.phone ? (
            <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(`tel:${addr.phone}`)}>
              <Text style={styles.linkBtnText}>Call {addr.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {mapsUrl ? (
            <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(mapsUrl)}>
              <Text style={styles.linkBtnText}>Navigate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {canVerify ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verify pickup OTP</Text>
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>
      ) : null}

      {canFail ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Failure reason (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={failReason}
            onChangeText={setFailReason}
            placeholder="Why did the pickup fail?"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        {canStart ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => runAction("start")} disabled={acting}>
            <Text style={styles.primaryBtnText}>Start pickup run</Text>
          </TouchableOpacity>
        ) : null}
        {canVerify ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => runAction("verify")} disabled={acting}>
            <Text style={styles.primaryBtnText}>Verify & collect items</Text>
          </TouchableOpacity>
        ) : null}
        {canComplete ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => runAction("complete")} disabled={acting}>
            <Text style={styles.primaryBtnText}>Complete at hub</Text>
          </TouchableOpacity>
        ) : null}
        {canFail ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={() => runAction("fail")} disabled={acting}>
            <Text style={styles.dangerBtnText}>Mark failed</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backLink: { color: colors.light.primary, marginBottom: 16 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold as any },
  status: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4, textTransform: "capitalize", marginBottom: 20 },
  section: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold as any, color: colors.light.mutedForeground, textTransform: "uppercase", marginBottom: 8 },
  body: { fontSize: typography.fontSizes.sm, lineHeight: 22, color: colors.light.foreground },
  linkBtn: { marginTop: 10, paddingVertical: 10, alignItems: "center", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border },
  linkBtnText: { color: colors.light.primary, fontWeight: typography.fontWeights.medium as any },
  otpInput: { backgroundColor: colors.light.background, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg, padding: 14, fontSize: 20, textAlign: "center", letterSpacing: 6 },
  notesInput: { backgroundColor: colors.light.background, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg, padding: 12 },
  actions: { gap: 10, marginTop: 8 },
  primaryBtn: { backgroundColor: colors.light.primary, padding: 14, borderRadius: radii.lg, alignItems: "center" },
  primaryBtnText: { color: colors.light.primaryForeground, fontWeight: typography.fontWeights.semibold as any },
  dangerBtn: { padding: 14, borderRadius: radii.lg, alignItems: "center", borderWidth: 1, borderColor: "#fecaca" },
  dangerBtnText: { color: "#dc2626", fontWeight: typography.fontWeights.semibold as any },
});
