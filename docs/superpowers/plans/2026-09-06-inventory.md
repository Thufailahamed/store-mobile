# Inventory Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `app/(brand)/more/inventory.tsx` as status-first grouped cards with search/sort/filter plus inline stepper and edit sheet wired to `updateVariantStock`.

**Architecture:** Pure helpers in `lib/brand-inventory.ts` hold all grouping/filter/sort/threshold math (fully unit-tested); three small components (`InventoryVariantCard`, `InventoryGroupCard`, `StockEditSheet`) render via existing `Card`, `QtyStepper`, `Badge`, `ProgressBar`, `Input`, `Modal`; screen owns `useQuery(["brand-inventory"])` + `useMutation` with optimistic patch and rollback.

**Tech Stack:** Expo ~52.0.46, React 18.3.1, React Native 0.76.9, `@tanstack/react-query` v5, `vitest`, existing theme tokens in `lib/theme/tokens.ts`.

## Global Constraints

- Thresholds come from `LOW_STOCK_THRESHOLD = 5` in `lib/inventory.ts` — out is available ≤ 0, low is 1–5, healthy is > 5.
- Available = `(inventory.quantity ?? 0) - (inventory.reserved ?? 0)`, clamped ≥ 0.
- Reuse `Card`, `BrandStatCard`, `FilterChips`, `EmptyState`, `Skeleton`, `QtyStepper`, `ProgressBar`, `Input`, `useToast` — no new dependencies.
- Update path is `updateVariantStock(productId, variantId, quantity)` from `@/lib/api` (PATCH `/api/seller/products/:id/inventory`); optimistic `quantity = reserved + newAvailable`.
- Stepper/sheet clamp 0–9999 integers; disable controls while a mutation is pending for that variant; hide edit controls when `product.id` is missing.
- Follow `docs/superpowers/specs/2026-09-06-inventory-design.md` — no images, no bulk edit, no backend change.

---

### Task 1: Pure inventory helpers + unit tests

**Files:**
- Create: `lib/brand-inventory.ts`
- Test: `lib/__tests__/brand-inventory.test.ts`

**Interfaces:**
- Consumes: `BrandInventoryRow` from `@/lib/api/backend`, `LOW_STOCK_THRESHOLD` from `@/lib/inventory`
- Produces: `getAvailable(row) => number`, `getStatus(available) => "out" | "low" | "healthy"`, `groupByProduct(rows) => InventoryGroup[]`, `filterRows(rows, filter, query) => BrandInventoryRow[]`, `sortRows(rows, sort) => BrandInventoryRow[]`, `buildOptimisticQuantity(row, newAvailable) => number`, `parseStockInput(text) => number | null` — used by Tasks 2–4

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/brand-inventory.test.ts
import { describe, it, expect } from "vitest";
import {
  getAvailable,
  getStatus,
  groupByProduct,
  filterRows,
  sortRows,
  buildOptimisticQuantity,
  parseStockInput,
} from "@/lib/brand-inventory";
import type { BrandInventoryRow } from "@/lib/api/backend";

const row = (over: Partial<BrandInventoryRow> & { q?: number; r?: number }): BrandInventoryRow => ({
  id: over.id ?? "v1",
  sku: over.sku ?? "SKU-1",
  size: over.size ?? "M",
  color: over.color ?? "White",
  price: 8500,
  product: { id: "p1", name: "Linen Shirt", status: "active" },
  inventory: { quantity: over.q ?? 10, reserved: over.r ?? 2 },
});

describe("brand-inventory helpers", () => {
  it("computes available as quantity minus reserved, clamped at 0", () => {
    expect(getAvailable(row({ q: 10, r: 3 }))).toBe(7);
    expect(getAvailable(row({ q: 2, r: 5 }))).toBe(0);
    expect(getAvailable({ ...row({}), inventory: null })).toBe(0);
  });

  it("maps thresholds 0=out, 5=low, 6=healthy", () => {
    expect(getStatus(0)).toBe("out");
    expect(getStatus(5)).toBe("low");
    expect(getStatus(6)).toBe("healthy");
  });

  it("groups rows by product", () => {
    const a = row({ id: "v1" });
    const b = { ...row({ id: "v2" }), inventory: { quantity: 0, reserved: 0 } };
    const groups = groupByProduct([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].worst).toBe("out");
  });

  it("filters by status and search query", () => {
    const healthy = row({ id: "v1", q: 20, r: 0 });
    const out = { ...row({ id: "v2", sku: "LS-WHT-M" }), inventory: { quantity: 0, reserved: 0 } };
    expect(filterRows([healthy, out], "out", "")).toHaveLength(1);
    expect(filterRows([healthy, out], "all", "ls-wht-m")).toHaveLength(1);
    expect(filterRows([healthy, out], "all", "linen")).toHaveLength(2);
  });

  it("sorts by urgency, lowest, name", () => {
    const h = row({ id: "vh", q: 20, r: 0 });
    const l = { ...row({ id: "vl" }), inventory: { quantity: 3, reserved: 0 } };
    const o = { ...row({ id: "vo" }), inventory: { quantity: 0, reserved: 0 } };
    expect(sortRows([h, l, o], "urgency").map((r) => r.id)).toEqual(["vo", "vl", "vh"]);
    expect(sortRows([h, l, o], "lowest").map((r) => r.id)).toEqual(["vo", "vl", "vh"]);
  });

  it("builds optimistic quantity as reserved + available", () => {
    expect(buildOptimisticQuantity(row({ q: 10, r: 2 }), 5)).toBe(7);
  });

  it("parses sheet input strictly 0-9999", () => {
    expect(parseStockInput("42")).toBe(42);
    expect(parseStockInput(" 7 ")).toBe(7);
    expect(parseStockInput("")).toBeNull();
    expect(parseStockInput("4.5")).toBeNull();
    expect(parseStockInput("-1")).toBeNull();
    expect(parseStockInput("10000")).toBeNull();
    expect(parseStockInput("abc")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/brand-inventory.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/brand-inventory"

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/brand-inventory.ts
import type { BrandInventoryRow } from "@/lib/api/backend";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";

export type StockStatus = "out" | "low" | "healthy";
export type StockFilter = "all" | "low" | "out" | "healthy";
export type StockSort = "urgency" | "lowest" | "name";

export function getAvailable(row: BrandInventoryRow): number {
  const q = row.inventory?.quantity ?? 0;
  const r = row.inventory?.reserved ?? 0;
  return Math.max(0, q - r);
}

export function getStatus(available: number): StockStatus {
  if (available <= 0) return "out";
  if (available <= LOW_STOCK_THRESHOLD) return "low";
  return "healthy";
}

export type InventoryGroup = {
  key: string;
  productName: string;
  rows: BrandInventoryRow[];
  worst: StockStatus;
};

const RANK: Record<StockStatus, number> = { out: 0, low: 1, healthy: 2 };

export function groupByProduct(rows: BrandInventoryRow[]): InventoryGroup[] {
  const map = new Map<string, InventoryGroup>();
  for (const r of rows) {
    const name = r.product?.name?.trim() || "Uncategorized";
    const key = r.product?.id ?? `name:${name}`;
    const g = map.get(key) ?? { key, productName: name, rows: [], worst: "healthy" as StockStatus };
    g.rows.push(r);
    map.set(key, g);
  }
  for (const g of map.values()) {
    let worst: StockStatus = "healthy";
    for (const r of g.rows) {
      const s = getStatus(getAvailable(r));
      if (RANK[s] < RANK[worst]) worst = s;
    }
    g.worst = worst;
  }
  return [...map.values()];
}

export function filterRows(rows: BrandInventoryRow[], filter: StockFilter, query: string): BrandInventoryRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    const avail = getAvailable(r);
    const s = getStatus(avail);
    if (filter !== "all" && s !== filter) return false;
    if (!q) return true;
    const hay = `${r.product?.name ?? ""} ${r.sku ?? ""} ${r.size ?? ""} ${r.color ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function sortRows(rows: BrandInventoryRow[], sort: StockSort): BrandInventoryRow[] {
  const copy = [...rows];
  if (sort === "name") {
    return copy.sort((a, b) => (a.product?.name ?? "").localeCompare(b.product?.name ?? "") || (a.sku ?? "").localeCompare(b.sku ?? ""));
  }
  if (sort === "lowest") {
    return copy.sort((a, b) => getAvailable(a) - getAvailable(b));
  }
  return copy.sort((a, b) => RANK[getStatus(getAvailable(a))] - RANK[getStatus(getAvailable(b))] || getAvailable(a) - getAvailable(b));
}

export function buildOptimisticQuantity(row: BrandInventoryRow, newAvailable: number): number {
  const reserved = Math.max(0, row.inventory?.reserved ?? 0);
  return reserved + Math.max(0, Math.min(9999, Math.floor(newAvailable)));
}

export function parseStockInput(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return null;
  return n;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/brand-inventory.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/brand-inventory.ts lib/__tests__/brand-inventory.test.ts
git commit -m "feat: add brand inventory grouping and filter helpers"
```

---

### Task 2: Status variant card component

**Files:**
- Create: `components/brand/InventoryVariantCard.tsx`
- Modify: none
- Test: manual via typecheck (helpers already tested in Task 1)

**Interfaces:**
- Consumes: `getAvailable`, `getStatus` from Task 1; `Card` from `@/components/ui/Card`; `QtyStepper` from `@/components/ui`; `ProgressBar` from `@/components/ui`; `formatPrice` from `@/lib/utils`; tokens from `@/lib/theme/tokens`
- Produces: `InventoryVariantCard({ row, pending, onStep, onEdit })` — used by Task 4 group list. Props: `row: BrandInventoryRow`, `pending: boolean`, `onStep: (nextAvailable: number) => void`, `onEdit: () => void`

- [ ] **Step 1: Write the component**

```tsx
// components/brand/InventoryVariantCard.tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Card } from "@/components/ui/Card";
import { QtyStepper } from "@/components/ui";
import { ProgressBar } from "@/components/ui";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { getAvailable, getStatus } from "@/lib/brand-inventory";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

interface Props {
  row: BrandInventoryRow;
  pending?: boolean;
  onStep: (nextAvailable: number) => void;
  onEdit: () => void;
}

const TONE: Record<string, string> = {
  out: colors.light.destructive,
  low: colors.accent2.ochre,
  healthy: colors.olive[500],
};

export function InventoryVariantCard({ row, pending, onStep, onEdit }: Props) {
  const avail = getAvailable(row);
  const status = getStatus(avail);
  const tone = TONE[status];
  const reserved = Math.max(0, row.inventory?.reserved ?? 0);
  const canEdit = !!row.product?.id;
  const label = status === "out" ? `OUT • ${avail}` : status === "low" ? `LOW • ${avail}` : `HEALTHY • ${avail}`;
  return (
    <Card style={[styles.card, { borderLeftColor: tone, borderLeftWidth: 4 }]}>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: tone }]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
        <Text style={styles.res}>Res {reserved}</Text>
      </View>
      <Text style={styles.variant} numberOfLines={1}>
        {[row.color, row.size].filter(Boolean).join(" / ") || "Standard"} • SKU {row.sku ?? "—"}
      </Text>
      <Text style={styles.price}>{formatPrice(row.price, "LKR")}</Text>
      <ProgressBar value={Math.min(100, (avail / 20) * 100)} fillColor={tone} style={styles.bar} />
      <View style={styles.bottom}>
        {canEdit ? (
          <QtyStepper value={avail} min={0} max={9999} size="sm" disabled={pending} onChange={onStep} />
        ) : (
          <Text style={styles.res}>{avail} in stock</Text>
        )}
        {canEdit ? (
          <Pressable accessibilityRole="button" accessibilityLabel={status === "out" ? "Restock" : "Edit stock"} disabled={pending} onPress={onEdit} style={[styles.edit, pending && { opacity: 0.5 }]}>
            <Text style={styles.editText}>{status === "out" ? "Restock" : "Edit"}</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 6, marginBottom: 8 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: "#fff", letterSpacing: typography.letterSpacing.wide },
  res: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  variant: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  price: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  bar: { marginTop: 4 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  edit: { backgroundColor: colors.light.primary, borderRadius: radii.full, paddingHorizontal: 16, paddingVertical: 8 },
  editText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.primaryForeground },
});
```

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS with no errors in `InventoryVariantCard.tsx` (pre-existing repo errors, if any, must be unrelated — confirm by checking output mentions only other files)

- [ ] **Step 3: Commit**

```bash
git add components/brand/InventoryVariantCard.tsx
git commit -m "feat: add status-first inventory variant card"
```

---

### Task 3: Product group card + stock edit sheet

**Files:**
- Create: `components/brand/InventoryGroupCard.tsx`
- Create: `components/brand/StockEditSheet.tsx`

**Interfaces:**
- Consumes: `InventoryGroup` from Task 1; `InventoryVariantCard` from Task 2; `Modal` from `react-native`; `Input` from `@/components/ui`; `parseStockInput` from Task 1
- Produces: `InventoryGroupCard({ group, pendingId, onStep, onEdit })`, `StockEditSheet({ visible, row, saving, error, onClose, onSave })` — used by Task 4

- [ ] **Step 1: Write the group card**

```tsx
// components/brand/InventoryGroupCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { InventoryGroup } from "@/lib/brand-inventory";
import { InventoryVariantCard } from "./InventoryVariantCard";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  group: InventoryGroup;
  pendingId?: string | null;
  onStep: (row: BrandInventoryRow, next: number) => void;
  onEdit: (row: BrandInventoryRow) => void;
}

export function InventoryGroupCard({ group, pendingId, onStep, onEdit }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>{group.productName}</Text>
        <Text style={styles.count}>{group.rows.length} variant{group.rows.length === 1 ? "" : "s"}</Text>
      </View>
      {group.rows.map((r) => (
        <InventoryVariantCard key={r.id} row={r} pending={pendingId === r.id} onStep={(n) => onStep(r, n)} onEdit={() => onEdit(r)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
});
```

- [ ] **Step 2: Write the edit sheet**

```tsx
// components/brand/StockEditSheet.tsx
import React from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { Input } from "@/components/ui";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { getAvailable, parseStockInput } from "@/lib/brand-inventory";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  visible: boolean;
  row: BrandInventoryRow | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (nextAvailable: number) => void;
}

export function StockEditSheet({ visible, row, saving, error, onClose, onSave }: Props) {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    if (row) setText(String(getAvailable(row)));
  }, [row?.id]);
  const parsed = parseStockInput(text);
  const valid = parsed !== null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{row?.product?.name ?? "Update stock"}</Text>
        <Text style={styles.sub}>SKU {row?.sku ?? "—"} • Reserved {Math.max(0, row?.inventory?.reserved ?? 0)}</Text>
        <Input label="Available stock" keyboardType="numeric" value={text} onChangeText={setText} error={text.length > 0 && !valid ? "Enter 0–9999" : undefined} />
        <View style={styles.presets}>
          {[5, 10, 20].map((n) => (
            <Pressable key={n} onPress={() => setText(String(n))} style={styles.preset}>
              <Text style={styles.presetText}>+{n}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setText("0")} style={styles.preset}>
            <Text style={styles.presetText}>Set 0</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={onClose} disabled={saving} style={[styles.btn, styles.cancel]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable disabled={!valid || saving} onPress={() => parsed !== null && onSave(parsed)} style={[styles.btn, styles.save, (!valid || saving) && { opacity: 0.5 }]}>
            <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 12 },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  sub: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  presets: { flexDirection: "row", gap: 8 },
  preset: { borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 8 },
  presetText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  err: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: radii.lg, paddingVertical: 14, alignItems: "center" },
  cancel: { borderWidth: 1, borderColor: colors.light.border },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  save: { backgroundColor: colors.light.primary },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.primaryForeground },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS for the two new files

- [ ] **Step 4: Commit**

```bash
git add components/brand/InventoryGroupCard.tsx components/brand/StockEditSheet.tsx
git commit -m "feat: add inventory group card and stock edit sheet"
```

---

### Task 4: Screen rewrite with search, mutation, optimistic update

**Files:**
- Modify: `app/(brand)/more/inventory.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–3; `getBrandInventory`, `updateVariantStock` from `@/lib/api`; `useToast` from `@/components/ui`; `BrandScreenHeader`, `BrandStatCard`, `FilterChips` (existing)

- [ ] **Step 1: Rewrite the screen**

Replace `app/(brand)/more/inventory.tsx` with:

```tsx
import React from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandStatCard } from "@/components/brand/BrandStatCard";
import { FilterChips } from "@/components/brand/FilterChips";
import { InventoryGroupCard } from "@/components/brand/InventoryGroupCard";
import { StockEditSheet } from "@/components/brand/StockEditSheet";
import { Input, EmptyState, Skeleton, useToast } from "@/components/ui";
import { getBrandInventory, updateVariantStock } from "@/lib/api";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { getAvailable, getStatus, groupByProduct, filterRows, sortRows, buildOptimisticQuantity } from "@/lib/brand-inventory";
import type { StockFilter, StockSort } from "@/lib/brand-inventory";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const FILTERS: ReadonlyArray<{ value: StockFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
  { value: "healthy", label: "Healthy" },
];
const SORTS: ReadonlyArray<{ value: StockSort; label: string }> = [
  { value: "urgency", label: "Urgency" },
  { value: "lowest", label: "Lowest" },
  { value: "name", label: "Name" },
];

export default function BrandInventory() {
  const [filter, setFilter] = React.useState<StockFilter>("all");
  const [sort, setSort] = React.useState<StockSort>("urgency");
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<BrandInventoryRow | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const q = useQuery({
    queryKey: ["brand-inventory"],
    queryFn: async () => {
      const r = await getBrandInventory();
      return r.ok ? r.data : [];
    },
  });

  const m = useMutation({
    mutationFn: async ({ row, next }: { row: BrandInventoryRow; next: number }) => {
      const productId = row.product?.id;
      if (!productId) throw new Error("Missing product id");
      const res = await updateVariantStock(productId, row.id, buildOptimisticQuantity(row, next));
      if (!res.ok) throw new Error(typeof res.error === "string" ? res.error : "Update failed");
    },
    onMutate: async ({ row, next }) => {
      await qc.cancelQueries({ queryKey: ["brand-inventory"] });
      const prev = qc.getQueryData<BrandInventoryRow[]>(["brand-inventory"]);
      qc.setQueryData<BrandInventoryRow[]>(["brand-inventory"], (old) =>
        (old ?? []).map((r) =>
          r.id === row.id ? { ...r, inventory: { quantity: buildOptimisticQuantity(r, next), reserved: r.inventory?.reserved ?? 0 } } : r,
        ),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["brand-inventory"], ctx.prev);
      const msg = err instanceof Error ? err.message : "Couldn't update — try again";
      setSaveError(msg);
      toast.error(msg);
    },
    onSuccess: (_d, vars) => {
      if (editing && vars.row.id === editing.id) setEditing(null);
      setSaveError(null);
      toast.success("Stock updated");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["brand-inventory"] });
    },
  });

  const rows = q.data ?? [];
  const counts = React.useMemo(() => {
    let healthy = 0, low = 0, out = 0;
    for (const r of rows) {
      const s = getStatus(getAvailable(r));
      if (s === "healthy") healthy += 1;
      else if (s === "low") low += 1;
      else out += 1;
    }
    return { total: rows.length, healthy, low, out };
  }, [rows]);

  const visible = React.useMemo(() => sortRows(filterRows(rows, filter, query), sort), [rows, filter, query, sort]);
  const groups = React.useMemo(() => groupByProduct(visible), [visible]);

  const submit = (row: BrandInventoryRow, next: number) => {
    setSaveError(null);
    m.mutate({ row, next });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
    >
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Inventory"
        subtitle={`${counts.total} SKUs • ${counts.low} low • ${counts.out} out`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : q.isError ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load inventory" description="Check your connection and try again." action={<Pressable onPress={() => q.refetch()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>} />
      ) : (
        <>
          <View style={styles.grid}>
            <BrandStatCard label="Total SKUs" value={counts.total} />
            <BrandStatCard label="Healthy" value={counts.healthy} tone="accent" />
            <BrandStatCard label="Low stock" value={counts.low} tone="warn" sub="≤5 left" />
            <BrandStatCard label="Out of stock" value={counts.out} tone="warn" />
          </View>
          <View style={styles.searchWrap}>
            <Input placeholder="Search product, SKU…" value={query} onChangeText={setQuery} />
            <View style={styles.sortRow}>
              {SORTS.map((s) => (
                <Pressable key={s.value} onPress={() => setSort(s.value)} style={[styles.sortPill, sort === s.value && styles.sortActive]}>
                  <Text style={[styles.sortText, sort === s.value && styles.sortTextActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <FilterChips
            value={filter}
            options={FILTERS.map((f) => ({
              value: f.value,
              label: f.value === "all" ? `All ${counts.total}` : f.value === "low" ? `Low ${counts.low}` : f.value === "out" ? `Out ${counts.out}` : `Healthy ${counts.healthy}`,
            }))}
            onChange={setFilter}
          />
          {visible.length === 0 ? (
            <EmptyState icon="layers-outline" title={rows.length === 0 ? "No inventory yet" : "No SKUs match"} description={rows.length === 0 ? undefined : "Try clearing search or filters."} />
          ) : (
            groups.map((g) => (
              <InventoryGroupCard key={g.key} group={g} pendingId={m.isPending ? m.variables?.row.id ?? null : null} onStep={submit} onEdit={(r) => { setSaveError(null); setEditing(r); }} />
            ))
          )}
        </>
      )}
      <StockEditSheet visible={!!editing} row={editing} saving={m.isPending} error={saveError} onClose={() => setEditing(null)} onSave={(n) => editing && submit(editing, n)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  skel: { height: 120, margin: 20, borderRadius: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  sortRow: { flexDirection: "row", gap: 8 },
  sortPill: { borderWidth: 1, borderColor: colors.light.border, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 },
  sortActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  sortText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  sortTextActive: { color: colors.light.primaryForeground },
  retry: { backgroundColor: colors.light.primary, borderRadius: 9999, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.primaryForeground },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS for `app/(brand)/more/inventory.tsx` and the three new components

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run lib/__tests__/brand-inventory.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/\(brand\)/more/inventory.tsx
git commit -m "feat: rebuild inventory screen with grouped status cards and stock editing"
```

---

### Task 5: Verification and cleanup

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run full relevant test suites**

Run: `npx vitest run lib/__tests__/inventory.test.ts lib/__tests__/brand-inventory.test.ts`
Expected: PASS (all suites green)

- [ ] **Step 2: Run typecheck and lint on touched files**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no new errors)

- [ ] **Step 3: Manual checklist (report results in PR)**

Verify on a phone-width emulator: search filters by name and SKU; filter chips show correct counts; sort Urgency puts out-of-stock first; stepper −/+ updates optimistically and toasts on success; airplane-mode edit rolls back with error toast; sheet rejects "4.5", "-1", "10000"; pull-to-refresh reloads; empty search shows "No SKUs match".

- [ ] **Step 4: Stop the brainstorm visual server**

Run: `scripts/stop-server.sh /Users/thufailahamed/Downloads/store-main/store-mobile/.superpowers/brainstorm/16269-1788726776/state`
Expected: server stopped (browser tab shows paused)
