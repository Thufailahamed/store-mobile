/**
 * Shared delivery-screen formatting & state helpers.
 * Previously inlined in each (delivery)/* screen — extracted to a single source of truth
 * so dashboard / orders / history / pickups / detail stay consistent.
 */

import type { Order } from "@/lib/types";

export function formatPrice(n: number): string {
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

export function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
}

export function elapsedMs(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

export type UrgencyTone = { label: string; color: string; bg: string };

export function urgencyLabel(ms: number): UrgencyTone {
  const mins = ms / 60000;
  if (mins < 30) return { label: "Fresh", color: "#16a34a", bg: "#dcfce7" };
  if (mins < 90) return { label: "On time", color: "#d97706", bg: "#fef9c3" };
  if (mins < 180) return { label: "Aging", color: "#ea580c", bg: "#fff7ed" };
  return { label: "Late", color: "#dc2626", bg: "#fef2f2" };
}

export type StatusTone = { bg: string; text: string };

export const STATUS_COLORS: Record<string, StatusTone> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dbeafe", text: "#1e40af" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  shipped: { bg: "#fef3c7", text: "#92400e" },
  out_for_delivery: { bg: "#dcfce7", text: "#166534" },
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
  returned: { bg: "#f3e8ff", text: "#7c3aed" },
  refunded: { bg: "#fce7f3", text: "#be185d" },
};

export const PICKUP_STATUS_COLORS: Record<string, StatusTone> = {
  scheduled: { bg: "#fef3c7", text: "#92400e" },
  out_for_pickup: { bg: "#dbeafe", text: "#1e40af" },
  picked_up: { bg: "#e0e7ff", text: "#3730a3" },
  completed: { bg: "#dcfce7", text: "#166534" },
  failed: { bg: "#fee2e2", text: "#b91c1c" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
};

export type IssueReason =
  | "customer_absent"
  | "wrong_address"
  | "refused"
  | "damaged"
  | "other";

export const ISSUE_REASONS: { value: IssueReason; label: string }[] = [
  { value: "customer_absent", label: "Customer absent" },
  { value: "wrong_address", label: "Wrong address" },
  { value: "refused", label: "Customer refused" },
  { value: "damaged", label: "Package damaged" },
  { value: "other", label: "Other" },
];

export function isCompleted(s: string): boolean {
  return ["delivered", "returned", "refunded", "cancelled"].includes(s);
}

export function mapsUrl(addr?: Order["shipping_address"] | Record<string, string> | null): string {
  if (!addr) return "#";
  const parts = [
    (addr as Record<string, string>).line1,
    (addr as Record<string, string>).line2,
    (addr as Record<string, string>).city,
    (addr as Record<string, string>).state,
    (addr as Record<string, string>).postal_code,
    (addr as Record<string, string>).country,
  ].filter(Boolean);
  if (parts.length === 0) return "#";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(", "))}`;
}

export function whatsappUrl(phone?: string | null): string {
  if (!phone) return "#";
  const cleaned = phone.replace(/[^0-9+]/g, "");
  return `https://wa.me/${cleaned.replace(/^\+/, "")}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Human-readable "time since" timer for shift duration. */
export function formatShiftElapsed(startedAt: string | null): string {
  if (!startedAt) return "00:00";
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
