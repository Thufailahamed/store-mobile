import { describe, expect, it } from "vitest";
import {
  BUYER_CANCEL_WINDOW_MS,
  canBuyerCancelInWindow,
  isTrackableStatus,
} from "@/lib/order-lifecycle";

describe("canBuyerCancelInWindow — mobile/web parity", () => {
  const now = 1_700_000_000_000; // fixed reference timestamp
  const recentPlaced = new Date(now - 30 * 60 * 1000).toISOString(); // 30 min ago
  const oldPlaced = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3 h ago
  const withinBoundaryPlaced = new Date(now - BUYER_CANCEL_WINDOW_MS).toISOString();

  it("allows pending orders inside the window", () => {
    expect(canBuyerCancelInWindow("pending", recentPlaced, now)).toBe(true);
  });

  it("allows confirmed orders inside the window", () => {
    expect(canBuyerCancelInWindow("confirmed", recentPlaced, now)).toBe(true);
  });

  it("rejects processing even inside the window (web parity)", () => {
    expect(canBuyerCancelInWindow("processing", recentPlaced, now)).toBe(false);
  });

  it("rejects pending once the 2-hour window has elapsed", () => {
    expect(canBuyerCancelInWindow("pending", oldPlaced, now)).toBe(false);
  });

  it("treats the boundary instant as inside the window", () => {
    expect(canBuyerCancelInWindow("pending", withinBoundaryPlaced, now)).toBe(true);
  });

  it("denies the cancel when placed_at is missing (fail closed)", () => {
    expect(canBuyerCancelInWindow("pending", null, now)).toBe(false);
    expect(canBuyerCancelInWindow("pending", undefined, now)).toBe(false);
  });

  it("denies the cancel when placed_at is unparseable (fail closed)", () => {
    expect(canBuyerCancelInWindow("pending", "not-a-date", now)).toBe(false);
  });

  it("rejects terminal statuses regardless of timing", () => {
    for (const status of [
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "returned",
      "refunded",
      "failed_attempt",
    ] as const) {
      expect(canBuyerCancelInWindow(status, recentPlaced, now), status).toBe(false);
    }
  });
});

describe("isTrackableStatus — mobile/web parity", () => {
  it("only returns true for shipped and out_for_delivery", () => {
    expect(isTrackableStatus("shipped")).toBe(true);
    expect(isTrackableStatus("out_for_delivery")).toBe(true);
  });

  it("returns false for pre-shipment statuses", () => {
    expect(isTrackableStatus("pending")).toBe(false);
    expect(isTrackableStatus("confirmed")).toBe(false);
    expect(isTrackableStatus("processing")).toBe(false);
  });

  it("returns false for terminal statuses", () => {
    expect(isTrackableStatus("delivered")).toBe(false);
    expect(isTrackableStatus("cancelled")).toBe(false);
    expect(isTrackableStatus("returned")).toBe(false);
    expect(isTrackableStatus("refunded")).toBe(false);
    expect(isTrackableStatus("failed_attempt")).toBe(false);
  });
});