import React from "react";
import { Stack } from "expo-router";
import { TabBarVisibilityProvider } from "@/lib/hooks";
import { colors } from "@/lib/theme/tokens";

// No `unstable_settings.initialRouteName` here: it makes "/" resolve to
// (main)/index and skips app/index.tsx, so signed-in sellers would open on
// the buyer catalogue. Deep-linked screens fall back to Home via goBack().

/**
 * The buyer app is a single stack. It used to be a Tabs navigator with
 * the bar hidden, which kept no history between screens: back from a
 * product jumped to Home (or Search) instead of the page the buyer came
 * from. A stack gives every screen a real back history, plus the iOS
 * swipe-back and the Android edge-swipe/back button for free.
 */
export default function MainLayout() {
  return (
    <TabBarVisibilityProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.light.background },
        }}
      />
    </TabBarVisibilityProvider>
  );
}
