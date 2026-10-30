/**
 * LUXE Mobile — Google Maps REST helpers.
 * Mirrors the website's maps-server.ts (geocoding) and maps.ts (autocomplete),
 * but lives on-device so the autocomplete results stream without server hops.
 *
 * Reverse geocoding falls back to expo-location (native on-device geocoder)
 * when the Google API key is missing or the REST call fails.
 */

import Constants from "expo-constants";
import * as Location from "expo-location";

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

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<GeocodeResult | null> {
  const API_KEY = resolveMapsApiKey();
  if (!API_KEY) return null;

  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: API_KEY,
  });

  try {
    const res = await fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results?: {
        formatted_address: string;
        types?: string[];
        address_components: { long_name: string; types: string[] }[];
      }[];
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    // results[0] is often a bare plus code ("7C3X+RXR, Mawanella") in areas
    // without mapped streets — prefer the most specific real address.
    const ranked = data.results.filter((r) => !r.types?.includes("plus_code"));
    const r =
      ranked.find((x) =>
        x.types?.some((t) => t === "street_address" || t === "premise" || t === "route")
      ) ??
      ranked[0] ??
      data.results[0];
    const components = enrichAddressComponents(
      parseAddressComponents(r.address_components),
      r.formatted_address
    );
    // Keep the user's exact pin — the result geometry is the address centroid.
    return { lat, lng, formatted: stripPlusCode(r.formatted_address), components };
  } catch {
    return null;
  }
}

async function reverseGeocodeNative(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!results.length) return null;
    const all = results.map(componentsFromNativeLocation);
    const best = all.find((c) => c.line1) ?? all[0];
    // Fill gaps from the other candidates.
    for (const c of all) {
      if (!best.city) best.city = c.city;
      if (!best.state) best.state = c.state;
      if (!best.postal_code) best.postal_code = c.postal_code;
    }
    return { lat, lng, formatted: formatAddress(best), components: best };
  } catch {
    return null;
  }
}

/** OpenStreetMap Nominatim — free, keyless; used only when Google + native lack a street. */
async function reverseGeocodeOsm(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "LUXE-Mobile/1.0 (com.luxe.marketplace)", "Accept-Language": "en" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const a = data.address;
    if (!a) return null;
    const street = [a.house_number, a.road].filter(Boolean).join(" ").trim();
    const area = a.neighbourhood || a.suburb || a.hamlet || a.quarter || "";
    const line1 =
      [street, area].filter(Boolean).join(", ") ||
      a.village ||
      (data.display_name ? stripPlusCode(data.display_name).split(",")[0]?.trim() : "") ||
      "";
    const city = a.city || a.town || a.village || a.suburb || a.county || "";
    const state = (a.state || a.state_district || "").replace(/\s+Province$/i, "");
    const components: AddressComponents = {
      line1,
      city,
      state: state || city,
      postal_code: a.postcode ?? "",
      country: a.country ?? "Sri Lanka",
    };
    return { lat, lng, formatted: formatAddress(components), components };
  } catch {
    return null;
  }
}

function hasStreet(r: GeocodeResult | null): boolean {
  return Boolean(r?.components.line1 && !isPlusCode(r.components.line1));
}

function mergeResults(primary: GeocodeResult, ...rest: (GeocodeResult | null)[]): GeocodeResult {
  const c = { ...primary.components };
  for (const r of rest) {
    if (!r) continue;
    if (!c.line1) c.line1 = r.components.line1;
    if (!c.city) c.city = r.components.city;
    if (!c.state) c.state = r.components.state;
    if (!c.postal_code) c.postal_code = r.components.postal_code;
    if (!c.country) c.country = r.components.country;
  }
  return { ...primary, components: c, formatted: formatAddress(c) };
}

/**
 * Google REST first; then the on-device geocoder; then OpenStreetMap when
 * neither produced a real street. Never returns a plus code as the street.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const google = await reverseGeocodeGoogle(lat, lng);
  if (hasStreet(google)) return google;

  const native = await reverseGeocodeNative(lat, lng);
  if (hasStreet(native)) return mergeResults(native!, google);

  const osm = await reverseGeocodeOsm(lat, lng);
  if (hasStreet(osm)) return mergeResults(osm!, native, google);

  const any = google ?? native ?? osm;
  return any ? mergeResults(any, native, osm) : null;
}

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

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
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

function componentsFromNativeLocation(r: Location.LocationGeocodedAddress): AddressComponents {
  const street = [r.streetNumber, r.street].filter(Boolean).join(" ").trim();
  const name = r.name ? stripPlusCode(r.name) : "";
  const namedPlace = name && name !== r.city && name !== r.region ? name : "";
  const line1 = street || namedPlace;
  const city = r.city || r.district || r.subregion || "";
  const state = r.region || r.subregion || r.district || "";
  return {
    line1,
    city,
    state,
    postal_code: r.postalCode ?? "",
    country: r.country ?? "Sri Lanka",
  };
}

function enrichAddressComponents(
  components: AddressComponents,
  formatted: string
): AddressComponents {
  let { line1, city, state, postal_code, country } = components;
  line1 = stripPlusCode(line1);
  if (!line1 && formatted) {
    line1 = stripPlusCode(formatted).split(",")[0]?.trim() ?? "";
    // Don't echo the city back as the street.
    if (line1 === city) line1 = "";
  }
  if (!city && state) city = state;
  if (!state && city) state = city;
  if (!country && formatted.toLowerCase().includes("sri lanka")) {
    country = "Sri Lanka";
  }
  return { line1, city, state, postal_code, country };
}

function formatAddress(c: AddressComponents): string {
  return [c.line1, c.city, c.state, c.postal_code, c.country].filter(Boolean).join(", ");
}
