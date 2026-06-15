import "react-native-gesture-handler";
import React, { useEffect, useRef } from "react";
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
import { useAuth } from "@/lib/supabase/auth";
import { ToastProvider } from "@/components/ui";
import { colors } from "@/lib/theme/tokens";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "@/lib/notifications";

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
  const router = useRouter();
  const segments = useSegments();
  const notifListenerRef = useRef<ReturnType<typeof addNotificationResponseListener> | null>(null);

  // Auth routing
  useEffect(() => {
    if (loading) return;
    if (session && roleLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      switch (role) {
        case "store_owner":
          router.replace("/(seller)");
          break;
        case "brand_owner":
          router.replace("/(brand)");
          break;
        case "delivery":
        case "delivery_company":
          router.replace("/(delivery)");
          break;
        default:
          router.replace("/(main)");
      }
    }
  }, [session, loading, role, roleLoading, segments]);

  // Splash screen
  useEffect(() => {
    if (!loading && (!session || !roleLoading)) {
      SplashScreen.hideAsync();
    }
  }, [loading, session, roleLoading]);

  // Push notification registration
  useEffect(() => {
    if (user?.id) {
      registerForPushNotifications(user.id);
    }
  }, [user?.id]);

  // Notification tap → deep link
  useEffect(() => {
    notifListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        router.push(data.screen as any);
      } else if (data?.order_id) {
        router.push(`/(main)/orders/${data.order_id}` as any);
      }
    });
    return () => {
      notifListenerRef.current?.remove();
    };
  }, []);

  // Deep link handler (password reset, shared URLs, etc.)
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      if (!url) return;
      const parsed = Linking.parse(url);

      // Password reset: luxe://reset-password
      if (parsed.hostname === "reset-password" || parsed.path === "/reset-password") {
        router.push("/(auth)/login");
      }

      // Product deep link: luxe://product/<slug>
      if (parsed.hostname === "product" && parsed.path) {
        const slug = parsed.path.replace("/", "");
        if (slug) router.push(`/(main)/products/${slug}` as any);
      }

      // Order deep link: luxe://order/<id>
      if (parsed.hostname === "order" && parsed.path) {
        const orderId = parsed.path.replace("/", "");
        if (orderId) router.push(`/(main)/orders/${orderId}` as any);
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.light.background },
      }}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <StatusBar style="dark" />
            <RootLayoutNav />
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
