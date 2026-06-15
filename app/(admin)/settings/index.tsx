import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui";
import { colors, typography } from "@/lib/theme/tokens";

export default function AdminSettings() {
  const { user, signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin Settings</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.user_metadata?.full_name ?? "Admin"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? "—"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>Platform Administrator</Text>
      </View>

      <Button
        onPress={() => signOut()}
        variant="outline"
        style={styles.signOutBtn}
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 24 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground, marginBottom: 32 },
  section: { marginBottom: 24 },
  label: { fontSize: typography.fontSizes.sm, color: colors.light.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  value: { fontSize: typography.fontSizes.base, color: colors.light.foreground },
  signOutBtn: { marginTop: 32 },
});
