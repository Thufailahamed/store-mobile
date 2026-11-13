import React from "react";
import Svg, { Path } from "react-native-svg";

export const BRAND_PINK = "#ff2e85";

const PATHS = [
  "M51.5 20.5 A9 9 0 1 1 66 26 C62.5 28 60 29.5 60 33 V38",
  "M60 38 L15.5 61.5 C7 66 5.5 70 7.5 73.5 C9 76.2 12.5 77 18 77 H102 C107.5 77 111 76.2 112.5 73.5 C114.5 70 113 66 104.5 61.5 Z",
  "M60 77 V70.5 C53 64.5 47.5 60 47.5 54.5 C47.5 50.6 50.4 48 53.8 48 C56.6 48 58.6 49.8 60 52.4 C61.4 49.8 63.4 48 66.2 48 C69.6 48 72.5 50.6 72.5 54.5 C72.5 60 67 64.5 60 70.5",
];

/** Vestara hanger-heart mark (same 120×100 paths as the launch animation). */
export function BrandMark({ size = 30, color = BRAND_PINK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * (100 / 120)} viewBox="0 0 120 100" accessibilityLabel="Vestara">
      {PATHS.map((d) => (
        <Path key={d} d={d} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
