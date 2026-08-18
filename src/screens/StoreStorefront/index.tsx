import React from "react";
import { ActivityIndicator, View, Text, Pressable, StyleSheet } from "react-native";
import { MobileRenderer } from "./renderer";
import { usePublishedConfig } from "./hooks/usePublishedConfig";
import { useStorefrontContext } from "./hooks/useStorefrontContext";

interface Props {
  slug: string;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function StoreStorefrontScreen({ slug }: Props) {
  const { data, isLoading, error, refetch } = usePublishedConfig(slug);
  const ctx = useStorefrontContext(slug);
  const sessionId = React.useMemo(() => generateSessionId(), [slug]);

  if (isLoading || ctx.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  if (error || !data || !data.config) {
    return (
      <View style={styles.center}>
        <Text style={styles.errText}>Couldn't load this store.</Text>
        <Pressable onPress={() => { refetch(); ctx.refetch(); }} style={styles.btn}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <MobileRenderer
      config={data.config}
      slug={slug}
      sessionId={sessionId}
      products={ctx.products}
      storeId={ctx.store?.id ?? null}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#FAFAF7" },
  errText: { fontSize: 14, color: "#525252", marginBottom: 16 },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#1A1A1A" },
  btnText: { fontSize: 12, color: "#1A1A1A", textTransform: "uppercase", letterSpacing: 1 },
});