import React, { useState } from "react";
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAiJobPoll } from "@/lib/ai-studio/use-ai-job-poll";
import { Button } from "@/components/ui/Button";
import { saveAiLibraryItemBackend, cancelAiJobBackend } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function JobDetail() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { job, error, isPolling } = useAiJobPoll(jobId ?? null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: (input: { imageIndex: number }) => saveAiLibraryItemBackend({ jobId: jobId!, ...input }),
    onSuccess: (res, input) => {
      setSavingIndex(null);
      if (res.ok) {
        Alert.alert("Saved", `Image ${input.imageIndex + 1} added to library.`);
        qc.invalidateQueries({ queryKey: ["ai-library"] });
      } else Alert.alert("Save failed", res.error ?? "Try again.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelAiJobBackend(jobId!),
    onSuccess: (res) => {
      if (!res.ok) Alert.alert("Cancel failed", res.error ?? "Try again.");
      qc.invalidateQueries({ queryKey: ["ai-jobs"] });
    },
  });

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>{error ?? "Loading…"}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.prompt}>{job.prompt}</Text>
        <Text style={styles.status}>Status: {job.status}{isPolling ? " • polling…" : ""}</Text>
        {job.error ? <Text style={styles.error}>{job.error}</Text> : null}

        {job.status === "succeeded" && job.results.length > 0 ? (
          <FlatList
            data={job.results}
            keyExtractor={(_, i) => String(i)}
            horizontal
            renderItem={({ item, index }) => (
              <View style={styles.imageWrap}>
                <Image source={{ uri: item.url }} style={styles.image} accessibilityLabel={`Generated image ${index + 1}`} />
                <Button
                  onPress={() => { setSavingIndex(index); saveMutation.mutate({ imageIndex: index }); }}
                  disabled={savingIndex === index}
                  accessibilityLabel={`Save image ${index + 1} to library`}
                >
                  {savingIndex === index ? "Saving…" : "Save to library"}
                </Button>
              </View>
            )}
            contentContainerStyle={{ gap: spacing[3] }}
          />
        ) : null}

        {isPolling ? (
          <Button variant="ghost" onPress={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} accessibilityLabel="Cancel generation">
            {cancelMutation.isPending ? "Cancelling…" : "Cancel generation"}
          </Button>
        ) : null}
        <Button variant="ghost" onPress={() => router.back()} accessibilityLabel="Back">Back to history</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[5] },
  content: { padding: spacing[5], gap: spacing[3] },
  prompt: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground },
  status: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  error: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  imageWrap: { gap: spacing[2], width: 220 },
  image: { width: 220, height: 220, borderRadius: radii.md, backgroundColor: colors.light.muted },
});
