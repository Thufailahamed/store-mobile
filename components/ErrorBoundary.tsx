import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches uncaught render errors anywhere in the tree so a single bad
 * screen doesn't kill the whole app. Tap "Reload" to retry the screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.light.destructive} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.copy} numberOfLines={4}>
            {this.state.error.message}
          </Text>
          <Pressable onPress={this.reset} style={styles.btn}>
            <Ionicons name="refresh-outline" size={14} color={colors.light.primaryForeground} />
            <Text style={styles.btnText}>Reload screen</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[5],
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    alignItems: "center",
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.light.border,
    maxWidth: 360,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.light.destructive + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  title: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
  },
  copy: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    backgroundColor: colors.light.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  btnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.primaryForeground,
  },
});
