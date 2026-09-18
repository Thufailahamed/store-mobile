import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

/** Must match the backend's MOBILE_APP_SCHEME return URL (luxe://payments-lk/return). */
export const PAYMENTS_LK_RETURN_URL = Linking.createURL("payments-lk/return");

export type PaymentsLkOutcome = "succeeded" | "failed" | "canceled" | "expired" | "dismissed";

/** Mirrors @payments-lk/react-native parseCheckoutReturn — RN's URL impl is partial. */
export function parsePaymentsLkReturn(url: string | undefined): { status: PaymentsLkOutcome; checkoutId: string | null } | null {
  if (!url) return null;
  const expectedScheme = PAYMENTS_LK_RETURN_URL.slice(0, PAYMENTS_LK_RETURN_URL.indexOf(":"));
  if (url.slice(0, url.indexOf(":")).toLowerCase() !== expectedScheme.toLowerCase()) return null;
  const q = url.indexOf("?");
  if (q === -1) return null;
  const params: Record<string, string> = {};
  for (const pair of url.slice(q + 1).split("#")[0].split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    try {
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
    } catch {
      return null;
    }
  }
  const status = params.status;
  if (status === "succeeded" || status === "failed" || status === "canceled" || status === "expired") {
    return { status, checkoutId: params.checkout ?? null };
  }
  return null;
}

/** Open the Payments.lk hosted checkout in the system browser sheet. */
export async function runPaymentsLkCheckout(
  checkoutUrl: string,
): Promise<{ status: PaymentsLkOutcome; checkoutId: string | null }> {
  const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, PAYMENTS_LK_RETURN_URL);
  if (result.type !== "success") return { status: "dismissed", checkoutId: null };
  return parsePaymentsLkReturn(result.url) ?? { status: "dismissed", checkoutId: null };
}
