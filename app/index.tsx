import React, { useEffect, useState } from "react";
import { Redirect, type Href } from "expo-router";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { useAuth } from "@/lib/supabase/auth";
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";

/** Home screen for each signed-in role. Buyers ("customer") get the catalogue. */
async function roleHome(role: string, userId: string): Promise<string> {
  switch (role) {
    case "store_owner":
      return "/(seller)";
    case "delivery":
      return "/(delivery)";
    case "delivery_company":
      return resolveDeliveryHomeRoute(userId, role).catch(() => "/(delivery-company)");
    case "admin":
      return "/(admin)";
    default:
      return "/(main)";
  }
}

/**
 * Root entry, hit on every cold start. Signed-in users open on their role
 * home (a seller always lands on the seller dashboard, never the buyer
 * catalogue). First-time visitors land on the login / register welcome
 * screen; guests who already chose "Continue as a guest" go straight to the
 * catalogue. The launch animation covers this screen while it decides.
 */
export default function IndexScreen() {
  const { session, user, role, loading, roleLoading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);
  const authReady = !loading && !(session && roleLoading);

  useEffect(() => {
    if (!authReady || target) return;
    let cancelled = false;
    const decide: Promise<string> = session && user
      ? roleHome(role, user.id)
      : hasCompletedOnboarding()
          .then((done) => (done ? "/(main)" : "/(auth)/welcome"))
          .catch(() => "/(auth)/welcome");
    decide.then((href) => {
      if (!cancelled) setTarget(href);
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, target, session, user, role]);

  return target ? <Redirect href={target as Href} /> : null;
}
