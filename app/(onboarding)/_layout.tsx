import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/lib/hooks/useTheme";

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: "fade",
      }}
    />
  );
}
