import React from "react";

/**
 * BiometricGate (disabled)
 * Biometric lock has been removed from the app; passes through children directly.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
