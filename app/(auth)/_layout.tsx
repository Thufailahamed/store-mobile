import React from "react";
import { Stack } from "expo-router";
import { colors } from "@/lib/theme/tokens";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.light.background },
        animation: "fade",
      }}
    />
  );
}
