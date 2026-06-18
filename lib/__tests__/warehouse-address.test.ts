import { describe, expect, it } from "vitest";
import { formatWarehouseAddress } from "../utils/warehouse-address";

describe("formatWarehouseAddress", () => {
  it("formats JSON address objects", () => {
    expect(formatWarehouseAddress({ line1: "12 Main St", city: "Colombo" })).toBe("12 Main St, Colombo");
  });
  it("returns string addresses as-is", () => {
    expect(formatWarehouseAddress("Warehouse lane")).toBe("Warehouse lane");
  });
});
