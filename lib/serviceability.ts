/**
 * Client-only pincode / ETA helper. Mirrors web `src/lib/serviceability.ts`.
 * Sri Lanka postal codes are 5 digits; first 3 digits map to a city cluster.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "luxe:delivery-pincode";

export interface ServiceabilityResult {
  city: string;
  eta: string;
  postal: string;
}

type CityMap = Record<string, { city: string; days: [number, number] }>;

const CITY_MAP: CityMap = {
  "001": { city: "Colombo Fort", days: [1, 2] },
  "002": { city: "Colombo", days: [1, 2] },
  "003": { city: "Colombo 03", days: [1, 2] },
  "004": { city: "Colombo 04 (Bambalapitiya)", days: [1, 2] },
  "005": { city: "Colombo 05", days: [1, 2] },
  "006": { city: "Colombo 06", days: [1, 2] },
  "007": { city: "Colombo 07 (Cinnamon Gardens)", days: [1, 2] },
  "008": { city: "Colombo 08", days: [1, 2] },
  "009": { city: "Colombo 09", days: [1, 2] },
  "010": { city: "Colombo 10 (Maradana)", days: [1, 3] },
  "102": { city: "Kaduwela", days: [2, 3] },
  "103": { city: "Malabe", days: [2, 3] },
  "104": { city: "Homagama", days: [2, 4] },
  "110": { city: "Nugegoda", days: [2, 3] },
  "112": { city: "Maharagama", days: [2, 3] },
  "120": { city: "Piliyandala", days: [2, 4] },
  "125": { city: "Moratuwa", days: [2, 4] },
  "200": { city: "Gampaha", days: [2, 4] },
  "220": { city: "Negombo", days: [2, 4] },
  "300": { city: "Kandy", days: [3, 5] },
  "400": { city: "Jaffna", days: [5, 7] },
  "500": { city: "Galle", days: [3, 5] },
  "600": { city: "Matara", days: [3, 5] },
  "700": { city: "Anuradhapura", days: [4, 6] },
  "800": { city: "Trincomalee", days: [4, 6] },
  "900": { city: "Badulla", days: [4, 7] },
};

const DEFAULT_FALLBACK: { city: string; days: [number, number] } = {
  city: "Sri Lanka",
  days: [4, 7],
};

function daysToEta([min, max]: [number, number]) {
  if (min === max) return `${min} day${min === 1 ? "" : "s"}`;
  return `${min}-${max} days`;
}

export function checkServiceability(
  postal: string,
): ServiceabilityResult | { error: "invalid" | "unsupported" } {
  const cleaned = postal.replace(/\s|-/g, "").trim();
  if (!/^\d{5}$/.test(cleaned)) return { error: "invalid" };
  const prefix = cleaned.slice(0, 3);
  const hit = CITY_MAP[prefix];
  const entry = hit ?? { ...DEFAULT_FALLBACK, city: `${DEFAULT_FALLBACK.city} (${prefix})` };
  return {
    city: entry.city,
    eta: daysToEta(entry.days),
    postal: cleaned,
  };
}

export function formatEta(result: ServiceabilityResult) {
  return `Delivery to ${result.city} (${result.postal}) in ${result.eta}`;
}

export async function getSavedPincode(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function savePincode(postal: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, postal);
  } catch {
    /* ignore */
  }
}
