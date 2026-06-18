import { describe, expect, it } from "vitest";
import { buildHubLastMilePendingQueue, buildPickupPendingQueue, isHubLastMilePending } from "../delivery-assignment-queues";

describe("delivery-assignment-queues (mobile)", () => {
  it("maps pickup warehouse name from API join", () => {
    const q = buildPickupPendingQueue(
      [
        {
          id: "o1",
          status: "confirmed",
          placed_at: "2024-01-01",
          pickup_warehouse: { id: "wh-1", name: "Colombo Hub" },
        },
      ],
      [],
    );
    expect(q[0]._warehouse?.name).toBe("Colombo Hub");
  });

  it("excludes hub rows already dispatched to last-mile", () => {
    const row = {
      order_id: "o1",
      status: "received",
      order: { id: "o1", status: "processing", delivery_person_id: "d1" },
    };
    expect(isHubLastMilePending(row)).toBe(false);
    expect(buildHubLastMilePendingQueue([row])).toHaveLength(0);
  });
});
