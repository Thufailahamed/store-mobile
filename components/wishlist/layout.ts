import { Dimensions } from "react-native";
import { spacing } from "@/lib/theme/tokens";

export const WISHLIST_H_PAD = spacing[5];
export const WISHLIST_GRID_GAP = spacing[3];

const SCREEN_WIDTH = Dimensions.get("window").width;

export const WISHLIST_CARD_WIDTH =
  (SCREEN_WIDTH - WISHLIST_H_PAD * 2 - WISHLIST_GRID_GAP) / 2;

export const WISHLIST_IMAGE_HEIGHT = WISHLIST_CARD_WIDTH * 1.22;
