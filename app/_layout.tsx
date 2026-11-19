import "react-native-gesture-handler";
import "@/lib/theme/setup-android-text";
import { initMobileSentry } from "@/lib/sentry";
import { installFatalErrorGuard } from "@/lib/fatal-error-guard";
// Activate Sentry before any other module runs. No-op when DSN unset.
initMobileSentry();
// Release builds: keep uncaught JS errors off RN's native fatal path, which
// crashes the app on iOS (see lib/fatal-error-guard.ts).
installFatalErrorGuard();
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Appearance } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { CascadeLaunch } from "@/components/launch/CascadeLaunch";
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
import { ThemedAlertHost } from "@/components/ui/ThemedAlertHost";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AppUpdateGate } from "@/components/app-update/AppUpdateGate";
import { colors } from "@/lib/theme/tokens";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
  setupNotificationPresentation,
  firstPartyPath,
} from "@/lib/notifications";
import { hasCompletedOnboarding } from "@/lib/onboarding";

/** Notification responses already routed this process (cold-start replay dedupe). */
const handledNotifResponses = new Set<string>();
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";
import { completeAuthCallback } from "@/lib/supabase/oauth";
import { isAllowedRoute, isUuid, isValidToken, sanitizeSlug, safeRoutePush, mapWebPathToMobileRoute } from "@/lib/utils/safe-route";
import { useAuthRedirectHeld } from "@/lib/auth-redirect-hold";

SplashScreen.preventAutoHideAsync();

// Route groups that only make sense for a signed-in account. (main) stays
// public so guests can browse; checkout and account screens gate themselves.
const SESSION_REQUIRED_GROUPS = ["(seller)", "(delivery)", "(delivery-company)", "(brand)", "(admin)"];

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
  const redirectHeld = useAuthRedirectHeld();

  useEffect(() => {
    // Read once so the launch overlay waits for storage; app/index.tsx uses
    // the flag to pick the welcome screen or the catalogue.
    hasCompletedOnboarding()
      .catch(() => false)
      .finally(() => setOnboardingChecked(true));
  }, []);

  // Auth routing
  useEffect(() => {
    if (loading || !onboardingChecked) return;
    if (session && roleLoading) return;
    // A screen (the OTP "Verified" animation) is finishing before we leave.
    if (redirectHeld) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inPrivateGroup = SESSION_REQUIRED_GROUPS.some((group) => segments[0] === group);

    // If logged in: redirect away from auth pages to role-based screens
    if (session) {
      if (inAuthGroup) {
        switch (role) {
          case "store_owner":
            router.replace("/(seller)");
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
          case "admin":
            router.replace("/(admin)");
            break;
          default:
            router.replace("/(main)");
        }
      }
      return;
    }

    // Signed-out visitors can browse the catalogue. Ordering and account
    // screens are gated where they're used (cart, checkout, account links).
    // Role dashboards still need a session.
    if (!session) {
      if (inPrivateGroup) {
        router.replace("/(auth)/welcome");
        return;
      }
      return;
    }
  }, [session, user?.id, loading, role, roleLoading, segments, onboardingChecked, redirectHeld]);

  // The animated Vestara launch screen covers the app from the first JS
  // frame, so the native splash can go straight away; the overlay itself
  // waits for onboarding + auth bootstrap before fading out.
  const [showLaunch, setShowLaunch] = useState(true);
  // Also wait for the role, so a signed-in seller never sees the buyer
  // catalogue flash before app/index.tsx sends them to the dashboard.
  const launchReady = onboardingChecked && !loading && !(session && roleLoading);
  const finishLaunch = useCallback(() => setShowLaunch(false), []);
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  // Never trap users behind the intro if auth/storage hangs.
  const [launchTimedOut, setLaunchTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLaunchTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

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
  // Android channels + rich-push button categories. Independent of
  // permission, so older tokens also get buttons once the app updates.
  useEffect(() => {
    void setupNotificationPresentation();
  }, []);

  useEffect(() => {
    const handleResponse = async (response: Notifications.NotificationResponse) => {
      // Each tap is handled once — the cold-start replay below and the
      // listener can both see the same response.
      const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handledNotifResponses.has(responseKey)) return;
      handledNotifResponses.add(responseKey);
      const data = response.notification.request.content.data as
        | { screen?: string; order_id?: string; link?: string; url?: string }
        | undefined;
      if (!user?.id) {
        router.replace("/(auth)/login");
        return;
      }

      // 0. First-party absolute URL → in-app route (rich push "Shop Now").
      const linkCandidate = data?.url || data?.link;
      const inAppPath =
        typeof linkCandidate === "string" ? firstPartyPath(linkCandidate) : null;
      const rawUrl = inAppPath ?? linkCandidate;

      // 1. External URL (e.g. Courier tracking URL)
      if (rawUrl && typeof rawUrl === "string" && /^https?:\/\//i.test(rawUrl)) {
        try {
          const supported = await Linking.canOpenURL(rawUrl);
          if (supported) {
            await Linking.openURL(rawUrl);
            return;
          }
        } catch (err) {
          console.warn("[notif] failed to open external URL:", rawUrl, err);
        }
      }

      // 2. Relative web link (e.g. "/cart", "/account/orders", "/notifications")
      if (rawUrl && typeof rawUrl === "string" && rawUrl.startsWith("/")) {
        const mapped = mapWebPathToMobileRoute(rawUrl);
        if (mapped) {
          safeRoutePush(router, mapped);
          return;
        }
      }

      // 3. Explicit screen parameter
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
    };

    notifListenerRef.current = addNotificationResponseListener((response) => {
      void handleResponse(response);
    });

    // Cold start: a tap that launched the app from killed state may land
    // before the listener exists. Replay it once the session is known.
    if (user?.id) {
      Notifications.getLastNotificationResponseAsync()
        .then((last) => {
          if (!last) return;
          // Clear so a later relaunch doesn't replay an old tap.
          Notifications.clearLastNotificationResponse();
          void handleResponse(last);
        })
        .catch(() => {});
    }

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

      // OAuth / magic-link callback: vestara://auth/callback?code=... or #access_token=...
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

      // Shared web product link (Android App Links / iOS Universal Links):
      // https://vestara.lk/products/<slug>?src=app — public catalogue.
      if (
        (parsed.scheme === "https" || parsed.scheme === "http") &&
        /(^|\.)vestara\.lk$/i.test(parsed.hostname ?? "")
      ) {
        const m = (parsed.path ?? "").match(/^\/?products\/([^/?#]+)/);
        const slug = m ? sanitizeSlug(m[1]) : null;
        if (slug) safeRoutePush(router, `/(main)/products/${slug}`);
        return;
      }

      // Product deep link is public catalogue.
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

      // Shared wishlist is public read-only.
      if (parsed.hostname === "wishlist") {
        const parts = (parsed.path ?? "").split("/").filter(Boolean);
        const token = parts[0] === "shared" ? parts[1] : parts[0];
        if (token && isValidToken(token)) {
          safeRoutePush(router, "/(main)/wishlist/shared/[token]", { token });
          return;
        }
      }

      // Order deep link: luxe://order/<id> — requires a session.
      if (parsed.hostname === "order" && parsed.path) {
        if (!user?.id) {
          router.replace("/(auth)/login");
          return;
        }
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
        if (!user?.id) {
          router.replace("/(auth)/login");
          return;
        }
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.light.background },
        }}
      />
      {showLaunch ? (
        <CascadeLaunch ready={launchReady || launchTimedOut} onFinish={finishLaunch} />
      ) : null}
      <AppUpdateGate suspended={showLaunch} />
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
        {/* Outer boundary: errors in the providers, root hooks or the cart
            drawer would otherwise unmount the whole app. */}
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <StatusBar style="dark" />
                <RootLayoutNav />
                <CartDrawer />
                <ThemedAlertHost />
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
