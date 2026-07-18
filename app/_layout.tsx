import "react-native-gesture-handler";
import "@/lib/theme/setup-android-text";
import { initMobileSentry } from "@/lib/sentry";
// Activate Sentry before any other module runs. No-op when DSN unset.
initMobileSentry();
import React, { useEffect, useRef, useState } from "react";
import { Appearance } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from "@expo-google-fonts/jetbrains-mono";
import * as Linking from "expo-linking";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth, AuthProvider } from "@/lib/supabase/auth";
import { useSyncStores, useCartRemoteSync, useWishlistRemoteSync } from "@/lib/hooks";
import { ToastProvider, useToast } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { colors } from "@/lib/theme/tokens";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "@/lib/notifications";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";
import { completeAuthCallback } from "@/lib/supabase/oauth";
import { isAllowedRoute, isUuid, isValidToken, sanitizeSlug, safeRoutePush } from "@/lib/utils/safe-route";
import { BiometricGate } from "@/components/auth/BiometricGate";

SplashScreen.preventAutoHideAsync();

// Force light mode even when the OS is set to dark theme.
Appearance.setColorScheme("light");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Catalogue + authed data: keep fresh for 5 min. Avoids a network
      // round-trip when the user navigates Home → product → Home or pulls
      // to refresh within the same session.
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      // Reuse identical responses across mounted screens; saves a Supabase
      // hit on screens that share a query key (Home rails + product page).
      structuralSharing: true,
      retry: 1,
      // Don't block first paint on a network blip when the device was
      // offline. Keep cached data on screen, retry in background.
      networkMode: "offlineFirst",
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutNav() {
  const { session, user, role, loading, roleLoading } = useAuth();
  const { toast } = useToast();
  useSyncStores();
  useCartRemoteSync();
  useWishlistRemoteSync();
  const router = useRouter();
  const segments = useSegments();
  const notifListenerRef = useRef<ReturnType<typeof addNotificationResponseListener> | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding().then((complete) => {
      setOnboardingComplete(complete);
      setOnboardingChecked(true);
    });
  }, []);

  // Auth routing
  useEffect(() => {
    if (loading || !onboardingChecked) return;
    if (session && roleLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";

    // If logged in: redirect away from onboarding and auth pages to role-based screens
    if (session) {
      if (inAuthGroup || inOnboardingGroup) {
        switch (role) {
          case "store_owner":
            router.replace("/(seller)");
            break;
          case "brand_owner":
            router.replace("/(brand)");
            break;
          case "delivery":
            router.replace("/(delivery)");
            break;
          case "delivery_company":
            if (user?.id) {
              resolveDeliveryHomeRoute(user.id, role)
                .then((home) => {
                  router.replace(home);
                })
                .catch((err) => {
                  console.warn("[auth] delivery-company home route resolution failed:", err);
                  toast("Couldn't load your dashboard. Opening default view.", "error");
                  router.replace("/(delivery-company)");
                });
            } else {
              router.replace("/(delivery-company)");
            }
            break;
          default:
            router.replace("/(main)");
        }
      }
      return;
    }

    // If NOT logged in: redirect to onboarding welcome screen if trying to access protected screens
    if (!session) {
      if (!inOnboardingGroup && !inAuthGroup) {
        router.replace("/(onboarding)");
      }
      return;
    }
  }, [session, user?.id, loading, role, roleLoading, segments, onboardingChecked, onboardingComplete]);

  // Hide splash once onboarding + auth bootstrap finish. Role lookup continues in background.
  useEffect(() => {
    if (onboardingChecked && !loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading, onboardingChecked]);

  // Never leave users stuck on the native splash if auth/storage is slow.
  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  // Push notification registration — deferred until the first frame has
  // been painted so the home render isn't blocked behind token negotiation
  // with APNs/FCM (can be 300-800ms cold).
  useEffect(() => {
    if (!user?.id) return;
    const handle = setTimeout(() => {
      registerForPushNotifications(user.id as string);
    }, 1500);
    return () => clearTimeout(handle);
  }, [user?.id]);

  // Notification tap → deep link. Auth-gated: tapping a notif when signed
  // out redirects to login rather than landing on a screen with no session.
  useEffect(() => {
    notifListenerRef.current = addNotificationResponseListener(async (response) => {
      const data = response.notification.request.content.data as
        | { screen?: string; order_id?: string }
        | undefined;
      if (!user?.id) {
        router.replace("/(auth)/login");
        return;
      }
      if (data?.screen) {
        // Validate against the allow-list before navigating. Unknown screens
        // are dropped with a warning so a malicious payload can't route the
        // user to an arbitrary path.
        if (!isAllowedRoute(data.screen)) {
          console.warn("[notif] rejected non-allow-listed screen:", data.screen);
          return;
        }
        safeRoutePush(router, data.screen);
      } else if (data?.order_id) {
        const orderId = sanitizeSlug(data.order_id);
        if (!isUuid(orderId)) {
          console.warn("[notif] rejected non-uuid order_id:", data.order_id);
          return;
        }
        // Verify ownership before routing. Riders/admins bypass the
        // ownership check because they are authorised to view any order.
        const isPrivileged = role === "delivery" || role === "delivery_company" || role === "admin";
        if (!isPrivileged) {
          try {
            // Use a static require to stay within the tsconfig's module
            // setting (dynamic `await import` isn't allowed here).
            const clientModule = require("@/lib/supabase/client") as typeof import("@/lib/supabase/client");
            const supabase = clientModule.supabase;
            const { data: orderRow } = await supabase
              .from("orders")
              .select("id, user_id")
              .eq("id", orderId)
              .maybeSingle();
            if (!orderRow || orderRow.user_id !== user.id) {
              console.warn("[notif] order ownership check failed for:", orderId);
              return;
            }
          } catch (err) {
            console.warn("[notif] order ownership check threw:", err);
            return;
          }
        }
        // Route delivery / delivery_company roles into the driver app.
        const target =
          role === "delivery" || role === "delivery_company"
            ? `/(delivery)/orders/${orderId}`
            : `/(main)/account/orders/${orderId}`;
        safeRoutePush(router, target, { id: orderId });
      }
    });
    return () => {
      notifListenerRef.current?.remove();
    };
  }, [role, user?.id]);

  // Deep link handler (password reset, shared URLs, etc.)
  // Auth gate: deep links that target authed screens must redirect to
  // /login if the user isn't signed in. This prevents a malicious or
  // accidental URL from landing the user on a screen with no session.
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      if (!url) return;
      const parsed = Linking.parse(url);

      // Password reset: luxe://reset-password — public, no auth needed.
      // Routed to the reset-password screen so the user can set a new one
      // (the PASSWORD_RECOVERY event handled in lib/supabase/auth.ts will
      // also land here for deep links that include the recovery fragment).
      if (parsed.hostname === "reset-password" || parsed.path === "/reset-password") {
        safeRoutePush(router, "/(auth)/reset-password");
        return;
      }

      // OAuth / magic-link callback: luxe://auth/callback?code=... or #access_token=...
      if (parsed.hostname === "auth" && (parsed.path === "/callback" || parsed.path === "callback")) {
        void completeAuthCallback(url).then(({ error }) => {
          if (error) console.warn("[deeplink] auth callback failed:", error);
        });
        return;
      }

      // Signup with role + invite: luxe://register?role=delivery&code=ABC
      // — public; signup page handles its own auth.
      if (parsed.hostname === "register") {
        const role = parsed.queryParams?.role as string | undefined;
        const code = parsed.queryParams?.code as string | undefined;
        const qs = new URLSearchParams();
        if (role) qs.set("role", role);
        if (code) qs.set("code", code);
        safeRoutePush(router, `/(auth)/register${qs.toString() ? `?${qs.toString()}` : ""}`);
        return;
      }

      // Everything below requires auth.
      if (!user?.id) {
        router.replace("/(auth)/login");
        return;
      }

      // Product deep link: luxe://product/<slug>
      if (parsed.hostname === "product" && parsed.path) {
        const rawSlug = parsed.path.replace("/", "");
        const slug = sanitizeSlug(rawSlug);
        if (!slug) {
          console.warn("[deeplink] rejected empty/non-slug product path:", rawSlug);
          return;
        }
        safeRoutePush(router, `/(main)/products/${slug}`);
        return;
      }

      // Order deep link: luxe://order/<id>
      if (parsed.hostname === "order" && parsed.path) {
        const orderId = sanitizeSlug(parsed.path.replace("/", ""));
        if (!isUuid(orderId)) {
          console.warn("[deeplink] rejected non-uuid order id:", orderId);
          return;
        }
        const target =
          role === "delivery" || role === "delivery_company"
            ? `/(delivery)/orders/${orderId}`
            : `/(main)/account/orders/${orderId}`;
        safeRoutePush(router, target, { id: orderId });
        return;
      }

      // Driver invite: luxe://delivery-company/accept?token=...
      // Authenticated invitees only — anonymous users go to login first.
      if (parsed.hostname === "delivery-company" && parsed.path?.includes("accept")) {
        const token = parsed.queryParams?.token as string | undefined;
        if (!isValidToken(token)) {
          console.warn("[deeplink] rejected delivery-company invite token");
          return;
        }
        router.push(`/(delivery-company)/accept?token=${encodeURIComponent(token as string)}` as never);
        return;
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => sub.remove();
  }, [user?.id, role]);

  return (
    <ErrorBoundary>
      <BiometricGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.light.background },
          }}
        />
      </BiometricGate>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <RootLayoutNav />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
