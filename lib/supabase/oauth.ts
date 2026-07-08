import { supabase } from "./client";

/**
 * Parse query/hash params from an OAuth or magic-link callback URL.
 * Supabase may return tokens in the hash (#) or a PKCE code in the query (?).
 */
export function parseAuthCallbackParams(url: string): Record<string, string> {
  const hashIdx = url.indexOf("#");
  const queryIdx = url.indexOf("?");
  const paramString =
    hashIdx >= 0
      ? url.slice(hashIdx + 1)
      : queryIdx >= 0
        ? url.slice(queryIdx + 1)
        : "";
  if (!paramString) return {};
  return Object.fromEntries(new URLSearchParams(paramString));
}

/**
 * Complete an OAuth / magic-link redirect by exchanging the code or
 * setting the session from hash tokens.
 */
export async function completeAuthCallback(url: string): Promise<{ error?: string }> {
  const params = parseAuthCallbackParams(url);

  if (params.error) {
    return { error: params.error_description ?? params.error };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    return { error: error?.message };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return { error: error?.message };
  }

  return { error: "No auth credentials found in callback URL" };
}
