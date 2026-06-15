import React from "react";
import { Redirect } from "expo-router";

export default function IndexScreen() {
  // Root index — redirect to auth or main based on session
  // The actual routing logic is in _layout.tsx
  return <Redirect href="/(auth)/login" />;
}
