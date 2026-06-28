/**
 * Sentry init for the mobile app.
 *
 * Reads DSN from app.config.js `extra.sentryDsn`. If unset, the SDK
 * never initialises and captureException silently no-ops — so dev
 * builds without a DSN stay clean.
 *
 * The SDK must be `require`d lazily (not statically imported) so the
 * native module isn't pulled into the bundle when DSN is missing.
 * `expo-router/entry` runs `app/_layout.tsx` early, which gives us a
 * safe spot to initialise.
 */
import * as Application from "expo-application";
import Constants from "expo-constants";

let sentryModule: typeof import("@sentry/react-native") | null = null;
let initialised = false;

function getSentry(): typeof import("@sentry/react-native") | null {
  if (sentryModule) return sentryModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentryModule = require("@sentry/react-native");
    return sentryModule;
  } catch {
    return null;
  }
}

export function initMobileSentry(): void {
  if (initialised) return;
  const Sentry = getSentry();
  if (!Sentry) return;
  const dsn =
    (Constants?.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? "";
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",
    release: Application.nativeApplicationVersion ?? undefined,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    // Strip PII before sending.
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete (event.user as { username?: string }).username;
      }
      return event;
    },
  });
  initialised = true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  const Sentry = getSentry();
  if (!Sentry || !initialised) return;
  if (context) {
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
}
