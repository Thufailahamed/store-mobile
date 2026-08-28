import React, { useState } from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { regenerateStorefrontSectionBackend } from "@/lib/api/backend";
import { AiDiffModal } from "./AiDiffModal";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  sectionId: string;
  sectionType: string;
  currentContent: Record<string, unknown>;
  onApplied: (next: Record<string, unknown>) => void;
}

export function AiRegenerateButton({ sectionId, sectionType, currentContent, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regenerate = async () => {
    setLoading(true);
    setError(null);
    const res = await regenerateStorefrontSectionBackend({ sectionId, sectionType, currentContent });
    setLoading(false);
    if (res.ok) {
      setProposed(res.data.proposed);
    } else {
      setError(res.error ?? "AI failed");
    }
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Regenerate with AI"
        disabled={loading}
        onPress={regenerate}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
      >
        {loading ? <ActivityIndicator size="small" /> : <Text style={styles.btnText}>✨ AI</Text>}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {proposed ? (
        <AiDiffModal
          proposed={proposed}
          current={currentContent}
          onApply={(next) => { onApplied(next); setProposed(null); }}
          onCancel={() => setProposed(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radii.sm, backgroundColor: colors.light.primary + "15" },
  btnPressed: { opacity: 0.7 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.xs, color: colors.light.primary },
  error: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.destructive, marginTop: spacing[1] },
});
