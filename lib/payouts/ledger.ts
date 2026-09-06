import type { Payout } from "@/lib/api/backend";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABELS: Record<Payout["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function isPayoutId(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function formatPayoutStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status as Payout["status"]] ?? status;
}

export function payoutUserMessage(
  message: string | null | undefined,
  fallback: string,
): string {
  if (!message) return fallback;
  if (/invalid input syntax for type uuid/i.test(message)) return fallback;
  return message;
}
