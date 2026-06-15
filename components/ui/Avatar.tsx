import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors, typography } from "@/lib/theme/tokens";

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: any;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const oliveShades = [
    colors.olive[600],
    colors.olive[700],
    colors.olive[800],
    colors.olive[400],
    colors.olive[500],
  ];
  return oliveShades[Math.abs(hash) % oliveShades.length];
}

export function Avatar({ uri, name = "", size = 40, style }: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = hashColor(name);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: size * 0.38 },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#faf8f1",
    fontWeight: typography.fontWeights.semibold,
  },
});
