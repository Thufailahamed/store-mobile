import React from "react";
import { Modal, View, Text, ScrollView, StyleSheet } from "react-native";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  proposed: Record<string, unknown>;
  current: Record<string, unknown>;
  onApply: (next: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function AiDiffModal({ proposed, current, onApply, onCancel }: Props) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>AI suggestion</Text>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Current</Text>
              <Text style={styles.code}>{JSON.stringify(current, null, 2)}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Proposed</Text>
              <Text style={styles.code}>{JSON.stringify(proposed, null, 2)}</Text>
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <Button variant="ghost" onPress={onCancel} accessibilityLabel="Cancel AI suggestion">Cancel</Button>
            <Button onPress={() => onApply(proposed)} accessibilityLabel="Apply AI suggestion">Apply</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", padding: spacing[6], justifyContent: "center" },
  card: { backgroundColor: colors.light.background, borderRadius: radii.xl, padding: spacing[5], gap: spacing[3], maxHeight: "80%" },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  body: { flexGrow: 0 },
  bodyContent: { flexDirection: "row", gap: spacing[3] },
  column: { flex: 1, gap: spacing[1] },
  columnLabel: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  code: { fontFamily: fontFamilies.mono?.regular ?? fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.foreground, backgroundColor: colors.light.muted, padding: spacing[2], borderRadius: radii.sm },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing[2] },
});
