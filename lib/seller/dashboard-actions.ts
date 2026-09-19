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

/** Quick actions for the seller dashboard home — limited to everyday mobile operations. */
export const SELLER_DASHBOARD_ACTIONS: SellerDashboardAction[] = [
  { key: "orders", label: "Orders", hint: "Fulfil", icon: "bag-handle-outline", route: "/(seller)/orders" },
  { key: "products", label: "Products", hint: "Catalogue", icon: "pricetag-outline", route: "/(seller)/products" },
  { key: "inventory", label: "Inventory", hint: "Stock", icon: "cube-outline", route: "/(seller)/inventory" },
  { key: "payouts", label: "Payouts", hint: "Wallet", icon: "wallet-outline", route: "/(seller)/payouts" },
];
