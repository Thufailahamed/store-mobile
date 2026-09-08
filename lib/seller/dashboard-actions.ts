import type { IonIconName } from "@/components/ui/Icon";

export type SellerDashboardActionBadge = "returns" | "alerts";

export interface SellerDashboardAction {
  key: string;
  label: string;
  hint: string;
  icon: IonIconName;
  route: string;
  badgeKey?: SellerDashboardActionBadge;
}

/** Quick actions for the seller dashboard home — order matches web IA priority. */
export const SELLER_DASHBOARD_ACTIONS: SellerDashboardAction[] = [
  { key: "orders", label: "Orders", hint: "Fulfil", icon: "bag-handle-outline", route: "/(seller)/orders" },
  { key: "products", label: "Products", hint: "Catalogue", icon: "pricetag-outline", route: "/(seller)/products" },
  { key: "payouts", label: "Payouts", hint: "Wallet", icon: "wallet-outline", route: "/(seller)/payouts" },
  { key: "analytics", label: "Analytics", hint: "Reports", icon: "bar-chart-outline", route: "/(seller)/analytics" },
  { key: "returns", label: "Returns", hint: "Decide", icon: "return-down-back-outline", route: "/(seller)/returns", badgeKey: "returns" },
  { key: "alerts", label: "Alerts", hint: "Inbox", icon: "notifications-outline", route: "/(seller)/notifications", badgeKey: "alerts" },
];
