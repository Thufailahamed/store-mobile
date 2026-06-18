import { describe, it, expect } from "vitest";
import {
  assessWarehouseRoutingReadiness,
  canReceiveAtWarehouse,
  formatAssignmentSkipReason,
  getWarehouseCapacityStatus,
  isWarehouseGeocoded,
  resolveNearestWarehouse,
} from "../warehouse-routing";

describe("isWarehouseGeocoded", () => {
  it("returns true when lat/lng present", () => {
    expect(isWarehouseGeocoded({ latitude: 6.9, longitude: 79.8 })).toBe(true);
  });
  it("returns false when coordinates missing", () => {
    expect(isWarehouseGeocoded({ latitude: null, longitude: 79.8 })).toBe(false);
  });
});

describe("getWarehouseCapacityStatus", () => {
  it("reports full at capacity", () => {
    expect(getWarehouseCapacityStatus(500, 500)).toBe("full");
  });
  it("reports near_full at 90%+", () => {
    expect(getWarehouseCapacityStatus(450, 500)).toBe("near_full");
  });
  it("ignores zero capacity (unlimited)", () => {
    expect(getWarehouseCapacityStatus(999, 0)).toBe("ok");
  });
});

describe("canReceiveAtWarehouse", () => {
  it("blocks receive when full", () => {
    const r = canReceiveAtWarehouse(10, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/capacity/i);
  });
  it("allows receive under capacity", () => {
    expect(canReceiveAtWarehouse(5, 10).ok).toBe(true);
  });
});

describe("assessWarehouseRoutingReadiness", () => {
  const base = {
    id: "wh-1",
    is_active: true,
    latitude: 6.9,
    longitude: 79.8,
    capacity_max: 100,
  };

  it("marks hub routing-ready when geocoded with pickup drivers", () => {
    const r = assessWarehouseRoutingReadiness(base, { inventory_count: 10, pickup_driver_count: 2 });
    expect(r.routing_ready).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it("warns when not geocoded", () => {
    const r = assessWarehouseRoutingReadiness(
      { ...base, latitude: null, longitude: null },
      { inventory_count: 0, pickup_driver_count: 1 },
    );
    expect(r.routing_ready).toBe(false);
    expect(r.warnings.some((w) => w.includes("coordinates"))).toBe(true);
  });

  it("warns when no pickup drivers", () => {
    const r = assessWarehouseRoutingReadiness(base, { inventory_count: 0, pickup_driver_count: 0 });
    expect(r.routing_ready).toBe(false);
    expect(r.warnings.some((w) => w.includes("pickup drivers"))).toBe(true);
  });
});

describe("formatAssignmentSkipReason", () => {
  it("maps known skip codes", () => {
    expect(formatAssignmentSkipReason("no_warehouse_in_company")).toMatch(/active hub/i);
  });
  it("formats invalid_status prefix", () => {
    expect(formatAssignmentSkipReason("invalid_status:delivered")).toMatch(/delivered/i);
  });
});

describe("resolveNearestWarehouse", () => {
  it("picks closest geocoded hub", () => {
    const hubs = [
      { id: "a", is_active: true, latitude: 6.0, longitude: 80.0, created_at: "2024-01-01" },
      { id: "b", is_active: true, latitude: 6.91, longitude: 79.87, created_at: "2024-06-01" },
    ];
    expect(resolveNearestWarehouse(hubs, 6.915, 79.874)).toBe("b");
  });
});
