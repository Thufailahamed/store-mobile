import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { acceptBrandInvite } from "@/lib/api";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Status = "loading" | "ok" | "err";

export default function BrandAccept() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = React.useState<Status>(token ? "loading" : "err");
  const [error, setError] = React.useState<string | null>(token ? null : "Missing invite token.");

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const r = await acceptBrandInvite(token);
      if (cancelled) return;
      if (r.ok) {
        setStatus("ok");
        setTimeout(() => router.replace("/(brand)"), 1500);
      } else {
        setStatus("err");
        setError(typeof r.error === "string" ? r.error : "This invite link is invalid or expired.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <View style={styles.root}>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          {status === "loading" ? (
            <ActivityIndicator color={colors.light.primary} />
          ) : (
            <Ionicons
              name={status === "ok" ? "checkmark-circle" : "alert-circle"}
              size={48}
              color={status === "ok" ? colors.light.primary : "#b54545"}
            />
          )}
        </View>
        <Text style={styles.title}>
          {status === "loading" ? "Joining brand..." : status === "ok" ? "Welcome aboard" : "Invite not valid"}
        </Text>
        <Text style={styles.body}>
          {status === "loading"
            ? "Confirming your invite and adding you to the team."
            : status === "ok"
              ? "Redirecting you to the brand portal..."
              : error}
        </Text>
        {status === "err" ? (
          <Button variant="outline" onPress={() => router.replace("/")} style={styles.btn}>
            Back to home
          </Button>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background, justifyContent: "center", padding: 24 },
  card: { padding: 24, alignItems: "center", gap: 12 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.light.muted, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.xl, color: colors.light.foreground, textAlign: "center" },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", lineHeight: 20 },
  btn: { marginTop: 12, alignSelf: "stretch" },
});