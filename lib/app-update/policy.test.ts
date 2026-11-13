import { describe, it, expect } from "vitest";
import {
  BANNER_SNOOZE_MS,
  compareVersions,
  parsePolicy,
  resolveStatus,
  safeStoreUrl,
  shouldBlock,
  shouldShowBanner,
  type AppVersionPolicy,
} from "./policy";

const policy: AppVersionPolicy = {
  platform: "ios",
  status: "ok",
  latest: "1.4.0",
  min_supported: "1.2.0",
  store_url: "https://apps.apple.com/app/id1",
  message: "",
};

describe("app-update policy", () => {
  it("compares numerically", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
  });

  it("derives status locally, ignoring a stale server status", () => {
    expect(resolveStatus({ ...policy, status: "update_required" }, "1.4.0")).toBe("ok");
    expect(resolveStatus(policy, "1.1.0")).toBe("update_required");
    expect(resolveStatus(policy, "1.3.0")).toBe("update_available");
    expect(resolveStatus(policy, "garbage")).toBe("ok");
  });

  it("blocks only below min_supported", () => {
    expect(shouldBlock(policy, "1.1.9")).toBe(true);
    expect(shouldBlock(policy, "1.2.0")).toBe(false);
    expect(shouldBlock(null, "0.0.1")).toBe(false);
  });

  it("banner: shows, snoozes for the same release, re-shows after snooze or new release", () => {
    const now = 1_000_000_000_000;
    expect(shouldShowBanner(policy, "1.3.0", null, now)).toBe(true);
    expect(shouldShowBanner(policy, "1.3.0", { latest: "1.4.0", at: now - 1000 }, now)).toBe(false);
    expect(shouldShowBanner(policy, "1.3.0", { latest: "1.4.0", at: now - BANNER_SNOOZE_MS }, now)).toBe(true);
    expect(shouldShowBanner(policy, "1.3.0", { latest: "1.3.5", at: now - 1000 }, now)).toBe(true);
    expect(shouldShowBanner(policy, "1.4.0", null, now)).toBe(false);
    expect(shouldShowBanner(policy, "1.1.0", null, now)).toBe(false); // blocking screen owns this case
  });

  it("only allows https store urls", () => {
    expect(safeStoreUrl("https://play.google.com/x")).toBe("https://play.google.com/x");
    expect(safeStoreUrl("javascript:alert(1)")).toBeNull();
    expect(safeStoreUrl("http://x.test")).toBeNull();
    expect(safeStoreUrl("")).toBeNull();
  });

  it("parsePolicy rejects malformed payloads", () => {
    expect(parsePolicy(null)).toBeNull();
    expect(parsePolicy({ platform: "web" })).toBeNull();
    expect(parsePolicy({ platform: "ios", latest: "x", min_supported: "1.0.0" })).toBeNull();
    expect(parsePolicy({ platform: "ios", latest: "1.0.0", min_supported: "1.0.0", status: "update_required" })?.status).toBe(
      "update_required",
    );
  });
});
