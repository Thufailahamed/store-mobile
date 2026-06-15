import React from "react";
import { View, StyleSheet, type ViewProps } from "react-native";
import { colors } from "@/lib/theme/tokens";

export function PaperBackground({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.root, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper.DEFAULT,
  },
});
