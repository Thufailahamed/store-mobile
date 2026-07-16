import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductRail } from "./ProductRail";
import { useAuth } from "@/lib/supabase/auth";
import { getHomeFeed, mapFlatProductRows, type HomeFeedResponse } from "@/lib/api";

/**
 * "Recommended for you" — the segment-trending rail (caller's inferred
 * gender + top categories, via get_trending_by_segment), promoted out of
 * PersonalisedRails into its own clearly-labelled section. Shares the same
 * `["home-feed", user.id]` query as PersonalisedRails/ContinueBrowsingRow,
 * so this adds no extra network call.
 */
export function RecommendedForYouRail() {
  const { user } = useAuth();

  const query = useQuery<HomeFeedResponse | null>({
    queryKey: ["home-feed", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await getHomeFeed();
      if (!res.ok) return null;
      return res.data;
    },
  });

  const products = useMemo(
    () => mapFlatProductRows(query.data?.sections.trending_for_you ?? []),
    [query.data],
  );

  if (!user) return null;

  return (
    <ProductRail
      kicker="Picked for your style"
      title="Recommended for you"
      products={products}
    />
  );
}
