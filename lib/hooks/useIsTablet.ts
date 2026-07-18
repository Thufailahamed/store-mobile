import { useWindowDimensions } from "react-native";

/** Width (in dp) at which we switch dense list/KPI layouts to a wider, multi-column form. */
export const TABLET_BREAKPOINT = 768;

/** True when the window is wide enough to be considered a tablet layout. */
export function useIsTablet(breakpoint: number = TABLET_BREAKPOINT): boolean {
  const { width } = useWindowDimensions();
  return width >= breakpoint;
}
