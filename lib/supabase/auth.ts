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
  try {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();
    const metaRole = authUser.user_metadata?.role as string | undefined;
    return data?.role ?? metaRole ?? "customer";
  } catch {
    const metaRole = authUser.user_metadata?.role as string | undefined;
    return metaRole ?? "customer";
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

    const applySession = (nextSession: Session | null) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      void applyRole(nextSession?.user ?? null);
    };

    const sessionTimeout = setTimeout(() => {
      applySession(null);
    }, 8000);

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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      void applyRole(nextSession?.user ?? null);
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
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole("customer");
    setRoleLoading(false);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "luxe://reset-password",
    });
    return { error: error?.message };
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
