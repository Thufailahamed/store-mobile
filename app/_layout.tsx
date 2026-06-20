import "react-native-gesture-handler";
import "@/lib/theme/setup-android-text";
import React, { useEffect, useRef, useState } from "react";
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
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth, AuthProvider } from "@/lib/supabase/auth";
import { useSyncStores } from "@/lib/hooks";
import { ToastProvider } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { colors } from "@/lib/theme/tokens";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "@/lib/notifications";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  const { session, user, role, loading, roleLoading } = useAuth();
  useSyncStores();
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
              resolveDeliveryHomeRoute(user.id, role).then((home) => {
                router.replace(home);
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

  // Push notification registration
  useEffect(() => {
    if (user?.id) {
      registerForPushNotifications(user.id);
    }
  }, [user?.id]);

  // Notification tap → deep link. Auth-gated: tapping a notif when signed
  // out redirects to login rather than landing on a screen with no session.
  useEffect(() => {
    notifListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (!user?.id) {
        router.replace("/(auth)/login");
        return;
      }
      if (data?.screen) {
        router.push(data.screen as any);
      } else if (data?.order_id) {
        // Route delivery / delivery_company roles into the driver app.
        const target =
          role === "delivery" || role === "delivery_company"
            ? `/(delivery)/orders/${data.order_id}`
            : `/(main)/account/orders/${data.order_id}`;
        router.push(target as any);
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
      if (parsed.hostname === "reset-password" || parsed.path === "/reset-password") {
        router.push("/(auth)/login");
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
        router.push(`/(auth)/register?${qs.toString()}` as any);
        return;
      }

      // Everything below requires auth.
      if (!user?.id) {
        router.replace("/(auth)/login");
        return;
      }

      // Product deep link: luxe://product/<slug>
      if (parsed.hostname === "product" && parsed.path) {
        const slug = parsed.path.replace("/", "");
        if (slug) router.push(`/(main)/products/${slug}` as any);
        return;
      }

      // Order deep link: luxe://order/<id>
      if (parsed.hostname === "order" && parsed.path) {
        const orderId = parsed.path.replace("/", "");
        if (orderId) {
          const target =
            role === "delivery" || role === "delivery_company"
              ? `/(delivery)/orders/${orderId}`
              : `/(main)/account/orders/${orderId}`;
          router.push(target as any);
        }
        return;
      }

      // Driver invite: luxe://delivery-company/accept?token=...
      // Authenticated invitees only — anonymous users go to login first.
      if (parsed.hostname === "delivery-company" && parsed.path?.includes("accept")) {
        const token = parsed.queryParams?.token as string | undefined;
        if (token) router.push(`/(delivery-company)/accept?token=${token}` as any);
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
