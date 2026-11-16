/**
 * Bundled fallback home hero banners. Intentionally empty.
 *
 * Home hero banners are managed in the admin portal (Banners → position
 * `home_hero`, `image_url` column of the `banners` table). The carousel
 * reads those first. Only when the CMS list is empty does it fall back to
 * this array, so leave it empty unless you want a bundled fallback.
 *
 * Bundled images still in `assets/home-banners/` (upload these via admin):
 *   wedding.webp, womens.webp, mens.webp, summer.webp, streetwear.webp, kids.webp
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

export const HERO_BANNERS: HeroBanner[] = [];
