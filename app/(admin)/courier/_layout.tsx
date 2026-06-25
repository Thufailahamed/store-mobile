import React from "react";
import { Stack } from "expo-router";

/**
 * /admin/courier — external courier provider admin (Phase 0162).
 * Always visible; mirrors the web admin courier pages.
 */
export default function AdminCourierLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}