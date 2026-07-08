import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "./client";
import type { Session, User } from "@supabase/supabase-js";
import { releaseCartReservations } from "@/lib/inventory-reservations";
import { useCart, useWishlist } from "@/lib/stores";
import { clearPushToken } from "@/lib/notifications";
import { clearDriverShiftState } from "@/lib/hooks/useDriverShift";

export interface AuthState {
  session: Session | null;
  user: User | null;
  role: string;
  loading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signInWithPhone: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthState | null>(null);

async function resolveRole(authUser: User): Promise<string> {
  // Always start with the safest default. user_metadata is user-writable
  // (the user can patch it via supabase.auth.updateUser({ data })), so
  // trusting it for routing/authz decisions would let any user escalate
  // themselves to "admin". Only the row in `public.users` is authoritative.
  try {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();
    if (data?.role) return data.role;
    const metaRole = authUser.user_metadata?.role as string | undefined;
    if (metaRole) {
      console.warn(
        `[auth] using unverified user_metadata.role="${metaRole}" as hint only; ` +
          `no row found in public.users for ${authUser.id}`,
      );
    }
    return "customer";
  } catch {
    const metaRole = authUser.user_metadata?.role as string | undefined;
    if (metaRole) {
      console.warn(
        `[auth] DB read failed; falling back to user_metadata.role="${metaRole}" as hint only`,
      );
    }
    return "customer";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("customer");
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const roleUserIdRef = useRef<string | null>(null);
  const roleRequestIdRef = useRef(0);

  const applyRole = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      roleUserIdRef.current = null;
      setRole("customer");
      setRoleLoading(false);
      return;
    }

    if (roleUserIdRef.current === authUser.id) return;

    const requestId = ++roleRequestIdRef.current;
    roleUserIdRef.current = authUser.id;
    setRoleLoading(true);

    const nextRole = await resolveRole(authUser);
    if (requestId !== roleRequestIdRef.current) return;

    setRole(nextRole);
    setRoleLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let bootstrapDone = false;

    const applySession = (nextSession: Session | null) => {
      if (cancelled) return;
      bootstrapDone = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      void applyRole(nextSession?.user ?? null);
    };

    const sessionTimeout = setTimeout(() => {
      // Only give up if bootstrap hasn't completed — don't wipe a session
      // that onAuthStateChange already delivered.
      if (!bootstrapDone) {
        applySession(null);
      }
    }, 15000);

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        clearTimeout(sessionTimeout);
        applySession(initialSession);
      })
      .catch(() => {
        clearTimeout(sessionTimeout);
        applySession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      // M-09 AUDIT: On TOKEN_REFRESHED, force a re-derive of the role from
      // the server-side public.users row. Without this, a demoted/promoted
      // user keeps stale access until app restart.
      if (event === "TOKEN_REFRESHED" && nextSession?.user) {
        roleUserIdRef.current = null; // clear cache so applyRole doesn't skip
      }

      void applyRole(nextSession?.user ?? null);
      // PASSWORD_RECOVERY fires when the user clicks the link in the
      // "reset password" email. Supabase has issued a short-lived
      // recovery session — route the user to a screen where they can
      // set a new password (instead of bouncing them back to /login).
      if (event === "PASSWORD_RECOVERY") {
        try {
          // Lazy import to avoid a cycle with expo-router at module load.
          // Use a static-require-friendly import path string to keep the
          // TypeScript "module" flag happy (it disallows `await import`).
          const expoRouter = require("expo-router") as typeof import("expo-router");
          expoRouter.router.push("/(auth)/reset-password");
        } catch (err) {
          console.warn("[auth] failed to route to reset-password:", err);
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, [applyRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message };
  }, []);

  const signOut = useCallback(async () => {
    roleUserIdRef.current = null;
    const userId = user?.id;
    if (userId) {
      try {
        if (useCart.getState().hydrated) {
          await useCart.getState().syncToServer(userId);
        }
        await useWishlist.getState().syncToServer(userId);
        // Null out the push_token so the server stops sending pushes to
        // this device — a stale token would otherwise keep showing
        // notifications for a user who is no longer signed in.
        await clearPushToken(userId);
      } catch (err) {
        console.warn("[auth] signOut sync failed:", err);
      }
    }
    await releaseCartReservations();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole("customer");
    setRoleLoading(false);
    // Clear persisted local state so the next user signing in on the same
    // device doesn't see this user's cart/wishlist hydrated from localStorage
    // before the server fetch completes. The `clear` action resets the store;
    // `persist.clearStorage()` removes the localStorage key outright.
    try {
      useCart.getState().clear();
      useCart.persist.clearStorage();
      useWishlist.getState().clear();
      useWishlist.persist.clearStorage();
    } catch (err) {
      console.warn("[auth] signOut local clear failed:", err);
    }
    // Shift on/off is stored under a device-wide key, not scoped to this
    // user — clear it so the next driver signing in on this device doesn't
    // inherit an "on shift" state (and the GPS pings that come with it).
    await clearDriverShiftState();
  }, [user]);

  const resetPassword = useCallback(async (email: string) => {
    const apiBase = (process.env.EXPO_PUBLIC_STORE_API_URL ?? "").replace(/\/$/, "");
    if (!apiBase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "luxe://reset-password",
      });
      return { error: error?.message };
    }

    try {
      const res = await fetch(`${apiBase}/api/auth/password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), redirectTo: "luxe://reset-password" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const msg =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message ?? "Failed to request password reset";
        return { error: msg };
      }
      return { error: undefined };
    } catch (e: any) {
      return { error: e.message ?? "Network error requesting password reset" };
    }
  }, []);

  const signInWithPhone = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error?.message };
  }, []);

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    return { error: error?.message };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      role,
      loading,
      roleLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      signInWithPhone,
      verifyOtp,
    }),
    [
      session,
      user,
      role,
      loading,
      roleLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      signInWithPhone,
      verifyOtp,
    ],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
