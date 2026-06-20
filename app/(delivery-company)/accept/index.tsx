import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase/client";
import { acceptDriverInvite, hasStoreApi } from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<"idle" | "accepting" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  // Capture the token ONCE from the URL into a local ref, then immediately
  // scrub it from the URL so it doesn't sit in router history, deep-link
  // logs, or referer headers. Subsequent renders (and screen remounts)
  // cannot resurrect it from the params.
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    const fromUrl = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : undefined;
    if (fromUrl && !tokenRef.current) {
      tokenRef.current = fromUrl;
      // Drop the token from the URL state.
      router.setParams({ token: undefined });
    }
  }, [params.token, router]);

  const token = tokenRef.current;

  if (!token) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={styles.title}>Invalid invite</Text>
        <Text style={styles.sub}>This link is missing the invite token.</Text>
      </View>
    );
  }

  const accept = async () => {
    if (status === "accepting" || status === "ok") return; // double-tap guard
    if (!hasStoreApi()) {
      Alert.alert("Not configured", "EXPO_PUBLIC_STORE_API_URL is required.");
      return;
    }
    setStatus("accepting");
    setError(null);
    const res = await acceptDriverInvite(token);
    // Zero out the ref as soon as the server has accepted the call so it
    // can't be reused even if the component state lingers.
    tokenRef.current = null;
    if (!res.ok) {
      setStatus("err");
      setError(res.error);
      return;
    }
    setStatus("ok");
    await supabase.auth.refreshSession().catch(() => undefined);
    setTimeout(() => router.replace("/(delivery)"), 1200);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32, paddingHorizontal: 24 }]}>
      {status === "ok" ? (
        <>
          <Ionicons name="checkmark-circle" size={56} color={colors.light.primary} />
          <Text style={styles.title}>Welcome to the team</Text>
          <Text style={styles.sub}>Redirecting to the rider app…</Text>
        </>
      ) : (
        <>
          <Ionicons name="mail-open-outline" size={48} color={colors.light.primary} />
          <Text style={styles.title}>Join delivery team</Text>
          <Text style={styles.sub}>Accept this invite to start receiving assignments from your logistics company.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.btn, status === "accepting" && styles.btnDisabled]}
            onPress={accept}
            disabled={status === "accepting"}
          >
            {status === "accepting" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Accept invite</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background, alignItems: "center" },
  title: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, marginTop: 16, textAlign: "center" },
  sub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 8, textAlign: "center" },
  error: { color: "#dc2626", marginTop: 12, textAlign: "center" },
  btn: {
    marginTop: 24,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radii.lg,
    minWidth: 200,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
});