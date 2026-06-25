import { Stack } from "expo-router";
import { colors } from "@/lib/theme/tokens";

export default function BrandsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.light.background },
      }}
    />
  );
}