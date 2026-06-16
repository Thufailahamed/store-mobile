/**
 * mergeEventLogs tests.
 *
 * Pure function — no AsyncStorage or supabase mocks needed. The merge is
 * what lets a fresh install on a new device see the user's taste
 * immediately: the server's mirror is folded into the (possibly empty)
 * local log before the profile is built.
 */

import { describe, it, expect } from "vitest";
import { mergeEventLogs, buildProfile } from "../profile";
import type { RecommendationEvent } from "../events";

function view(id: string, t: number, category = "shirts", price = 100): RecommendationEvent {
  return {
    type: "view",
    t,
    dwellMs: 1000,
    product: {
      id,
      category_id: category,
      brand_id: "b1",
      store_id: "s1",
      material: "cotton",
      gender: "unisex",
      price,
      colors: ["black"],
      tags: ["casual"],
    },
  };
}

function search(query: string, t: number, tokens: string[]): RecommendationEvent {
  return { type: "search", t, query, tokens, resultCount: 5 };
}

describe("mergeEventLogs", () => {
  it("returns local when remote is empty", () => {
    const local = [view("a", 100)];
    expect(mergeEventLogs(local, [])).toBe(local);
  });

  it("returns remote when local is empty", () => {
    const remote = [view("a", 100)];
    expect(mergeEventLogs([], remote)).toBe(remote);
  });

  it("dedupes identical events (local wins)", () => {
    const local = [view("a", 100, "shirts", 100)];
    const remote = [view("a", 100, "shirts", 100)];
    const merged = mergeEventLogs(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(local[0]); // local copy preserved
  });

  it("keeps distinct events from both sides", () => {
    const local = [view("a", 100)];
    const remote = [view("b", 200)];
    const merged = mergeEventLogs(local, remote);
    expect(merged.map((e) => (e as { product: { id: string } }).product.id)).toEqual(
      expect.arrayContaining(["a", "b"]),
    );
    expect(merged).toHaveLength(2);
  });

  it("dedupes search events by t + query", () => {
    const local = [search("blue shirt", 100, ["blue", "shirt"])];
    const remote = [search("blue shirt", 100, ["blue", "shirt"])];
    expect(mergeEventLogs(local, remote)).toHaveLength(1);
  });

  it("treats different queries at the same t as distinct", () => {
    const local = [search("red shoes", 100, ["red", "shoes"])];
    const remote = [search("blue hat", 100, ["blue", "hat"])];
    expect(mergeEventLogs(local, remote)).toHaveLength(2);
  });

  it("does not cross-dedupe view vs wishlist for same product+t", () => {
    const local = [view("a", 100)];
    const remote: RecommendationEvent[] = [
      { type: "wishlist_add", t: 100, product: { id: "a", category_id: "shirts" } as any },
    ];
    expect(mergeEventLogs(local, remote)).toHaveLength(2);
  });

  it("order: local-first, then remote-only appends", () => {
    const local = [view("a", 100), view("b", 90)];
    const remote = [view("b", 90), view("c", 80)];
    const merged = mergeEventLogs(local, remote);
    const ids = merged.map((e) => (e as { product: { id: string } }).product.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("buildProfile over merged logs", () => {
  it("produces the same profile when local already covers the remote mirror", () => {
    const local = [view("a", 100), view("b", 90), view("c", 80)];
    const remote = [view("a", 100), view("b", 90)];
    const profileFromLocal = buildProfile(local, 200);
    const profileFromMerged = buildProfile(mergeEventLogs(local, remote), 200);
    expect(profileFromMerged.categories).toEqual(profileFromLocal.categories);
    expect(profileFromMerged.eventCount).toBe(profileFromLocal.eventCount);
  });

  it("gains signal from remote events the local log lacks", () => {
    const local = [view("a", 100)];
    const remote = [view("a", 100), view("b", 90), view("c", 80)];
    const profile = buildProfile(mergeEventLogs(local, remote), 200);
    expect(profile.eventCount).toBe(3);
    expect(profile.hasSignal).toBe(true);
  });
});
