import { useQuery } from "@tanstack/react-query";
import { getCheckoutPricingBackend } from "@/lib/api/backend";
import { DEFAULT_CHECKOUT_PRICING, type CheckoutPricing } from "@/lib/utils";

export const CHECKOUT_PRICING_QUERY_KEY = ["checkout", "pricing"] as const;

/**
 * Admin-set platform fee % + delivery fees (GET /api/checkout/pricing).
 * Falls back to the defaults while loading or offline; the backend
 * re-prices every order at placement either way.
 */
export function useCheckoutPricing(): CheckoutPricing {
  const { data } = useQuery({
    queryKey: CHECKOUT_PRICING_QUERY_KEY,
    queryFn: async () => {
      const res = await getCheckoutPricingBackend();
      if (!res.ok) throw new Error(res.error);
      return { ...DEFAULT_CHECKOUT_PRICING, ...res.data };
    },
    staleTime: 60_000,
  });
  return data ?? DEFAULT_CHECKOUT_PRICING;
}
