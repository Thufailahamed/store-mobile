# Seller Inventory Restyle — Mobile (Status-First, Seller Theme)

Date: 2026-09-06
Status: Approved
File: `app/(seller)/inventory/index.tsx` (1222 lines today)

## 1. Problem
The seller inventory page is feature-complete (search, filter tabs with counts,
urgency sort, ledger stats, stepper, tap-to-edit inline input, quick restock,
bulk select + apply, CSV export, held-stock safety confirms, thumbnails,
on-hand value total, skeletons) but looks dated next to the new Brand HQ
inventory redesign (`app/(brand)/more/inventory.tsx`): flat rows, small status
pill, cramped tap-to-type inline editor, success/error via popup `Alert`s, and
all 1222 lines in a single file.

## 2. Goal
Same features, new status-first card look — grouped by product, tone strip +
badge + stock bar, bottom-sheet editor, toasts — in the seller gold/ink/cream
identity. No behavior changes, no backend changes.

User decisions:
- Direction: match new brand cards (Approach A — restyle in place)
- Scope: keep every seller extra working (thumbnails, bulk, CSV, quick
  restock, held-stock confirms, value total)
- Theme: keep seller gold/ink/cream chrome, not brand olive

## 3. Architecture
- Work inside `app/(seller)/inventory/index.tsx`; do NOT migrate to
  react-query (keep `getSellerStore` → `getSellerInventory` +
  `getSellerProducts` → `flattenRows` manual fetch; migration is behavior
  risk with no visible payoff).
- Extract 3 focused components (new files under `components/seller/`):
  `SellerStockCard`, `SellerProductGroup`, `SellerStockSheet`. Screen keeps
  state, fetching, and mutation logic.
- Reuse number-based helpers from `lib/brand-inventory.ts` (`getStatus`,
  `parseStockInput`) plus a small seller-rows `groupByProductId` for the
  local `InventoryRow` shape (which carries nullable `onHand`/`available` for
  unknown stock — thresholds: unknown → "—", 0 → out, 1–5 → low, >5 → ok,
  per existing `stockTone` + `LOW_STOCK_THRESHOLD`).
- Keep seller chrome: `SellerSearchField`, `SellerFilterTab`, ledger stats,
  `SELLER_GOLD/RUST/INK/CREAM` tokens.

Out of scope: react-query migration, shared brand+seller UI kit, bulk-flow
redesign, new backend fields, seller dashboard home (`app/(seller)/index.tsx`).

## 4. Components
- **Header (unchanged layout):** kicker/title/count (`N of M SKUs · On-hand
  VALUE`), select-mode + CSV icon buttons, gold rule, tappable ledger stats
  (Healthy/Low/Out), `SellerSearchField`, `SellerFilterTab`s with counts.
  Urgency sort stays (out → low → unknown → ok).
- **SellerProductGroup:** product thumbnail + name + variant count + worst-status
  badge; contains that product's variant cards.
- **SellerStockCard:** 4px left tone strip (rust/gold-olive per status),
  status badge (`OUT • 0` / `LOW • 3` / `IN STOCK • 42` / `—`), thumbnail,
  name, SKU, size · colour, price via `formatPrice`, `N held` when reserved >
  0, stock bar (width = min(available/20, 1)), bottom row stepper (− value +)
  + `Edit` / `Restock` button opening the sheet. In select mode the card shows
  the checkbox and tap toggles selection (long-press enters select mode, as
  today). Null-stock rows show `—` and hide editing.
- **SellerStockSheet:** bottom sheet (`Modal` pageSheet) with product/variant
  label, SKU + held count, numeric input (integer 0–9999, `parseStockInput`),
  presets (+5/+10/+20, Set 0), inline held-stock warning text when the entered
  value drops below reserved (replacing the pre-save Alert for single edits;
  the explicit confirm dialog STAYS as the consent gate), Save/Cancel.
- **Bulk bar + CSV:** unchanged behavior, restyled only if tokens demand it.

## 5. Data flow
1. Fetch + flatten exactly as today; `filtered` + `stats` + `totalValue`
   memos unchanged.
2. Stepper/sheet save → existing `confirmReservedStock` gate → existing
   optimistic `saveStock` + snapshot rollback (single) and
   `Promise.allSettled` + partial-fail refresh (bulk) unchanged.
3. Only change: success/failure `Alert.alert`s become `useToast` toasts
   ("Stock updated", "N SKU(s) updated", error toasts + rollback). The
   held-stock safety confirms REMAIN `Alert` dialogs — they require explicit
   destructive consent.
4. Pull-to-refresh, skeleton cards, empty/error states unchanged.

## 6. Error handling
- Sheet rejects non-integers and out-of-range (inline "Enter 0–9999");
  stepper clamps at 0; controls disabled while that variant is saving.
- Any save dropping on-hand below reserved must pass the confirm dialog
  first (single and bulk alike).
- Null-stock rows are read-only (`—`).
- Failed saves roll back to snapshot and toast the error; bulk partial
  failure offers refresh, as today.

## 7. Testing
- Vitest: seller grouping parity (rows grouped by productId, worst status
  bubbles up), filter/search parity, threshold boundaries (null → unknown,
  0 → out, 5 → low, 6 → ok), `parseStockInput` boundaries.
- `npx tsc --noEmit` clean for touched files.
- Manual: search (name/SKU/size/colour), chip counts, urgency order, stepper,
  sheet save + held-warning, quick restock, long-press select, bulk apply,
  CSV share, pull-to-refresh, empty search, error retry.

## 8. Mockups
Persisted in `.superpowers/brainstorm/20995-1788727355/content/seller-restyle.html`.
Browser URL (session): `http://localhost:55933/?key=c403a72d69bf91a28c03e802c2dbb06d1623c9d661fca4b69261b5d718990e9b`.
