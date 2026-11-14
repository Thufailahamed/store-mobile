/**
 * Home hero banner images (the big swipeable image cards under the
 * category icons).
 *
 * Add a banner:
 *   1. Drop the image in `assets/home-banners/` — portrait 3:4, e.g. 900×1200.
 *      Put all text / "Shop Now" artwork inside the image itself; the card
 *      shows the picture full-bleed with only a coloured frame around it.
 *   2. Add an entry below:  { image: require("@/assets/home-banners/wedding.jpg"), link: "/(main)/products?sale=1" }
 *      A remote URL also works: { image: "https://…/banner.jpg", link: "…" }
 *
 * While this list is empty the carousel falls back to the CMS banners
 * (`banners` table, `image_url` column).
 */
import type { ImageSourcePropType } from "react-native";

export type HeroBanner = {
  /** `require(...)` for a bundled asset, or an https URL. */
  image: ImageSourcePropType | string;
  /** Route opened on tap. Defaults to the product listing. */
  link?: string;
  /** Frame colour around the card. Defaults to a rotating palette. */
  frame?: string;
  /** Screen-reader label. */
  label?: string;
};

const shop = (q: string, title: string) =>
  `/(main)/products?${q}&title=${encodeURIComponent(title)}`;

export const HERO_BANNERS: HeroBanner[] = [
  {
    image: require("@/assets/home-banners/wedding.webp"),
    link: shop("occasion=wedding", "Wedding & Festive"),
    frame: "#7a1330",
    label: "Wedding and festive collection",
  },
  {
    image: require("@/assets/home-banners/womens.webp"),
    link: shop("search=women", "Women's Fashion"),
    frame: "#c98a3d",
    label: "Women's fashion",
  },
  {
    image: require("@/assets/home-banners/mens.webp"),
    link: shop("search=men", "Men's Fashion"),
    frame: "#0f1f4d",
    label: "Men's fashion",
  },
  {
    image: require("@/assets/home-banners/summer.webp"),
    link: shop("occasion=casual", "Casual & Summer"),
    frame: "#1f8a8a",
    label: "Casual and summer collection",
  },
  {
    image: require("@/assets/home-banners/streetwear.webp"),
    link: shop("search=streetwear", "Gen Z Streetwear"),
    frame: "#5b21b6",
    label: "Gen Z streetwear",
  },
  {
    image: require("@/assets/home-banners/kids.webp"),
    link: shop("search=kids", "Kids' Fashion"),
    frame: "#a78bfa",
    label: "Kids' fashion",
  },
];
