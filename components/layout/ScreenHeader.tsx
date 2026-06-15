import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display } from "@/components/ui/Typography";
import { colors, radii } from "@/lib/theme/tokens";

interface ScreenHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, showBack = true, onBack, right }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.bar}>
      {showBack ? (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onBack ?? (() => router.back())}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.light.foreground} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
      {title ? (
        <Display size="lg" style={styles.title} numberOfLines={1}>
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.card,
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
