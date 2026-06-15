import React from "react";
import { Redirect } from "expo-router";

export default function IndexScreen() {
  // Root index — onboarding, auth, or main routing lives in _layout.tsx
  return <Redirect href="/(onboarding)" />;
}
