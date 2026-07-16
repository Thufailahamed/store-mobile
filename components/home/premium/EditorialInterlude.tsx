import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface EditorialInterludeProps {
  kicker?: string;
  quote: string;
  attribution?: string;
}

/**
 * A quiet, text-only break in the rail-after-rail rhythm — a magazine
 * pull-quote rather than another card scroller. Purely editorial texture;
 * carries no product data.
 */
export function EditorialInterlude({
  kicker = "Styling note",
  quote,
  attribution,
}: EditorialInterludeProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.quote}>&ldquo;{quote}&rdquo;</Text>
      {attribution ? <Text style={styles.attribution}>— {attribution}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[8],
    paddingVertical: spacing[6],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.olive[600],
    marginBottom: spacing[3],
  },
  quote: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 19,
    lineHeight: 27,
    textAlign: "center",
    color: colors.light.foreground,
    maxWidth: 300,
  },
  attribution: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: spacing[3],
  },
});
