/**
 * Search recommendation system — API + event tracking tests.
 *
 * Covers:
 *   • getSearchSuggestionsV2       → search_suggestions_v2 RPC, payload passthrough
 *   • getWishlistPriceDrops        → wishlist_price_drops RPC, current-user binding
 *   • uploadScanImage              → scan-uploads bucket, user-folder path
 *   • reverseImageMatch            → row → ScanMatch mapping (kind/none branch)
 *   • trackEvent surface field     → preserved on view + search events
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── hoisted mocks (factories run before any import) ─────────────────────────
const { store, rpcMock, uploadMock, getUserMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const uploadMock = vi.fn();
  const getUserMock = vi.fn();
  const rpcMock = vi.fn();
  return { store, rpcMock, uploadMock, getUserMock };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
  },
}));

vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      rpc: rpcMock,
      auth: { getUser: getUserMock },
      storage: {
        from: (_bucket: string) => ({
          upload: uploadMock,
          getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }),
        }),
      },
    },
  };
});

// fetch is used by uploadScanImage → blob()
const fetchMock = vi.fn(async () => ({ blob: async () => new Blob([new Uint8Array(8)]) }));
(globalThis as any).fetch = fetchMock;

// ── imports under test ─────────────────────────────────────────────────────
import {
  getSearchSuggestionsV2,
  getWishlistPriceDrops,
  uploadScanImage,
  reverseImageMatch,
} from "@/lib/api";
import { trackEvent, readEvents, type SearchEvent, type ViewEvent } from "@/lib/recommender/events";

const userId = "user-1";
const storageKey = `luxe:${userId}:rec_events`;

beforeEach(() => {
  store.clear();
  rpcMock.mockReset();
  uploadMock.mockReset();
  getUserMock.mockReset();
  fetchMock.mockClear();
});

// ── getSearchSuggestionsV2 ──────────────────────────────────────────────────
describe("getSearchSuggestionsV2", () => {
  it("returns [] for terms shorter than 1 char without hitting the RPC", async () => {
    const r = await getSearchSuggestionsV2("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("invokes search_suggestions_v2 with the trimmed term and returns rows", async () => {
    const rows = [
      { kind: "keyword", label: "Shirts", count: 21 },
      { kind: "store", label: "SHOWOFF", followers: 8956, is_verified: true },
    ];
    rpcMock.mockResolvedValueOnce({ data: rows, error: null });
    const r = await getSearchSuggestionsV2("  sh  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(rows);
    expect(rpcMock).toHaveBeenCalledWith("search_suggestions_v2", { p_term: "sh" });
  });

  it("returns fail() when the RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const r = await getSearchSuggestionsV2("sh");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("boom");
  });
});

// ── getWishlistPriceDrops ───────────────────────────────────────────────────
describe("getWishlistPriceDrops", () => {
  it("returns [] when no user is signed in (no RPC call)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const r = await getWishlistPriceDrops();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls wishlist_price_drops RPC with the current user id", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: userId } } });
    rpcMock.mockResolvedValueOnce({ data: [{ product_id: "p1", drop_pct: 20 }], error: null });
    const r = await getWishlistPriceDrops();
    expect(r.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("wishlist_price_drops", { p_user: userId });
    if (r.ok) expect(r.data[0].product_id).toBe("p1");
  });
});

// ── uploadScanImage ─────────────────────────────────────────────────────────
describe("uploadScanImage", () => {
  it("uploads to scan-uploads bucket under <userId>/<timestamp>.<ext>", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: userId } } });
    uploadMock.mockResolvedValueOnce({ error: null });
    const r = await uploadScanImage("file:///tmp/photo.JPG?cache=1", "camera");
    expect(r.ok).toBe(true);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path, blob, opts] = uploadMock.mock.calls[0];
    expect(path).toMatch(/^user-1\/\d+\.jpg$/);
    expect(blob).toBeDefined();
    expect(opts.contentType).toBe("image/jpg");
    if (r.ok) expect(r.data.url).toBe(`https://cdn/${path}`);
  });

  it("returns fail() when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    const r = await uploadScanImage("file:///tmp/photo.jpg", "library");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Not authenticated");
  });
});

// ── reverseImageMatch ───────────────────────────────────────────────────────
describe("reverseImageMatch", () => {
  it("maps a product row to a ScanMatch", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: userId } } });
    rpcMock.mockResolvedValueOnce({
      data: [{ kind: "product", product_id: "p1", store_id: "s1", slug: "shirt-x", confidence: 0.5 }],
      error: null,
    });
    const r = await reverseImageMatch("user-1/123.jpg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.kind).toBe("product");
      expect(r.data.product_id).toBe("p1");
      expect(r.data.slug).toBe("shirt-x");
      expect(r.data.confidence).toBeCloseTo(0.5);
    }
  });

  it("maps a 'none' result to a clean ScanMatch with confidence 0", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: userId } } });
    rpcMock.mockResolvedValueOnce({ data: [{ kind: "none" }], error: null });
    const r = await reverseImageMatch("user-1/123.jpg");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ kind: "none", confidence: 0 });
  });
});

// ── trackEvent surface field ────────────────────────────────────────────────
describe("trackEvent surface field", () => {
  // trackEvent() is fire-and-forget (`void appendEvent(...)`). Yield so the
  // awaited writes inside appendEvent complete before we read back.
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));

  it("preserves surface on a search event written by searchSuggestion()", async () => {
    trackEvent(userId, {
      type: "search",
      t: Date.now(),
      query: "Shirts",
      tokens: ["shirts"],
      resultCount: 0,
      surface: "suggestion",
    });
    await flush();
    const events = await readEvents(userId);
    expect(events).toHaveLength(1);
    const e = events[0] as SearchEvent;
    expect(e.type).toBe("search");
    expect(e.surface).toBe("suggestion");
    expect(e.query).toBe("Shirts");
  });

  it("preserves surface on a view event written by scan()", async () => {
    trackEvent(userId, {
      type: "view",
      t: Date.now(),
      product: { id: "scan-123" },
      surface: "scan:camera",
    });
    await flush();
    const events = await readEvents(userId);
    expect(events).toHaveLength(1);
    const e = events[0] as ViewEvent;
    expect(e.type).toBe("view");
    expect(e.surface).toBe("scan:camera");
    expect(e.product.id).toBe("scan-123");
  });

  it("backwards-compatible — view event without surface is still valid", async () => {
    trackEvent(userId, {
      type: "view",
      t: Date.now(),
      product: { id: "p1" },
    });
    await flush();
    const events = await readEvents(userId);
    expect(events).toHaveLength(1);
    const e = events[0] as ViewEvent;
    expect(e.surface).toBeUndefined();
  });

  it("lands in the per-user storage bucket", async () => {
    trackEvent(userId, {
      type: "search",
      t: Date.now(),
      query: "shoes",
      tokens: ["shoes"],
      resultCount: 0,
      surface: "suggestion",
    });
    await flush();
    expect(store.has(storageKey)).toBe(true);
    const raw = store.get(storageKey)!;
    expect(JSON.parse(raw)[0].query).toBe("shoes");
  });
});
