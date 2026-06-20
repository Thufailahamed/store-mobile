import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "@/lib/supabase/auth";
import {
  getLocalSettingsPrefs,
} from "@/lib/settings-prefs";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { Display, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";

/**
 * BiometricGate
 *
 * If the user has biometricLock enabled in local settings, gates the
 * children behind a Face ID / fingerprint prompt. Re-challenges on every
 * foreground transition so the gate is re-armed when the app comes back
 * from background.
 *
 * If biometrics are unavailable on the device (no enrolled fingerprint /
 * Face ID), we leave the children un-gated — silently failing the gate
 * would lock the user out of their own app.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const lastAppState = useRef<AppStateStatus>(AppState.currentState);
  const lastCheckAt = useRef<number>(0);

  const runCheck = useCallback(async () => {
    // Throttle to once per ~1s to avoid spamming on rapid AppState
    // transitions (e.g. notification banners).
    if (Date.now() - lastCheckAt.current < 1000) return;
    lastCheckAt.current = Date.now();
    setChecking(true);
    try {
      const prefs = await getLocalSettingsPrefs();
      setEnabled(!!prefs.biometricLock);
      if (!prefs.biometricLock) {
        setLocked(false);
        setReason(null);
        return;
      }
      // Don't gate when there's no active session — the auth screens
      // handle their own sign-in flow.
      if (!session?.user) {
        setLocked(false);
        setReason(null);
        return;
      }
      const supported =
        await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!supported || !enrolled) {
        // No biometrics available — leave the app accessible so the
        // user can still get in.
        setLocked(false);
        setReason(null);
        return;
      }
      setLocked(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock LUXE",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
        setReason(null);
      } else if (result.error === "user_cancel" || result.error === "system_cancel") {
        setReason("Authentication cancelled");
      } else {
        setReason("Could not authenticate. Try again.");
      }
    } catch (err) {
      console.warn("[biometric] check threw:", err);
      // On any unexpected failure, fail open — better than locking the
      // user out due to a library bug.
      setLocked(false);
    } finally {
      setChecking(false);
    }
  }, [session?.user]);

  // Initial check on mount + whenever the session changes.
  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  // Re-lock whenever the app comes back from background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (
        lastAppState.current.match(/inactive|background/) &&
        next === "active"
      ) {
        void runCheck();
      }
      lastAppState.current = next;
    });
    return () => sub.remove();
  }, [runCheck]);

  if (!locked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Display size="3xl" style={styles.title}>LUXE locked</Display>
      <Body muted style={styles.body}>
        {reason ?? "Use Face ID or fingerprint to open LUXE."}
      </Body>
      <Button
        variant="brand"
        onPress={() => void runCheck()}
        loading={checking}
        style={styles.button}
      >
        Unlock
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: spacing[4],
  },
  title: {
    color: colors.light.foreground,
  },
  body: {
    textAlign: "center",
  },
  button: {
    marginTop: spacing[4],
    minWidth: 200,
  },
});