import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

/**
 * No bottom navigation bar — removed per product decision. Primary
 * navigation (search, wishlist, bag, account) lives in `AppHeader`'s icon
 * row instead, so this renders nothing but keeps the same name/signature
 * as the `tabBar` render-prop expected by `(main)/_layout.tsx`.
 */
export function ExpandableTabBar(_props: BottomTabBarProps) {
  return null;
}

/** No bar to clear anymore — just the safe-area inset. */
export function expandableTabBarInset(safeBottom: number) {
  return safeBottom;
}
