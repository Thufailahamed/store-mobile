import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth";

export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface LoyaltyState {
  points: number;
  lifetime_points: number;
  tier: LoyaltyTier;
}

function tierFromPoints(pts: number): LoyaltyTier {
  if (pts >= 5000) return "Platinum";
  if (pts >= 2000) return "Gold";
  if (pts >= 500) return "Silver";
  return "Bronze";
}

export function tierProgress(points: number) {
  const tier =
    points >= 5000
      ? { name: "Platinum" as const, threshold: 5000, next: Infinity }
      : points >= 2000
        ? { name: "Gold" as const, threshold: 2000, next: 5000 }
        : points >= 500
          ? { name: "Silver" as const, threshold: 500, next: 2000 }
          : { name: "Bronze" as const, threshold: 0, next: 500 };
  const pct =
    tier.next === Infinity
      ? 100
      : Math.round(((points - tier.threshold) / (tier.next - tier.threshold)) * 100);
  return { ...tier, pct: Math.max(0, Math.min(100, pct)) };
}

export function useLoyalty() {
  const { user } = useAuth();
  const [state, setState] = useState<LoyaltyState>({
    points: 0,
    lifetime_points: 0,
    tier: "Bronze",
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setState({ points: 0, lifetime_points: 0, tier: "Bronze" });
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: profile }, { data: txns }] = await Promise.all([
      supabase.from("users").select("loyalty_points").eq("id", user.id).maybeSingle(),
      supabase
        .from("loyalty_transactions")
        .select("points")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const points = profile?.loyalty_points ?? 0;
    const lifetime = (txns ?? []).reduce(
      (s, t) => s + Math.max(0, Number(t.points) || 0),
      0
    );
    setState({
      points,
      lifetime_points: lifetime,
      tier: tierFromPoints(lifetime),
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const redeem = useCallback(
    async (points: number, referenceId?: string) => {
      if (!user || points <= 0) return { ok: false as const, error: "Invalid points" };
      const { error } = await supabase.rpc("loyalty_redeem_atomic", {
        p_points: points,
        p_reason: `Redeemed ${points} pts at checkout`,
        ...(referenceId ? { p_reference_id: referenceId } : {}),
      });
      if (error) return { ok: false as const, error: error.message };
      await reload();
      return { ok: true as const, value: points };
    },
    [user, reload]
  );

  return { state, loading, reload, redeem };
}
