import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Display } from "@/components/ui/Typography";
import { useTheme } from "@/lib/hooks/useTheme";
import { radii } from "@/lib/theme/tokens";
import { navigateHome } from "@/lib/navigation";

interface ScreenHeaderProps {
  title?: string;
  showBack?: boolean;
  backToHome?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({
  title,
  showBack = true,
  backToHome = false,
  onBack,
  right,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backToHome) {
      navigateHome(router);
      return;
    }
    router.back();
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
      {showBack ? (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
      {title ? (
        <Display size="lg" style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Display>
      ) : (
        <View style={styles.flex} />
      )}
      <View style={styles.right}>{right ?? <View style={styles.iconBtn} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
  flex: {
    flex: 1,
  },
  right: {
    minWidth: 40,
    alignItems: "flex-end",
  },
});
