import React, { useEffect, useState } from "react";
import { Redirect, type Href } from "expo-router";
import { hasCompletedOnboarding } from "@/lib/onboarding";

/**
 * Root entry. First-time visitors land on the login / register welcome screen;
 * guests who already chose "Continue as a guest" go straight to the catalogue.
 * Signed-in users are moved on to their role home by the auth routing in
 * _layout.tsx. The launch animation covers this screen while it decides.
 */
export default function IndexScreen() {
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    hasCompletedOnboarding()
      .then((done) => setTarget(done ? "/(main)" : "/(auth)/welcome"))
      .catch(() => setTarget("/(auth)/welcome"));
  }, []);

  return target ? <Redirect href={target} /> : null;
}
