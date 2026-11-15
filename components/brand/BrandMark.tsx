import React from "react";
import Svg, { Path } from "react-native-svg";

/** Kept for the cart/notification count badges, which still use the accent pink. */
export const BRAND_PINK = "#ff2e85";

/** Brand olive (web olive-700) of the stitched-V logo. */
export const BRAND_OLIVE = "#414a23";

/**
 * Stitched-V logo geometry, shared with the web BrandMark
 * (store/src/components/brand-mark.tsx). Coordinates are in the 1024 artboard of
 * brand/vestara-stitched-logo.svg; the V spans x 383–641, y 301–524.43.
 */
export const V_PATH =
  "M383 301 L463 301 L538.75 432.2 L525.5 455.15 L449.2 323 L422.2 323 L512 478.54 L512 524.43 Z " +
  "M561 301 L641 301 L512 524.43 L512 478.54 L601.8 323 L574.8 323 L542.46 379.01 L529.21 356.06 Z";
export const V_STITCHES = [
  "M512 501.5 L402.6 312 L456.1 312 L524.23 430",
  "M512 501.5 L621.4 312 L567.9 312 L544.81 352",
];
export const V_VIEWBOX = "383 301 258 223.43";
/** Height ÷ width of the V. */
export const V_ASPECT = 223.43 / 258;

/**
 * Vestara stitched-V mark. `size` is the width; height follows the V's aspect.
 * Stitches are hidden below 20px, where the dashes would only read as noise.
 */
export function BrandMark({
  size = 30,
  color = BRAND_OLIVE,
  stitchColor = "#ffffff",
  stitches,
}: {
  size?: number;
  color?: string;
  stitchColor?: string;
  stitches?: boolean;
}) {
  const showStitches = stitches ?? size >= 20;
  return (
    <Svg width={size} height={size * V_ASPECT} viewBox={V_VIEWBOX} accessibilityLabel="Vestara">
      <Path d={V_PATH} fill={color} />
      {showStitches
        ? V_STITCHES.map((d) => (
            <Path
              key={d}
              d={d}
              fill="none"
              stroke={stitchColor}
              strokeWidth={2.5}
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        : null}
    </Svg>
  );
}
