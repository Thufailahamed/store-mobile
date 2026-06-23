/**
 * Search recommendation system — API + event tracking tests.
 *
 * Covers:
 *   • getSearchSuggestionsV2       → B.getSearchSuggestionsBackend, payload reshaping
 *   • getWishlistPriceDrops        → returns ok([]) directly (no backend call)
 *   • uploadScanImage              → presigned-URL upload via fetch (auth still via supabase)
 *   • reverseImageMatch            → B.imageSearchBackend, row → ScanMatch mapping
 *   • trackEvent surface field     → preserved on view + search events
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── hoisted mocks (factories run before any import) ─────────────────────────
const { store, getUserMock, getSessionMock, getSearchSuggestionsBackendMock, imageSearchBackendMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const getUserMock = vi.fn();
  const getSessionMock = vi.fn();
  const getSearchSuggestionsBackendMock = vi.fn();
  const imageSearchBackendMock = vi.fn();
  return { store, getUserMock, getSessionMock, getSearchSuggestionsBackendMock, imageSearchBackendMock };
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
      auth: {
        getUser: getUserMock,
        getSession: getSessionMock,
      },
    },
  };
});

vi.mock("@/lib/api/backend", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getSearchSuggestionsBackend: getSearchSuggestionsBackendMock,
    imageSearchBackend: imageSearchBackendMock,
  };
});

// fetch is used by uploadScanImage → blob() + presigned URL flow
const fetchMock = vi.fn();
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
  getUserMock.mockReset();
  getSessionMock.mockReset();
  getSearchSuggestionsBackendMock.mockReset();
  imageSearchBackendMock.mockReset();
  fetchMock.mockReset();
});

// ── getSearchSuggestionsV2 ──────────────────────────────────────────────────
describe("getSearchSuggestionsV2", () => {
  it("returns [] for terms shorter than 1 char without hitting the backend", async () => {
    const r = await getSearchSuggestionsV2("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
    expect(getSearchSuggestionsBackendMock).not.toHaveBeenCalled();
  });

  it("invokes getSearchSuggestionsBackend with the trimmed term and returns shaped rows", async () => {
    const suggestions = [
      { type: "keyword", label: "Shirts", slug: undefined, count: 21, logo_url: undefined, followers: undefined, is_verified: undefined },
      { type: "store", label: "SHOWOFF", slug: undefined, count: undefined, logo_url: undefined, followers: 8956, is_verified: true },
    ];
    getSearchSuggestionsBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { suggestions },
    });
    const r = await getSearchSuggestionsV2("  sh  ");
    expect(r.ok).toBe(true);
    if (r.ok) {
      // The implementation reshapes: type→kind, adds trend_pct: 0
      expect(r.data).toEqual([
        { kind: "keyword", label: "Shirts", slug: undefined, count: 21, logo_url: undefined, followers: undefined, is_verified: undefined, trend_pct: 0 },
        { kind: "store", label: "SHOWOFF", slug: undefined, count: undefined, logo_url: undefined, followers: 8956, is_verified: true, trend_pct: 0 },
      ]);
    }
    expect(getSearchSuggestionsBackendMock).toHaveBeenCalledWith("sh");
  });

  it("returns fail() when the backend errors", async () => {
    getSearchSuggestionsBackendMock.mockResolvedValueOnce({
      ok: false,
      error: "boom",
    });
    const r = await getSearchSuggestionsV2("sh");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("boom");
  });
});

// ── getWishlistPriceDrops ───────────────────────────────────────────────────
describe("getWishlistPriceDrops", () => {
  it("returns ok([]) always (implementation returns empty array directly)", async () => {
    const r = await getWishlistPriceDrops();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
  });
});

// ── uploadScanImage ─────────────────────────────────────────────────────────
describe("uploadScanImage", () => {
  it("uploads via presigned URL flow and returns path + publicUrl", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: userId } } });
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: "tok-123" } } });

    // 1st fetch: blob from uri
    // 2nd fetch: presigned URL request
    // 3rd fetch: PUT to upload URL
    fetchMock
      .mockResolvedValueOnce({ blob: async () => new Blob([new Uint8Array(8)]) })    // fetch(uri)
      .mockResolvedValueOnce({                                                         // POST presigned-url
        ok: true,
        json: async () => ({
          uploadUrl: "https://r2.example.com/upload",
          publicUrl: "https://cdn.example.com/scan-uploads/user-1/12345.jpg",
          key: "user-1/12345.jpg",
        }),
      })
      .mockResolvedValueOnce({ ok: true });                                            // PUT upload

    const r = await uploadScanImage("file:///tmp/photo.JPG?cache=1", "camera");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.path).toBe("user-1/12345.jpg");
      expect(r.data.url).toBe("https://cdn.example.com/scan-uploads/user-1/12345.jpg");
    }
    // First call: fetch the image blob
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
  it("maps a product match to a ScanMatch", async () => {
    imageSearchBackendMock.mockResolvedValueOnce({
      ok: true,
      data: {
        matches: [{ id: "p1", name: "Shirt X", slug: "shirt-x", price: 100, score: 0.5 }],
      },
    });
    const r = await reverseImageMatch("user-1/123.jpg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.kind).toBe("product");
      expect(r.data.product_id).toBe("p1");
      expect(r.data.slug).toBe("shirt-x");
      expect(r.data.confidence).toBeCloseTo(0.5);
    }
    expect(imageSearchBackendMock).toHaveBeenCalledWith("user-1/123.jpg", 1);
  });

  it("returns kind:'none' with confidence 0 when no matches", async () => {
    imageSearchBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { matches: [] },
    });
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
