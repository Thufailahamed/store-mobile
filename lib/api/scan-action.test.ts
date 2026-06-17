import { describe, it, expect } from "vitest";
import { resolveScanAction } from "./scan-action";

describe("resolveScanAction", () => {
  it("collapses pickup:direct to pickup with direct decision", () => {
    expect(resolveScanAction("pickup:direct")).toEqual({
      bareAction: "pickup",
      pickupDecision: "direct",
    });
  });

  it("collapses pickup:transit_to_warehouse to pickup with transit decision", () => {
    expect(resolveScanAction("pickup:transit_to_warehouse")).toEqual({
      bareAction: "pickup",
      pickupDecision: "transit_to_warehouse",
    });
  });

  it("passes bare actions through unchanged", () => {
    expect(resolveScanAction("pickup")).toEqual({ bareAction: "pickup" });
    expect(resolveScanAction("receive")).toEqual({ bareAction: "receive" });
    expect(resolveScanAction("dispatch")).toEqual({ bareAction: "dispatch" });
    expect(resolveScanAction("start_delivery")).toEqual({ bareAction: "start_delivery" });
    expect(resolveScanAction("verify_otp")).toEqual({ bareAction: "verify_otp" });
    expect(resolveScanAction("verify_customer_qr")).toEqual({ bareAction: "verify_customer_qr" });
    expect(resolveScanAction("fail_delivery")).toEqual({ bareAction: "fail_delivery" });
    expect(resolveScanAction("pack")).toEqual({ bareAction: "pack" });
  });

  it("unknown action passes through with no decision", () => {
    expect(resolveScanAction("custom:weird:thing")).toEqual({ bareAction: "custom:weird:thing" });
  });
});
