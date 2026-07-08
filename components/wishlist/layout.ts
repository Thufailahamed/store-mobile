import { useWindowDimensions } from "react-native";
import { spacing } from "@/lib/theme/tokens";

export const WISHLIST_H_PAD = spacing[5];
export const WISHLIST_GRID_GAP = spacing[3];

/** Reactive card/image sizing so the grid stays correct if the window ever resizes
 *  (Android split-screen/multi-window, a foldable unfolding) instead of using the
 *  width captured once at module load. */
export function useWishlistLayout() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - WISHLIST_H_PAD * 2 - WISHLIST_GRID_GAP) / 2;
  const imageHeight = cardWidth * 1.22;
  return { cardWidth, imageHeight };
}
