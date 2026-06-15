import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/supabase/auth";
import { getBrandByOwner, updateBrand } from "@/lib/api";
import { Card, Button, Badge } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function BrandSettings() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const brandQuery = useQuery({
    queryKey: ["brand-owner", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await getBrandByOwner(user.id);
      return res.ok ? res.data : null;
    },
    enabled: !!user,
  });

  const brand = brandQuery.data;

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (brand) {
      setName(brand.name ?? "");
      setTagline(brand.tagline ?? "");
      setDescription(brand.description ?? "");
    }
  }, [brand?.id]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!brand) return;
      return updateBrand(brand.id, { name, tagline, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-owner"] });
      Alert.alert("Saved", "Brand settings updated.");
    },
  });

  if (!brand) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No brand found.</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Brand Settings</Text>
          <Badge
            variant={brand.status === "approved" ? "default" : "secondary"}
          >
            {brand.status}
          </Badge>
        </View>

        <Card style={styles.card}>
          <Text style={styles.label}>Brand Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Brand name"
            placeholderTextColor={colors.light.muted}
          />

          <Text style={styles.label}>Tagline</Text>
          <TextInput
            style={styles.input}
            value={tagline}
            onChangeText={setTagline}
            placeholder="Short tagline"
            placeholderTextColor={colors.light.muted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="About your brand"
            placeholderTextColor={colors.light.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>

        <Button
          onPress={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          style={styles.saveBtn}
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>

        <Button
          onPress={() => signOut()}
          variant="outline"
          style={styles.signOutBtn}
        >
          Sign Out
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground },
  card: { padding: 24, marginBottom: 24 },
  label: { fontSize: typography.fontSizes.sm, color: colors.light.muted, marginBottom: 4, marginTop: 16, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, padding: 16, fontSize: typography.fontSizes.base, color: colors.light.foreground, backgroundColor: colors.light.background },
  textArea: { height: 100 },
  saveBtn: { marginBottom: 16 },
  signOutBtn: { marginBottom: 32 },
  emptyText: { fontSize: typography.fontSizes.base, color: colors.light.muted },
});
