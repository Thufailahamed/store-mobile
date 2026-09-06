import { describe, it, expect } from "vitest";
import {
  countReturnsByStatus,
  filterSellerReturns,
  formatReturnStatusLabel,
  mapSellerReturnRow,
  returnRefundAmount,
} from "@/lib/returns/seller-list";

const liveRow = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  return_group_id: "grp-1",
  order_item_id: "oi-1",
  user_id: "u-1",
  reason: "Size too large",
  description: null,
  photos: [],
  status: "requested",
  refund_amount: 12500,
  seller_note: null,
  received_at: null,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  order: { order_number: "LX-20260801-ABCDE", total: 40000, currency: "LKR" },
  product_name: "Tom Ford Private Blend Oud Wood 50ml",
  variant_label: "50ml · Smoked Grey",
  customer_name: "Asha Perera",
};

describe("mapSellerReturnRow", () => {
  it("reads the live GET /api/seller/returns shape", () => {
    const row = mapSellerReturnRow(liveRow);
    expect(row.id).toBe(liveRow.id);
    expect(row.return_group_id).toBe("grp-1");
    expect(row.order_number).toBe("LX-20260801-ABCDE");
    expect(row.buyer_name).toBe("Asha Perera");
    expect(row.product_name).toBe("Tom Ford Private Blend Oud Wood 50ml");
    expect(row.variant_label).toBe("50ml · Smoked Grey");
    expect(row.reason).toBe("Size too large");
    expect(row.refund_amount).toBe(12500);
    expect(row.currency).toBe("LKR");
    expect(row.items[0]?.product_name).toBe("Tom Ford Private Blend Oud Wood 50ml");
  });

  it("does not treat order total as the refund when refund_amount is missing", () => {
    const row = mapSellerReturnRow({
      ...liveRow,
      refund_amount: null,
    });
    expect(row.refund_amount).toBeNull();
    expect(returnRefundAmount(row)).toBeNull();
  });

  it("does not invent a buyer name", () => {
    const row = mapSellerReturnRow({
      ...liveRow,
      customer_name: undefined,
      order: { order_number: "LX-1", total: 10, currency: "LKR" },
    });
    expect(row.buyer_name).toBeNull();
  });
});

describe("formatReturnStatusLabel", () => {
  it("uses atelier labels", () => {
    expect(formatReturnStatusLabel("requested")).toBe("Requested");
    expect(formatReturnStatusLabel("approved")).toBe("Approved");
    expect(formatReturnStatusLabel("received")).toBe("Received");
    expect(formatReturnStatusLabel("refunded")).toBe("Refunded");
    expect(formatReturnStatusLabel("rejected")).toBe("Rejected");
  });
});

describe("filter + counts", () => {
  const rows = [
    mapSellerReturnRow(liveRow),
    mapSellerReturnRow({ ...liveRow, id: "r2", status: "approved", customer_name: "Nimal" }),
    mapSellerReturnRow({ ...liveRow, id: "r3", status: "refunded", refund_amount: 800 }),
  ];

  it("counts from the full list, not the active tab", () => {
    expect(countReturnsByStatus(rows)).toEqual({
      all: 3,
      requested: 1,
      approved: 1,
      received: 0,
      refunded: 1,
      rejected: 0,
    });
  });

  it("filters by status and search", () => {
    expect(filterSellerReturns(rows, { status: "requested" })).toHaveLength(1);
    expect(filterSellerReturns(rows, { search: "nimal" })[0]?.buyer_name).toBe("Nimal");
    expect(filterSellerReturns(rows, { search: "LX-20260801-ABCDE" })).toHaveLength(3);
    expect(filterSellerReturns(rows, { search: "oud wood" })).toHaveLength(3);
  });
});
