/**
 * Renders a neutral "coming soon / rolled out later" notice for routes that
 * are gated behind a feature flag (`lib/feature-flags.ts`). The notice
 * never reveals whether a flag exists or which user/role would unlock it —
 * every flag-default-OFF screen shows the same copy so end users can't
 * infer the roll-out matrix from the UI.
 *
 * Usage (typically in a route file's `default export`):
 *
 *   import { isLuxeAiStudioMobile } from "@/lib/feature-flags";
 *   import { FeatureOffScreen } from "@/components/ui/FeatureOffScreen";
 *
 *   export default function AiStudioIndex() {
 *     if (!isLuxeAiStudioMobile()) return <FeatureOffScreen name="AI Studio" />;
 *     return <RealScreen />;
 *   }
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  /** Friendly feature name shown to the user (e.g. "AI Studio"). */
  name: string;
}

export function FeatureOffScreen({ name }: Props): React.ReactElement {
  return (
    <View style={styles.root} accessibilityLabel={`${name} is not available yet`}>
      <Text style={styles.heading}>{name}</Text>
      <Text style={styles.body}>
        This feature is rolling out in stages and is not available on mobile
        yet. Check back after the next app update.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    gap: spacing[3],
    backgroundColor: colors.light.background,
  },
  heading: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
    maxWidth: 320,
  },
});
