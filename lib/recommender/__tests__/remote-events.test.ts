/**
 * Remote event sync tests.
 *
 * Mocks the backend API client and AsyncStorage so we can exercise the
 * offline queue, throttle, and dedupe behavior without a network or
 * real storage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// vi.mock factories are hoisted. We need hoisted mocks for the backend
// functions and a hoisted storage map so they are available before any
// imports run.
const { store, appendMock, fetchMock, clearMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const appendMock = vi.fn();
  const fetchMock = vi.fn();
  const clearMock = vi.fn();
  return { store, appendMock, fetchMock, clearMock };
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

vi.mock("@/lib/api/backend", () => ({
  appendEventsBackend: appendMock,
  fetchRecentEventsBackend: fetchMock,
  clearEventsBackend: clearMock,
}));

import {
  enqueueRemoteEvent,
  flushQueue,
  fetchRemoteEvents,
  clearRemoteEvents,
  __resetThrottleForTest,
} from "../remote-events";
import type { RecommendationEvent } from "../events";

const USER = "user-1";
const QUEUE_KEY = `luxe:${USER}:event_sync_queue`;

function viewEvent(id: string, t: number): RecommendationEvent {
  return {
    type: "view",
    t,
    dwellMs: 1000,
    product: {
      id,
      category_id: "shirts",
      brand_id: "b1",
      store_id: "s1",
      material: "cotton",
      gender: "unisex",
      price: 100,
      colors: ["black"],
      tags: ["casual"],
    },
  };
}

async function readQueue(): Promise<RecommendationEvent[]> {
  const raw = store.get(QUEUE_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  __resetThrottleForTest();
  vi.useRealTimers();
  vi.spyOn(Date, "now").mockReturnValue(100000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enqueueRemoteEvent", () => {
  it("persists the event and triggers a flush", async () => {
    appendMock.mockResolvedValue({ ok: true, data: { appended: 1 } });
    enqueueRemoteEvent(USER, viewEvent("a", 1));
    await new Promise((r) => setTimeout(r, 10));
    expect(appendMock).toHaveBeenCalled();
    expect(await readQueue()).toEqual([]);
  });

  it("is a no-op for guest users", async () => {
    enqueueRemoteEvent(null, viewEvent("a", 1));
    await new Promise((r) => setTimeout(r, 10));
    expect(appendMock).not.toHaveBeenCalled();
  });
});

describe("flushQueue", () => {
  it("returns 0 when the queue is empty", async () => {
    expect(await flushQueue(USER)).toBe(0);
  });

  it("returns 0 for guest users", async () => {
    expect(await flushQueue(null)).toBe(0);
  });

  it("serializes events to rows and calls appendEventsBackend", async () => {
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("a", 100)]));
    appendMock.mockResolvedValue({ ok: true, data: { appended: 1 } });
    const sent = await flushQueue(USER);
    expect(sent).toBe(1);
    expect(appendMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: "view",
          product_id: "a",
          metadata: expect.objectContaining({
            t: 100,
            product: expect.objectContaining({ id: "a" }),
          }),
        }),
      ]),
    );
    expect(await readQueue()).toEqual([]);
  });

  it("keeps the queue intact on backend error", async () => {
    const events = [viewEvent("a", 100), viewEvent("b", 90)];
    store.set(QUEUE_KEY, JSON.stringify(events));
    appendMock.mockResolvedValue({ ok: false, error: "boom" });
    const sent = await flushQueue(USER);
    expect(sent).toBe(0);
    expect(await readQueue()).toEqual(events);
  });

  it("throttles to once per FLUSH_INTERVAL_MS", async () => {
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("a", 1)]));
    appendMock.mockResolvedValue({ ok: true, data: { appended: 1 } });
    const first = await flushQueue(USER);
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("b", 2)]));
    const second = await flushQueue(USER);
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(appendMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchRemoteEvents", () => {
  it("returns [] when userId is null", async () => {
    expect(await fetchRemoteEvents(null)).toEqual([]);
  });

  it("decodes server rows into typed events", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      data: {
        events: [
          {
            type: "view",
            product_id: "a",
            category_id: "shirts",
            metadata: {
              t: 100,
              dwellMs: 500,
              product: {
                id: "a",
                category_id: "shirts",
                brand_id: "b1",
                store_id: "s1",
                material: "cotton",
                gender: "unisex",
                price: 50,
                colors: ["black"],
                tags: ["casual"],
              },
            },
            occurred_at: new Date(100).toISOString(),
          },
          {
            type: "search",
            metadata: {
              t: 200,
              query: "red shoes",
              tokens: ["red", "shoes"],
              resultCount: 4,
            },
            occurred_at: new Date(200).toISOString(),
          },
        ],
      },
    });
    const events = await fetchRemoteEvents(USER);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("view");
    expect((events[0] as any).product.id).toBe("a");
    expect(events[1].type).toBe("search");
  });

  it("returns [] on backend error", async () => {
    fetchMock.mockResolvedValue({ ok: false, error: "offline" });
    expect(await fetchRemoteEvents(USER)).toEqual([]);
  });

  it("returns [] on non-array events payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      data: { events: { not: "an array" } },
    });
    expect(await fetchRemoteEvents(USER)).toEqual([]);
  });
});

describe("clearRemoteEvents", () => {
  it("calls clearEventsBackend and wipes the local queue", async () => {
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("a", 1)]));
    clearMock.mockResolvedValue({ ok: true, data: { ok: true } });
    await clearRemoteEvents(USER);
    expect(clearMock).toHaveBeenCalled();
    expect(await readQueue()).toEqual([]);
  });

  it("is a no-op for guest users", async () => {
    await clearRemoteEvents(null);
    expect(clearMock).not.toHaveBeenCalled();
  });
});
