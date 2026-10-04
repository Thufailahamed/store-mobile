import { describe, it, expect } from "vitest";
import {
  ORDER_STATUS_EDGES,
  isValidOrderStatusTransition,
} from "../order-lifecycle";

/**
 * Mobile mirror must agree with 0123_dc_state_machine_and_invites.sql,
 * which is the authoritative transition graph.
 *
 * 0123 removed the backward ('out_for_delivery','shipped') edge — "lifecycle
 * only flows forward" — and added two failed_attempt admin-override edges.
 * The mirror still carried the deleted edge and was missing the new ones,
 * so the seller app offered a transition the database rejects and could not
 * perform the rescues the database permits.
 */

describe("mobile order-lifecycle — parity with migration 0123", () => {
  it("has no backward out_for_delivery -> shipped edge", () => {
    expect(ORDER_STATUS_EDGES).not.toContainEqual(["out_for_delivery", "shipped"]);
    expect(isValidOrderStatusTransition("out_for_delivery", "shipped")).toBe(false);
  });

  it("keeps the forward out_for_delivery edges", () => {
    expect(isValidOrderStatusTransition("out_for_delivery", "delivered")).toBe(true);
    expect(isValidOrderStatusTransition("out_for_delivery", "returned")).toBe(true);
    expect(isValidOrderStatusTransition("out_for_delivery", "cancelled")).toBe(true);
  });

  it("allows the failed_attempt admin overrides that 0123 added", () => {
    expect(isValidOrderStatusTransition("failed_attempt", "shipped", true)).toBe(true);
    expect(isValidOrderStatusTransition("failed_attempt", "delivered", true)).toBe(true);
  });

  it("does not allow those overrides without the admin flag", () => {
    expect(isValidOrderStatusTransition("failed_attempt", "shipped", false)).toBe(false);
    expect(isValidOrderStatusTransition("failed_attempt", "delivered", false)).toBe(false);
  });

  it("keeps cancelled and refunded terminal", () => {
    expect(isValidOrderStatusTransition("cancelled", "confirmed", true)).toBe(false);
    expect(isValidOrderStatusTransition("refunded", "confirmed", true)).toBe(false);
  });

  it("keeps returned -> refunded as the only exit from returned", () => {
    expect(isValidOrderStatusTransition("returned", "refunded")).toBe(true);
    expect(isValidOrderStatusTransition("returned", "delivered")).toBe(false);
  });
});
