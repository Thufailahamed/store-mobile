/**
 * Return-flow vocabulary for the parcel-style screens: ribbons, tone copy,
 * rail icons and stage mapping (Requested → Approved → Inspecting → Refunded).
 */
import type React from "react";
import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors } from "@/lib/theme/tokens";
import { LUX } from "@/components/orders/luxe-order";
import type { ReturnStatus } from "@/lib/account-local";

export type { ReturnStatus };

type McIcon = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export const RETURN_ICONS: McIcon[] = [
  "clipboard-text-clock-outline",
  "check-decagram-outline",
  "magnify-scan",
  "cash-refund",
];

export const RETURN_RIBBON: Record<ReturnStatus, { label: string; bg: string; fg: string }> = {
  requested: { label: "REQUESTED", bg: LUX.ink, fg: LUX.goldSoft },
  approved: { label: "APPROVED", bg: colors.olive[700], fg: LUX.lime },
  received: { label: "INSPECTING", bg: colors.olive[700], fg: LUX.lime },
  refunded: { label: "REFUNDED", bg: LUX.lime, fg: LUX.ink },
  rejected: { label: "DECLINED", bg: LUX.rust, fg: LUX.cream },
};

export const RETURN_TONE: Record<ReturnStatus, { label: string; line: string }> = {
  requested: { label: "Requested", line: "Waiting for the seller to review" },
  approved: { label: "Approved", line: "Pickup is being arranged" },
  received: { label: "Inspecting", line: "Received, checking condition" },
  refunded: { label: "Refunded", line: "Refund sent to your payment method" },
  rejected: { label: "Declined", line: "This return wasn't accepted" },
};

export function returnStage(status: ReturnStatus): number {
  if (status === "requested") return 0;
  if (status === "approved") return 1;
  if (status === "received") return 2;
  if (status === "refunded") return 3;
  return 1;
}

export function returnRailLabel(status: ReturnStatus): string | null {
  if (status === "requested") return "In review";
  if (status === "approved") return "Pickup";
  if (status === "received") return "Inspecting";
  if (status === "rejected") return "Declined";
  return null;
}
