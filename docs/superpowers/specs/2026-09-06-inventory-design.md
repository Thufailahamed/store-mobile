# Inventory Page Redesign — Mobile (Status-First Grouped)

Date: 2026-09-06
Status: Approved
File: `app/(brand)/more/inventory.tsx`

## 1. Problem
Current inventory page (`app/(brand)/more/inventory.tsx:29-81`) is a read-only flat list:
- 4 `BrandStatCard`s with hardcoded threshold (healthy >10, low 1-10, out ≤0) diverging from `LOW_STOCK_THRESHOLD=5` in `lib/inventory.ts:5`.
- Plain `Card` rows show name + "N in stock" + SKU/size/color/price in one meta row — hard to scan, no visual status.
- No search, sort, or grouping — painful past ~30 SKUs.
- No stock update — `updateVariantStockBackend` (`lib/api/backend.ts:1140`, PATCH `/api/seller/products/:id/inventory`) exists but is not wired to this screen.

## 2. Goal
Seller can easily view and update stock on mobile: scannable status, organized by product, fast inline edits with safe exact entry.

User decisions:
- Update UX: Both (inline stepper + edit sheet)
- Organization: Search + grouping
- Card emphasis: Status-first

## 3. Architecture
- Group `BrandInventoryRow[]` by `product.name` (fallback "Uncategorized"). Keep flat `filtered` for counts.
- Single source of thresholds from `lib/inventory.ts`: `LOW_STOCK_THRESHOLD=5`. Out: available ≤0, Low: 1-5, Healthy: >5.
- Available = `quantity - reserved` (matches existing `stockLevel` in `inventory.tsx:25`).
- Data: `useQuery(["brand-inventory"], getBrandInventory)` for list; `useMutation(updateVariantStock)` for edits.
- Client-side search (product name + SKU), filter (all/low/out/healthy with counts), sort (Urgency: out→low→healthy, Lowest first, Name A-Z).
- No backend change. No new navigation routes. Follow existing tokens (`lib/theme/tokens.ts`), `Card`, `BrandStatCard`, `FilterChips`, `EmptyState`, `Skeleton`.

Out of scope: product images (row type has no image URL), bulk edit, multi-warehouse breakdown, push alerts.

## 4. Components
- **InventoryHeader (sticky):** existing `BrandScreenHeader` + `SearchInput` (placeholder "Search product, SKU…", clear button) + sort selector + `FilterChips` with counts (e.g. "Low 6").
- **SummaryGrid:** 2x2 `BrandStatCard`s (Total, Healthy accent, Low warn, Out destructive) with `sub` hints (e.g. "≤5 left").
- **InventoryGroupCard:** product name + variant count + aggregate badge (worst status in group). Collapsible (default expanded for out/low groups, expanded for first 3 otherwise).
- **StatusVariantCard:** `Card` with left tone strip (4px, destructive/ochre/olive), top row status badge (`OUT • 0`, `LOW • 3`, `HEALTHY • 42`) + reserved (`Res 2`), variant line (size/color + SKU), price via `formatPrice`, stock bar (width = min(available/20,1)), bottom row stepper (− value +) + `Edit` / `Restock` button.
- **StockEditSheet:** bottom sheet with product/variant label, current available + reserved, numeric `TextInput` (integer), quick presets (+5/+10/+20, Set to 0), Save/Cancel. Validates 0-9999 integer.
- **States:** `Skeleton` list on load, `EmptyState` for no-match ("No SKUs match — clear search") vs no-data, pull-to-refresh, inline error with Retry.

## 5. Data flow
1. Query loads rows → derive `available`, `status`, groups, counts via `useMemo`.
2. Stepper tap → optimistic `setQueryData` patch (`quantity = reserved + newAvailable`), `mutate({productId, variantId, quantity})`.
3. Sheet Save → same mutation path with exact value.
4. On error → rollback to previous cache, toast "Couldn't update — try again". On success → toast "Stock updated", `invalidateQueries(["brand-inventory"])` on settle.
5. Disable stepper/sheet Save while mutation pending for that variant.

`productId` = `row.product.id`, `variantId` = `row.id` (matches `updateVariantStock(productId, variantId, stock)` in `lib/api/index.ts:1317`). If `product.id` is missing, hide stepper/sheet and show "—" (read-only row).

## 6. Error handling
- Clamp stepper 0-9999, ignore non-integers in sheet with inline message.
- Network fail → rollback + toast + keep sheet open on sheet-save fail, close on success.
- Missing inventory (`null`) → show "—" and allow set (quantity = entered value, reserved 0).

## 7. Testing
- Vitest: grouping by product, search filter (name/SKU), status filter counts, sort urgency, threshold boundaries (0=out, 5=low, 6=healthy), optimistic quantity math (`reserved + available`).
- Manual: 390px + large phone, light/dark tokens, keyboard avoidance in sheet, pull-to-refresh, empty search.

## 8. Mockups
Persisted in `.superpowers/brainstorm/16269-1788726776/content/inventory-approaches.html` and `inventory-detail.html`. Browser URL (session): `http://localhost:53360/?key=cdafc4301f6dc5b39adb3d9bb1831d4e5dbbfbab763136e8859e90064f8502e4`.
