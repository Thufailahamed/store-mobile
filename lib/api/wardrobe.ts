/**
 * Virtual wardrobe API wrappers.
 *
 * Mirrors the web backend module at
 * `store-backend/src/modules/wardrobe/`. All routes use the standard
 * envelope v2 (`{ok, data, version}`). Public share-token lookups skip
 * auth; everything else requires a session.
 */

import {
  fetchJson,
  type ApiResult,
} from "@/lib/api/_fetch";
import type {
  GarmentType,
  PublicWardrobeResponse,
  WardrobeHeader,
  WardrobeItem,
  WardrobeItemStatus,
  WardrobeOutfit,
  WardrobeStats,
} from "@/lib/types";

export interface ListItemsParams {
  status?: WardrobeItemStatus | "all";
  garment_type?: GarmentType | "all";
  q?: string;
  limit?: number;
}

export interface LogWearInput {
  worn_at?: string; // ISO timestamp
}

export interface AddManualItemInput {
  product_id: string;
  product_variant_id?: string;
  purchase_price?: number;
  purchased_at?: string;
  tags?: string[];
  notes?: string;
}

export interface OutfitItemInput {
  wardrobe_item_id: string;
  slot: string;
  position: number;
}

export interface CreateOutfitInput {
  name: string;
  occasion?: string;
  season?: string;
  notes?: string;
  scheduled_for?: string;
  weather?: string;
  items: OutfitItemInput[];
}

export interface UpdateOutfitInput {
  name?: string;
  occasion?: string | null;
  season?: string | null;
  notes?: string | null;
  scheduled_for?: string | null; // ISO date YYYY-MM-DD
  weather?: string | null;
}

export interface AutoGenerateOutfitsInput {
  occasion?: string;
  season?: "spring" | "summer" | "fall" | "winter" | null;
  seed_item_id?: string;
  limit?: number; // 1..10
}

/* -------- Items -------------------------------------------------------- */

export async function listWardrobeItems(
  params: ListItemsParams = {},
): Promise<ApiResult<{ items: WardrobeItem[] }>> {
  return fetchJson(`/api/wardrobe/items`, {
    query: {
      status: params.status,
      garment_type: params.garment_type,
      q: params.q,
      limit: params.limit ?? 200,
    },
  });
}

export async function addWardrobeItem(
  body: AddManualItemInput,
): Promise<ApiResult<{ item: WardrobeItem }>> {
  return fetchJson(`/api/wardrobe/items`, {
    method: "POST",
    body,
  });
}

export async function syncWardrobe(): Promise<ApiResult<{ inserted: number }>> {
  return fetchJson(`/api/wardrobe/items/sync`, { method: "POST" });
}

export async function logWardrobeWear(
  itemId: string,
  body: LogWearInput = {},
): Promise<
  ApiResult<{
    result: { wear_count: number; last_worn_at: string; cost_per_wear: number | null };
  }>
> {
  return fetchJson(`/api/wardrobe/items/${itemId}/wear`, {
    method: "POST",
    body,
  });
}

export async function updateWardrobeItem(
  itemId: string,
  patch: Partial<
    Pick<
      WardrobeItem,
      "status" | "season" | "occasion" | "tags" | "notes" | "color" | "size"
    > & { care_wear_threshold?: number | null; last_care_at?: string | null }
  >,
): Promise<ApiResult<{ item: WardrobeItem }>> {
  return fetchJson(`/api/wardrobe/items/${itemId}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteWardrobeItem(
  itemId: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchJson(`/api/wardrobe/items/${itemId}`, { method: "DELETE" });
}

/* -------- Outfits ------------------------------------------------------ */

export async function listWardrobeOutfits(): Promise<
  ApiResult<{ outfits: WardrobeOutfit[] }>
> {
  return fetchJson(`/api/wardrobe/outfits`);
}

export async function createWardrobeOutfit(
  body: CreateOutfitInput,
): Promise<ApiResult<{ outfit: WardrobeOutfit }>> {
  return fetchJson(`/api/wardrobe/outfits`, {
    method: "POST",
    body,
  });
}

export async function updateWardrobeOutfit(
  outfitId: string,
  patch: UpdateOutfitInput,
): Promise<ApiResult<{ outfit: WardrobeOutfit }>> {
  return fetchJson(`/api/wardrobe/outfits/${outfitId}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteWardrobeOutfit(
  outfitId: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchJson(`/api/wardrobe/outfits/${outfitId}`, { method: "DELETE" });
}

export async function addWardrobeOutfitItems(
  outfitId: string,
  items: OutfitItemInput[],
): Promise<ApiResult<{ added: number }>> {
  return fetchJson(`/api/wardrobe/outfits/${outfitId}/items`, {
    method: "POST",
    body: { items },
  });
}

export async function shareWardrobeOutfit(
  outfitId: string,
): Promise<ApiResult<{ outfit: WardrobeOutfit }>> {
  return fetchJson(`/api/wardrobe/outfits/${outfitId}/share`, {
    method: "POST",
  });
}

export async function logOutfitWear(
  outfitId: string,
  body: LogWearInput = {},
): Promise<ApiResult<{ items_logged: number }>> {
  return fetchJson(`/api/wardrobe/outfits/${outfitId}/log-wear`, {
    method: "POST",
    body,
  });
}

export async function autoGenerateOutfits(
  input: AutoGenerateOutfitsInput = {},
): Promise<ApiResult<{ outfits: unknown[]; count: number; generated_at: string }>> {
  return fetchJson(`/api/wardrobe/outfits/auto-generate`, {
    method: "POST",
    body: {
      occasion: input.occasion,
      season: input.season ?? undefined,
      seed_item_id: input.seed_item_id,
      limit: input.limit ?? 5,
    },
  });
}

export async function listWardrobeCalendar(
  from: string,
  to: string,
): Promise<ApiResult<{ outfits: WardrobeOutfit[] }>> {
  return fetchJson(`/api/wardrobe/outfits/calendar`, {
    query: { from, to },
  });
}

export async function getWardrobeInsights(): Promise<
  ApiResult<{
    as_of: string;
    counts: {
      never_worn: number;
      underused: number;
      care_due: number;
      recent: number;
    };
    never_worn: WardrobeItem[];
    underused: WardrobeItem[];
    care_due: WardrobeItem[];
    recent_wears: WardrobeItem[];
  }>
> {
  return fetchJson(`/api/wardrobe/stats/insights`);
}

export async function getWardrobeOverlap(
  productIds: string[],
): Promise<ApiResult<{ overlaps: unknown[] }>> {
  return fetchJson(`/api/wardrobe/overlap`, {
    method: "POST",
    body: { productIds },
  });
}

/* -------- Header / Stats ----------------------------------------------- */

export async function getWardrobeHeader(): Promise<
  ApiResult<{ wardrobe: WardrobeHeader | null }>
> {
  return fetchJson(`/api/wardrobe/header`);
}

export async function shareWardrobeHeader(): Promise<
  ApiResult<{ wardrobe: WardrobeHeader }>
> {
  return fetchJson(`/api/wardrobe/header/share`, { method: "POST" });
}

export async function revokeWardrobeShare(): Promise<
  ApiResult<{ wardrobe: WardrobeHeader }>
> {
  return fetchJson(`/api/wardrobe/header/share`, { method: "DELETE" });
}

export async function getWardrobeStats(): Promise<ApiResult<WardrobeStats>> {
  return fetchJson(`/api/wardrobe/stats`);
}

/* -------- Public share ------------------------------------------------- */

export async function getPublicWardrobe(
  token: string,
): Promise<ApiResult<PublicWardrobeResponse>> {
  return fetchJson(`/api/wardrobe/share/${encodeURIComponent(token)}`, {
    requireAuth: false,
  });
}
