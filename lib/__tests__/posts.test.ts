import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { notePostCartAdd, rememberPostProduct, setPostCartReporter } from "@/lib/posts/attribution";
import { POST_LIMITS } from "@/lib/posts/limits";

describe("post → cart attribution", () => {
  const reporter = vi.fn();
  beforeEach(() => { reporter.mockReset(); setPostCartReporter(reporter); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("credits the post once when the tapped product is added to cart", () => {
    rememberPostProduct("post-1", "prod-1", "viewer");
    notePostCartAdd("prod-1");
    notePostCartAdd("prod-1");
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith("post-1", "prod-1", "viewer");
  });

  it("ignores products not opened from a post, and taps older than 30 min", () => {
    notePostCartAdd("other");
    rememberPostProduct("post-2", "prod-2", "store");
    vi.advanceTimersByTime(31 * 60 * 1000);
    notePostCartAdd("prod-2");
    expect(reporter).not.toHaveBeenCalled();
  });
});

describe("posts limits mirror", () => {
  it("is identical to the backend copy", () => {
    const mobile = readFileSync(resolve(__dirname, "../posts/limits.ts"), "utf8");
    const backend = readFileSync(resolve(__dirname, "../../../store-backend/src/modules/posts/limits.ts"), "utf8");
    expect(mobile).toBe(backend);
  });

  it("matches the DB triggers", () => {
    expect(POST_LIMITS.mediaMax).toBe(10);
    expect(POST_LIMITS.tagsMax).toBe(10);
    expect(POST_LIMITS.postsPerDay).toBe(10);
    expect(POST_LIMITS.pinsMax).toBe(3);
    expect(POST_LIMITS.videoMaxDurationMs).toBe(90_000);
  });
});
