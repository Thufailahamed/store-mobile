import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { publishStorefrontBackend, type StorefrontChannel } from "@/lib/api/backend";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Target = StorefrontChannel | "both";
const TARGETS: Target[] = ["web", "app", "both"];

export default function PublishScreen() {
  const { channel } = useLocalSearchParams<{ channel: StorefrontChannel }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [target, setTarget] = useState<Target>(channel === "app" ? "app" : "both");

  const mutation = useMutation({
    mutationFn: () => publishStorefrontBackend({ channel: target }),
    onSuccess: (res) => {
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["storefront"] });
        Alert.alert("Published", "Your storefront is live.", [{ text: "OK", onPress: () => router.back() }]);
      } else {
        Alert.alert("Publish failed", res.error ?? "Try again.");
      }
    },
    onError: (e: any) => Alert.alert("Publish failed", e?.message ?? "Try again."),
  });

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Publish storefront</Text>
        <Text style={styles.copy}>Choose where this version should go live.</Text>
        <View style={styles.options}>
          {TARGETS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTarget(t)}
              accessibilityRole="radio"
              accessibilityState={{ selected: target === t }}
              accessibilityLabel={`Publish to ${t}`}
              style={[styles.option, target === t && styles.optionActive]}
            >
              <Text style={[styles.optionText, target === t && styles.optionTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          accessibilityLabel="Publish storefront"
        >
          {mutation.isPending ? "Publishing…" : "Publish"}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[4] },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  copy: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  options: { flexDirection: "row", gap: spacing[2] },
  option: { flex: 1, paddingVertical: spacing[3], alignItems: "center", borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, backgroundColor: colors.light.background },
  optionActive: { borderColor: colors.light.primary, backgroundColor: colors.light.primary + "15" },
  optionText: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  optionTextActive: { fontFamily: fontFamilies.sans.semibold, color: colors.light.primary },
});
