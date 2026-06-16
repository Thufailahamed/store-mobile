import { useEffect, useState, useCallback } from "react";
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

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("customer");
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applySession = (session: Session | null) => {
      if (cancelled) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user);
      } else {
        setRole("customer");
        setRoleLoading(false);
      }
      setLoading(false);
    };

    const sessionTimeout = setTimeout(() => {
      applySession(null);
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(sessionTimeout);
        applySession(session);
      })
      .catch(() => {
        clearTimeout(sessionTimeout);
        applySession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user);
      } else {
        setRole("customer");
        setRoleLoading(false);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchRole = async (authUser: User) => {
    setRoleLoading(true);
    try {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();
      const metaRole = authUser.user_metadata?.role as string | undefined;
      setRole(data?.role ?? metaRole ?? "customer");
    } catch {
      const metaRole = authUser.user_metadata?.role as string | undefined;
      setRole(metaRole ?? "customer");
    } finally {
      setRoleLoading(false);
    }
  };

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
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole("customer");
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

  return {
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
  };
}
