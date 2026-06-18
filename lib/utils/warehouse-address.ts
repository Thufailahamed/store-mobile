/** Format warehouse address from JSON object or plain string. */
export function formatWarehouseAddress(
  address: string | Record<string, unknown> | null | undefined,
): string | null {
  if (address == null) return null;
  if (typeof address === "string") {
    const t = address.trim();
    return t.length ? t : null;
  }
  const line1 = typeof address.line1 === "string" ? address.line1 : "";
  const line2 = typeof address.line2 === "string" ? address.line2 : "";
  const city = typeof address.city === "string" ? address.city : "";
  const parts = [line1, line2, city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
