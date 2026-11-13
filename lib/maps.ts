/**
 * VESTARA Mobile — Google Maps REST helpers.
 * Mirrors the website's maps-server.ts (geocoding) and maps.ts (autocomplete),
 * but lives on-device so the autocomplete results stream without server hops.
 *
 */

import Constants from "expo-constants";

const PLACEHOLDER_KEY = "GOOGLE_MAPS_API_KEY_PLACEHOLDER";

function resolveMapsApiKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (fromEnv && fromEnv !== PLACEHOLDER_KEY) return fromEnv;

  const fromConfig =
    Constants.expoConfig?.extra?.googleMapsApiKey ??
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey ??
    Constants.expoConfig?.ios?.config?.googleMapsApiKey;
  if (typeof fromConfig === "string" && fromConfig !== PLACEHOLDER_KEY) return fromConfig;

  return undefined;
}

export const isMapsConfigured = (): boolean => Boolean(resolveMapsApiKey());

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface AddressComponents {
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
  components: AddressComponents;
}

/* ------------------------------------------------------------------ */
/*  Autocomplete                                                       */
/* ------------------------------------------------------------------ */

export async function placeAutocomplete(
  input: string,
  opts: { country?: string; limit?: number } = {}
): Promise<PlacePrediction[]> {
  const API_KEY = resolveMapsApiKey();
  if (!API_KEY) return [];
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    input: trimmed,
    key: API_KEY,
    types: "address",
  });
  if (opts.country) params.set("components", `country:${opts.country.toLowerCase()}`);
  if (opts.limit) params.set("limit", String(Math.min(opts.limit, 5)));

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status: string;
      predictions?: {
        place_id: string;
        description: string;
        structured_formatting?: { main_text: string; secondary_text: string };
      }[];
    };
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return [];
    return (data.predictions ?? []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text ?? p.description,
      secondaryText: p.structured_formatting?.secondary_text ?? "",
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Place details (lat/lng + address components)                       */
/* ------------------------------------------------------------------ */

export async function placeDetails(placeId: string): Promise<GeocodeResult | null> {
  const API_KEY = resolveMapsApiKey();
  if (!API_KEY) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    key: API_KEY,
    fields: "geometry,address_component,formatted_address",
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      result?: {
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number } };
        address_components?: { long_name: string; types: string[] }[];
      };
    };
    if (data.status !== "OK" || !data.result) return null;
    const r = data.result;
    const loc = r.geometry?.location;
    if (!loc) return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formatted: r.formatted_address ?? "",
      components: parseAddressComponents(r.address_components ?? []),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Reverse geocoding (lat/lng → address)                              */
/* ------------------------------------------------------------------ */

/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PLUS_CODE_RE = /\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}\b/gi;

export function isPlusCode(s: string): boolean {
  return new RegExp(`^${PLUS_CODE_RE.source}$`, "i").test(s.trim());
}

/** Remove Open Location Codes ("7C3X+RXR") and tidy leftover separators. */
export function stripPlusCode(s: string): string {
  return s
    .replace(PLUS_CODE_RE, "")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/,\s*,/g, ",")
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Component parser — mirrors web/src/app/account/addresses logic     */
/* ------------------------------------------------------------------ */

export function parseAddressComponents(
  components: { long_name: string; types: string[] }[]
): AddressComponents {
  let line1 = "";
  let city = "";
  let state = "";
  let postal_code = "";
  let country = "";

  for (const c of components) {
    const t = c.types;
    if (t.includes("street_number")) {
      line1 = `${c.long_name} ${line1}`.trim();
    } else if (t.includes("route")) {
      line1 = `${line1} ${c.long_name}`.trim();
    } else if (
      t.includes("sublocality") ||
      t.includes("neighborhood") ||
      t.includes("sublocality_level_1")
    ) {
      if (line1) line1 = `${line1}, ${c.long_name}`;
      else line1 = c.long_name;
    } else if (t.includes("locality") || t.includes("postal_town")) {
      if (!city) city = c.long_name;
    } else if (t.includes("administrative_area_level_2")) {
      if (!city) city = c.long_name;
      else if (!state) state = c.long_name;
    } else if (t.includes("administrative_area_level_1")) {
      state = c.long_name;
    } else if (t.includes("administrative_area_level_3") && !line1) {
      line1 = c.long_name;
    } else if (t.includes("postal_code")) {
      postal_code = c.long_name;
    } else if (t.includes("country")) {
      country = c.long_name;
    }
  }

  return { line1, city, state, postal_code, country };
}

