/**
 * Release-build guard for uncaught JS errors.
 *
 * React Native's default global handler forwards a fatal JS error to
 * NativeExceptionsManager.reportException. In Release builds that calls
 * RCTFatal, which @throws an NSException from the TurboModule queue. RN 0.81
 * then converts that exception into a JS error *off the JS thread*, racing
 * the Hermes runtime and crashing the app with SIGSEGV (App Review crash on
 * 1.0.1 build 2: EXC_BAD_ACCESS in HermesRuntimeImpl under
 * convertNSExceptionToJSError on com.meta.react.turbomodulemanager.queue).
 *
 * In Release we log + report the error and keep the app alive instead of
 * handing it to the native fatal path. Render errors are still caught by
 * <ErrorBoundary>, which shows a recoverable screen. Dev builds keep the
 * default handler so the red box still appears.
 */
import { captureException } from "@/lib/sentry";

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

let installed = false;

export function installFatalErrorGuard(): void {
  if (installed) return;
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) return;
  installed = true;

  const defaultHandler = errorUtils.getGlobalHandler();
  let reporting = false;

  errorUtils.setGlobalHandler((error, isFatal) => {
    if (__DEV__) {
      defaultHandler(error, isFatal);
      return;
    }
    // Guard against an error thrown while reporting an error.
    if (reporting) return;
    reporting = true;
    try {
      // eslint-disable-next-line no-console
      console.error(
        `[fatal-error-guard] ${isFatal ? "fatal" : "non-fatal"} JS error:`,
        error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error),
      );
      captureException(error, { fatal: Boolean(isFatal), source: "global-handler" });
    } catch {
      // never let reporting crash the app
    } finally {
      reporting = false;
    }
  });
}
