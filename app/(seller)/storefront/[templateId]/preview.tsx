import React from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import { createStorefrontPreviewTokenBackend, type StorefrontChannel } from "@/lib/api/backend";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import Constants from "expo-constants";

function getPublicHost(): string {
  const extra = (Constants?.expoConfig?.extra ?? {}) as { publicHost?: string };
  return extra.publicHost ?? "https://synapstore.shop";
}

export default function PreviewScreen() {
  const { channel } = useLocalSearchParams<{ channel: StorefrontChannel }>();
  const router = useRouter();
  const ch = (channel === "app" ? "app" : "web") as StorefrontChannel;

  const { data, isLoading, error } = useQuery({
    queryKey: ["preview-token", ch],
    queryFn: () => createStorefrontPreviewTokenBackend({ channel: ch, ttlHours: 24 }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading preview" />
      </View>
    );
  }

  if (error || !data?.ok) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to create preview link.</Text>
      </View>
    );
  }

  const url = `${getPublicHost()}/storefront/preview/${data.data.token}?device=mobile&channel=${ch}`;

  return (
    <View style={styles.container}>
      <WebView
        testID="storefront-preview-webview"
        source={{ uri: url }}
        javaScriptEnabled
        domStorageEnabled
        allowsZoom={false}
        scalesPageToFit={false}
        originWhitelist={["*"]}
        injectedJavaScriptBeforeContentLoaded="document.querySelector('meta[name=viewport]')?.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no')"
        style={styles.webview}
      />
      <Pressable onPress={() => router.back()} accessibilityLabel="Close preview" style={styles.close}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  webview: { flex: 1 },
  close: { position: "absolute", top: spacing[4], right: spacing[4], paddingHorizontal: spacing[3], paddingVertical: spacing[2], backgroundColor: colors.light.background, borderRadius: 8, borderWidth: 1, borderColor: colors.light.border },
  closeText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  error: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
});
