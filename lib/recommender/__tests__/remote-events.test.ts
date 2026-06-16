/**
 * Remote event sync tests.
 *
 * Mocks the supabase client and AsyncStorage so we can exercise the
 * offline queue, throttle, and dedupe behavior without a network or
 * real storage.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.mock factories are hoisted. We need a hoisted mock for the supabase rpc
// and a hoisted storage map so they are available before any imports run.
const { store, rpcMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const rpcMock = vi.fn();
  return { store, rpcMock };
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

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: rpcMock },
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
});

describe("enqueueRemoteEvent", () => {
  it("persists the event and triggers a flush", async () => {
    rpcMock.mockResolvedValue({ data: 1, error: null });
    enqueueRemoteEvent(USER, viewEvent("a", 1));
    await new Promise((r) => setTimeout(r, 10));
    expect(rpcMock).toHaveBeenCalled();
    expect(await readQueue()).toEqual([]);
  });

  it("is a no-op for guest users", async () => {
    enqueueRemoteEvent(null, viewEvent("a", 1));
    await new Promise((r) => setTimeout(r, 10));
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("flushQueue", () => {
  it("returns 0 when the queue is empty", async () => {
    expect(await flushQueue(USER)).toBe(0);
  });

  it("returns 0 for guest users", async () => {
    expect(await flushQueue(null)).toBe(0);
  });

  it("serializes events to rows and calls append_user_events", async () => {
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("a", 100)]));
    rpcMock.mockResolvedValue({ data: 1, error: null });
    const sent = await flushQueue(USER);
    expect(sent).toBe(1);
    expect(rpcMock).toHaveBeenCalledWith("append_user_events", {
      p_events: expect.arrayContaining([
        expect.objectContaining({
          t: 100,
          type: "view",
          product: expect.objectContaining({ id: "a" }),
        }),
      ]),
    });
    expect(await readQueue()).toEqual([]);
  });

  it("keeps the queue intact on RPC error", async () => {
    const events = [viewEvent("a", 100), viewEvent("b", 90)];
    store.set(QUEUE_KEY, JSON.stringify(events));
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const sent = await flushQueue(USER);
    expect(sent).toBe(0);
    expect(await readQueue()).toEqual(events);
  });

  it("throttles to once per FLUSH_INTERVAL_MS", async () => {
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("a", 1)]));
    rpcMock.mockResolvedValue({ data: 1, error: null });
    const first = await flushQueue(USER);
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("b", 2)]));
    const second = await flushQueue(USER);
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchRemoteEvents", () => {
  it("returns [] when userId is null", async () => {
    expect(await fetchRemoteEvents(null)).toEqual([]);
  });

  it("decodes server rows into typed events", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          clientId: "c1",
          t: 100,
          type: "view",
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
        {
          clientId: "c2",
          t: 200,
          type: "search",
          query: "red shoes",
          tokens: ["red", "shoes"],
          resultCount: 4,
        },
      ],
      error: null,
    });
    const events = await fetchRemoteEvents(USER);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("view");
    expect((events[0] as any).product.id).toBe("a");
    expect(events[1].type).toBe("search");
  });

  it("returns [] on RPC error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect(await fetchRemoteEvents(USER)).toEqual([]);
  });

  it("returns [] on non-array payload", async () => {
    rpcMock.mockResolvedValue({ data: { not: "an array" }, error: null });
    expect(await fetchRemoteEvents(USER)).toEqual([]);
  });
});

describe("clearRemoteEvents", () => {
  it("calls the server RPC and wipes the local queue", async () => {
    store.set(QUEUE_KEY, JSON.stringify([viewEvent("a", 1)]));
    rpcMock.mockResolvedValue({ data: 1, error: null });
    await clearRemoteEvents(USER);
    expect(rpcMock).toHaveBeenCalledWith("clear_user_events");
    expect(await readQueue()).toEqual([]);
  });

  it("is a no-op for guest users", async () => {
    await clearRemoteEvents(null);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
