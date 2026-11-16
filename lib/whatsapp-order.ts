import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/_fetch";
import { formatPrice } from "@/lib/utils";
import { safeOpenUrl } from "@/lib/utils/safe-open-url";
import type { Product, ProductVariant } from "@/lib/types";

/**
 * Foreign-sourced dresses (`order_channel = 'whatsapp'`) are never bought
 * through the bag: buyers open a WhatsApp chat with the team, who create
 * the order in admin. Mirrors store/src/lib/whatsapp-order.ts.
 */
export function isWhatsappOrderProduct(product: Pick<Product, "order_channel"> | null | undefined): boolean {
  return product?.order_channel === "whatsapp";
}

export function buildWhatsappOrderUrl(
  number: string,
  product: Pick<Product, "name" | "price" | "currency" | "sku" | "slug">,
  opts: { variant?: Pick<ProductVariant, "size" | "color" | "price" | "sku"> | null; qty?: number } = {},
): string {
  const { variant, qty = 1 } = opts;
  const web = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? "").replace(/\/$/, "") || "https://synapstore.shop";
  const price = variant?.price ?? product.price;
  const lines = [
    "Hi VESTARA, I'd like to order this dress:",
    `• ${product.name}`,
    variant?.size ? `• Size: ${variant.size}` : null,
    variant?.color ? `• Colour: ${variant.color}` : null,
    `• Qty: ${qty}`,
    `• Price: ${formatPrice(price, product.currency)}`,
    variant?.sku || product.sku ? `• Ref: ${variant?.sku || product.sku}` : null,
    `${web}/products/${encodeURIComponent(product.slug)}`,
  ].filter(Boolean);
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/** Admin-set order chat number (GET /api/checkout/whatsapp); null until configured. */
export function useWhatsappNumber(): { number: string | null; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["checkout", "whatsapp"],
    queryFn: async () => {
      const res = await fetchJson<{ number: string | null }>("/api/checkout/whatsapp", { requireAuth: false });
      if (!res.ok) throw new Error(res.error);
      return res.data?.number ?? null;
    },
    staleTime: 5 * 60_000,
  });
  return { number: data ?? null, isLoading };
}

/** Opens WhatsApp; returns false when no number is configured or the URL could not open. */
export async function openWhatsappOrder(
  number: string | null,
  product: Pick<Product, "name" | "price" | "currency" | "sku" | "slug">,
  opts: { variant?: Pick<ProductVariant, "size" | "color" | "price" | "sku"> | null; qty?: number } = {},
): Promise<boolean> {
  if (!number) return false;
  return safeOpenUrl(buildWhatsappOrderUrl(number, product, opts));
}
