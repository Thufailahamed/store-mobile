import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "@/components/storefront-editor/SectionCard";
import { Button } from "@/components/ui/Button";
import {
  getStorefrontBackend,
  saveStorefrontDraftBackend,
  type StorefrontConfig,
  type StorefrontSection,
  type StorefrontChannel,
} from "@/lib/api/backend";
import { loadDraft, saveDraft } from "@/lib/storefront/draft-cache";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const AUTOSAVE_MS = 5000;

export default function StorefrontEdit() {
  const { templateId, channel } = useLocalSearchParams<{ templateId: string; channel: StorefrontChannel }>();
  const router = useRouter();
  const qc = useQueryClient();
  const ch = (channel === "app" ? "app" : "web") as StorefrontChannel;

  const { data, isLoading, error } = useQuery({
    queryKey: ["storefront", ch],
    queryFn: () => getStorefrontBackend(ch),
  });

  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from cache → backend
  useEffect(() => {
    if (!data?.ok) return;
    setStoreId(data.data.storeId);
    (async () => {
      const cached = await loadDraft(data.data.storeId, ch);
      setConfig(cached ?? data.data.config);
    })();
  }, [data, ch]);

  // Debounced autosave
  useEffect(() => {
    if (!config || !dirty || !storeId) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(async () => {
      setSaving(true);
      await saveDraft(storeId, ch, config);
      await saveStorefrontDraftBackend(ch, config);
      setSaving(false);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["storefront", ch] });
    }, AUTOSAVE_MS);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [config, dirty, storeId, ch, qc]);

  const onSectionChange = (id: string, content: Record<string, unknown>) => {
    if (!config) return;
    setConfig({
      ...config,
      templateSlug: templateId ?? config.templateSlug,
      sections: config.sections.map((s) => s.id === id ? { ...s, content } : s),
    });
    setDirty(true);
  };

  const moveSection = (id: string, delta: number) => {
    if (!config) return;
    const idx = config.sections.findIndex((s) => s.id === id);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= config.sections.length) return;
    const sections = [...config.sections];
    [sections[idx], sections[next]] = [sections[next], sections[idx]];
    sections.forEach((s, i) => (s.position = i));
    setConfig({ ...config, sections });
    setDirty(true);
  };

  const deleteSection = (id: string) => {
    if (!config) return;
    Alert.alert("Delete section?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setConfig({ ...config, sections: config.sections.filter((s) => s.id !== id) });
          setDirty(true);
        },
      },
    ]);
  };

  if (isLoading || !config) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading storefront" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load storefront.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityLabel="Preview storefront"
          onPress={() => router.push(`/(seller)/storefront/${templateId}/preview?channel=${ch}` as any)}
          style={styles.toolbarBtn}
        >
          <Text style={styles.toolbarText}>Preview</Text>
        </Pressable>
        <Text style={styles.saveStatus}>{saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}</Text>
        <Pressable
          accessibilityLabel="Publish storefront"
          onPress={() => router.push(`/(seller)/storefront/${templateId}/publish?channel=${ch}` as any)}
          style={[styles.toolbarBtn, styles.publishBtn]}
        >
          <Text style={[styles.toolbarText, styles.publishText]}>Publish</Text>
        </Pressable>
      </View>
      <FlatList
        data={config.sections}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <SectionCard
            section={item}
            isFirst={index === 0}
            isLast={index === config.sections.length - 1}
            onChange={(content) => onSectionChange(item.id, content)}
            onMoveUp={() => moveSection(item.id, -1)}
            onMoveDown={() => moveSection(item.id, 1)}
            onDelete={() => deleteSection(item.id)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No sections yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  toolbarBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: 8 },
  toolbarText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  publishBtn: { backgroundColor: colors.light.primary },
  publishText: { color: colors.light.primaryForeground },
  saveStatus: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  list: { padding: spacing[4] },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", padding: spacing[8] },
  error: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
});
