# Seller Inventory Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `app/(seller)/inventory/index.tsx` into grouped status-first cards with bottom-sheet editing and toasts, keeping every feature and the seller gold/ink theme.

**Architecture:** Pure seller helpers in `lib/seller-inventory.ts` (status with unknown, group-by-product, bar percent) fully unit-tested; three focused components (`SellerStockCard`, `SellerProductGroup`, `SellerStockSheet`) under `components/seller/`; the screen keeps all fetching/mutation/bulk/CSV logic and only swaps its row rendering, edit UI, and success/error Alerts.

**Tech Stack:** Expo ~52.0.46, React 18.3.1, React Native 0.76.9, `expo-image`, `vitest`, existing seller chrome (`components/seller/chrome.tsx`), `useToast` from `@/components/ui`.

## Global Constraints

- Thresholds: unknown-stock (null) shows "—" read-only; available 0 is out, 1–5 is low, >5 is ok, per existing `stockTone` and `LOW_STOCK_THRESHOLD = 5` in `lib/inventory.ts`.
- Stock bar width is `min(available / 20, 1) * 100`; unknown renders an empty muted track.
- Tone colors stay in seller identity: out `SELLER_RUST`, low `#8a6a2a` on `rgba(200,164,74,0.18)`, ok `colors.olive[800]` on `rgba(83,94,44,0.1)`, unknown `colors.ink.mute`.
- Stepper/sheet clamp integers 0–9999 via `parseStockInput` from `@/lib/brand-inventory`; stepper − clamps at 0.
- Any save dropping on-hand below reserved must pass `confirmReservedStock` dialog first (single and bulk alike); held-stock confirms STAY as `Alert` dialogs.
- Success/failure `Alert.alert`s become `useToast` toasts; no new dependencies; no backend changes; no react-query migration.
- Follow `docs/superpowers/specs/2026-09-06-seller-inventory-design.md` — seller dashboard home is out of scope.

---

### Task 1: Seller inventory helpers + unit tests

**Files:**
- Create: `lib/seller-inventory.ts`
- Test: `lib/__tests__/seller-inventory.test.ts`

**Interfaces:**
- Consumes: `parseStockInput` from `@/lib/brand-inventory` (re-export, do not duplicate), `LOW_STOCK_THRESHOLD` from `@/lib/inventory`
- Produces: `SellerInventoryRow` (interface), `sellerStatus(available) => "out" | "low" | "ok" | "unknown"`, `groupSellerRows(rows) => SellerGroup[]`, `sellerBarPct(available) => number` — used by Tasks 2–4

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/seller-inventory.test.ts
import { describe, it, expect } from "vitest";
import { sellerStatus, groupSellerRows, sellerBarPct } from "@/lib/seller-inventory";
import type { SellerInventoryRow } from "@/lib/seller-inventory";

const row = (over: Partial<SellerInventoryRow>): SellerInventoryRow => ({
  productId: "p1",
  productName: "Linen Shirt",
  variantId: over.variantId ?? "v1",
  sku: "SKU-1",
  onHand: 10,
  reserved: 2,
  available: 8,
  price: 8500,
  currency: "LKR",
  ...over,
});

describe("seller-inventory helpers", () => {
  it("maps null to unknown, 0 to out, 5 to low, 6 to ok", () => {
    expect(sellerStatus(null)).toBe("unknown");
    expect(sellerStatus(0)).toBe("out");
    expect(sellerStatus(5)).toBe("low");
    expect(sellerStatus(6)).toBe("ok");
  });

  it("groups rows by productId with worst status first", () => {
    const groups = groupSellerRows([
      row({ variantId: "v1", available: 20 }),
      row({ variantId: "v2", available: 0 }),
      row({ variantId: "v3", productId: "p2", productName: "Tee", available: 3 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].worst).toBe("out");
    expect(groups[1].worst).toBe("low");
  });

  it("computes bar percent clamped 0-100, unknown is 0", () => {
    expect(sellerBarPct(10)).toBe(50);
    expect(sellerBarPct(40)).toBe(100);
    expect(sellerBarPct(0)).toBe(0);
    expect(sellerBarPct(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/seller-inventory.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/seller-inventory"

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/seller-inventory.ts
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";

export interface SellerInventoryRow {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size?: string;
  color?: string;
  onHand: number | null;
  reserved: number;
  available: number | null;
  price: number | null;
  currency: string;
  image?: string;
}

export type SellerStockStatus = "out" | "low" | "ok" | "unknown";

export function sellerStatus(available: number | null): SellerStockStatus {
  if (available == null) return "unknown";
  if (available <= 0) return "out";
  if (available <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export interface SellerGroup {
  key: string;
  productId: string;
  productName: string;
  image?: string;
  rows: SellerInventoryRow[];
  worst: SellerStockStatus;
}

const RANK: Record<SellerStockStatus, number> = { out: 0, low: 1, unknown: 2, ok: 3 };

export function groupSellerRows(rows: SellerInventoryRow[]): SellerGroup[] {
  const map = new Map<string, SellerGroup>();
  for (const r of rows) {
    const g = map.get(r.productId) ?? {
      key: r.productId,
      productId: r.productId,
      productName: r.productName,
      image: r.image,
      rows: [],
      worst: "ok" as SellerStockStatus,
    };
    if (!g.image && r.image) g.image = r.image;
    g.rows.push(r);
    map.set(r.productId, g);
  }
  for (const g of map.values()) {
    let worst: SellerStockStatus = "ok";
    for (const r of g.rows) {
      const s = sellerStatus(r.available);
      if (RANK[s] < RANK[worst]) worst = s;
    }
    g.worst = worst;
  }
  return [...map.values()];
}

export function sellerBarPct(available: number | null): number {
  if (available == null) return 0;
  return Math.max(0, Math.min(100, (available / 20) * 100));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/seller-inventory.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/seller-inventory.ts lib/__tests__/seller-inventory.test.ts
git commit -m "feat: add seller inventory grouping and status helpers"
```

---

### Task 2: Seller stock card component

**Files:**
- Create: `components/seller/SellerStockCard.tsx`
- Modify: none
- Test: typecheck (logic already tested in Task 1)

**Interfaces:**
- Consumes: `SellerInventoryRow`, `sellerStatus`, `sellerBarPct` from Task 1; `QtyStepper`, `ProgressBar` from `@/components/ui`; `Image` from `expo-image`; `SELLER_RUST` from `@/components/seller/chrome`; `formatPrice` from `@/lib/utils`
- Produces: `SellerStockCard({ row, selectMode, selected, saving, onToggleSelect, onLongPress, onOpenProduct, onStep, onEdit, onQuickRestock })` — used by Task 3. `onStep` receives the next on-hand value; the screen gates it through `confirmReservedStock`.

- [ ] **Step 1: Write the component**

```tsx
// components/seller/SellerStockCard.tsx
import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { QtyStepper, ProgressBar } from "@/components/ui";
import { SELLER_RUST, SELLER_INK, SELLER_CREAM } from "./chrome";
import type { SellerInventoryRow } from "@/lib/seller-inventory";
import { sellerStatus, sellerBarPct } from "@/lib/seller-inventory";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

interface Props {
  row: SellerInventoryRow;
  selectMode: boolean;
  selected: boolean;
  saving: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
  onOpenProduct: () => void;
  onStep: (nextOnHand: number) => void;
  onEdit: () => void;
  onQuickRestock: () => void;
}

export function toneMeta(status: ReturnType<typeof sellerStatus>) {
  if (status === "out") return { label: "Out", color: SELLER_RUST, bg: "rgba(184,92,58,0.12)" };
  if (status === "low") return { label: "Low", color: "#8a6a2a", bg: "rgba(200,164,74,0.18)" };
  if (status === "ok") return { label: "In stock", color: colors.olive[800], bg: "rgba(83,94,44,0.1)" };
  return { label: "—", color: colors.ink.mute, bg: colors.olive[50] };
}

export function SellerStockCard(props: Props) {
  const { row, selectMode, selected, saving } = props;
  const status = sellerStatus(row.available);
  const meta = toneMeta(status);
  const variantLabel = [row.size, row.color].filter(Boolean).join(" · ");
  const qty = row.onHand ?? row.available;
  const badge = status === "unknown" ? "—" : status === "out" ? `OUT • ${row.available}` : status === "low" ? `LOW • ${row.available}` : `IN STOCK • ${row.available}`;
  const canEdit = row.onHand != null || row.available != null;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={[styles.toneBar, { backgroundColor: meta.color }]} />
      <View style={styles.cardRow}>
        {selectMode && (
          <TouchableOpacity style={styles.checkbox} onPress={props.onToggleSelect} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
            <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.olive[700] : colors.light.mutedForeground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cardMain} onPress={selectMode ? props.onToggleSelect : props.onOpenProduct} onLongPress={props.onLongPress} delayLongPress={350} activeOpacity={0.75}>
          {row.image ? (
            <Image source={{ uri: row.image }} style={styles.thumb} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="image-outline" size={16} color={colors.light.mutedForeground} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                <Text style={[styles.badgeText, { color: meta.color }]}>{badge}</Text>
              </View>
              {row.reserved > 0 ? <Text style={styles.held}>{row.reserved} held</Text> : null}
            </View>
            <Text style={styles.cardSku} numberOfLines={1}>{row.sku}</Text>
            {variantLabel ? <Text style={styles.cardMeta}>{variantLabel}</Text> : null}
            <Text style={styles.cardPrice}>{row.price != null ? formatPrice(row.price, row.currency) : "—"}</Text>
          </View>
        </TouchableOpacity>
        {!selectMode && canEdit && (
          <View style={styles.stockPanel}>
            <ProgressBar value={sellerBarPct(row.available)} fillColor={meta.color} style={styles.bar} />
            {saving ? (
              <ActivityIndicator size="small" color={meta.color} />
            ) : (
              <QtyStepper value={row.onHand ?? 0} min={0} max={9999} size="sm" onChange={props.onStep} />
            )}
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={props.onEdit} disabled={saving} accessibilityLabel="Edit stock">
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              {status === "out" ? (
                <TouchableOpacity onPress={props.onQuickRestock} disabled={saving} accessibilityLabel="Quick restock to 10">
                  <Text style={styles.restockText}>+10</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
        {!selectMode && !canEdit && <Text style={styles.unknownQty}>—</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: SELLER_CREAM, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(83,94,44,0.12)", overflow: "hidden", marginBottom: 8 },
  cardSelected: { borderColor: colors.olive[700], borderWidth: 2 },
  toneBar: { height: 4 },
  cardRow: { flexDirection: "row", padding: 12, gap: 10 },
  checkbox: { justifyContent: "center" },
  cardMain: { flex: 1, flexDirection: "row", gap: 10, minWidth: 0 },
  thumb: { width: 56, height: 72, borderRadius: radii.md },
  thumbEmpty: { backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, minWidth: 0, gap: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  badgeText: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, letterSpacing: typography.letterSpacing.wide, textTransform: "uppercase" },
  held: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  cardSku: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  cardMeta: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  cardPrice: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  stockPanel: { justifyContent: "center", gap: 6, minWidth: 118 },
  bar: { marginBottom: 2 },
  cardActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  editText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: SELLER_INK },
  restockText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: SELLER_RUST },
  unknownQty: { alignSelf: "center", fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.lg, color: colors.ink.mute },
});
```

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SellerStockCard|seller-inventory" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 3: Commit**

```bash
git add components/seller/SellerStockCard.tsx
git commit -m "feat: add seller status-first stock card"
```

---

### Task 3: Product group + stock edit sheet

**Files:**
- Create: `components/seller/SellerProductGroup.tsx`
- Create: `components/seller/SellerStockSheet.tsx`

**Interfaces:**
- Consumes: `SellerGroup`, `SellerInventoryRow` from Task 1; `SellerStockCard` from Task 2; `parseStockInput` from `@/lib/brand-inventory`; `Modal` from `react-native`; `Input` from `@/components/ui`
- Produces: `SellerProductGroup({ group, ...cardProps })`, `SellerStockSheet({ visible, row, saving, onClose, onSave })` — used by Task 4. `onSave` receives the parsed available value; the screen runs `confirmReservedStock` then `saveStock`.

- [ ] **Step 1: Write the group component**

```tsx
// components/seller/SellerProductGroup.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { SellerGroup, SellerInventoryRow } from "@/lib/seller-inventory";
import { SellerStockCard } from "./SellerStockCard";
import { toneMeta } from "./SellerStockCard";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  group: SellerGroup;
  savingId: string | null;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onLongPress: (id: string) => void;
  onOpenProduct: (productId: string) => void;
  onStep: (row: SellerInventoryRow, nextOnHand: number) => void;
  onEdit: (row: SellerInventoryRow) => void;
  onQuickRestock: (row: SellerInventoryRow) => void;
}

export function SellerProductGroup(props: Props) {
  const { group } = props;
  const meta = toneMeta(group.worst);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {group.image ? (
          <Image source={{ uri: group.image }} style={styles.groupThumb} contentFit="cover" />
        ) : null}
        <Text style={styles.title} numberOfLines={1}>{group.productName}</Text>
        <View style={[styles.headBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.headBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.count}>{group.rows.length} variant{group.rows.length === 1 ? "" : "s"}</Text>
      </View>
      {group.rows.map((r) => (
        <SellerStockCard
          key={r.variantId}
          row={r}
          selectMode={props.selectMode}
          selected={props.selectedIds.has(r.variantId)}
          saving={props.savingId === r.variantId}
          onToggleSelect={() => props.onToggleSelect(r.variantId)}
          onLongPress={() => props.onLongPress(r.variantId)}
          onOpenProduct={() => props.onOpenProduct(r.productId)}
          onStep={(n) => props.onStep(r, n)}
          onEdit={() => props.onEdit(r)}
          onQuickRestock={() => props.onQuickRestock(r)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  groupThumb: { width: 28, height: 28, borderRadius: 14 },
  title: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  headBadge: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  headBadgeText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" },
});
```

- [ ] **Step 2: Write the sheet component**

```tsx
// components/seller/SellerStockSheet.tsx
import React from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { Input } from "@/components/ui";
import type { SellerInventoryRow } from "@/lib/seller-inventory";
import { parseStockInput } from "@/lib/brand-inventory";
import { SELLER_INK } from "./chrome";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  visible: boolean;
  row: SellerInventoryRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (nextOnHand: number) => void;
}

export function SellerStockSheet({ visible, row, saving, onClose, onSave }: Props) {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    if (row) setText(String(row.onHand ?? 0));
  }, [row?.variantId]);
  const parsed = parseStockInput(text);
  const valid = parsed !== null;
  const heldBreach = row && parsed !== null && parsed < row.reserved;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{row?.productName ?? "Update stock"}</Text>
        <Text style={styles.sub}>SKU {row?.sku ?? "—"} • {row?.reserved ?? 0} held in carts</Text>
        <Input label="On-hand stock" keyboardType="numeric" value={text} onChangeText={setText} error={text.length > 0 && !valid ? "Enter 0–9999" : undefined} />
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
        {heldBreach ? (
          <Text style={styles.warn}>{row?.reserved} units are held in carts. Saving will ask for confirmation.</Text>
        ) : null}
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
  warn: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: "#8a6a2a" },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: radii.lg, paddingVertical: 14, alignItems: "center" },
  cancel: { borderWidth: 1, borderColor: colors.light.border },
  cancelText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  save: { backgroundColor: SELLER_INK },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.paper.cream },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SellerProductGroup|SellerStockSheet|SellerStockCard" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 4: Commit**

```bash
git add components/seller/SellerProductGroup.tsx components/seller/SellerStockSheet.tsx
git commit -m "feat: add seller product group and stock edit sheet"
```

---

### Task 4: Screen rewire (groups, sheet, toasts)

**Files:**
- Modify: `app/(seller)/inventory/index.tsx`
  - Replace local `InventoryRow` interface (lines 48–61) with `import type { SellerInventoryRow as InventoryRow } from "@/lib/seller-inventory";`
  - Delete `renderRow` (lines 431–595), the `Thumb` helper (lines 109–118), and the `editing`/`draftStock` inline-edit state; add `sheetRow: InventoryRow | null` state
  - `FlatList` renders `SellerProductGroup` from `groupSellerRows(filtered)`; header, skeletons, empty states, bulk bar, CSV, refresh unchanged
  - Replace `Alert.alert("Done", ...)`, `Alert.alert("Partial", ...)` (keep its refresh), `Alert.alert("Error", ...)`, `Alert.alert("Nothing to export", ...)` with `useToast` toasts; held-stock confirms stay

**Interfaces:**
- Consumes: everything from Tasks 1–3; `useToast` from `@/components/ui`; existing `confirmReservedStock`, `saveStock`, `adjustStock`, `bulkApply`, `exportCSV`, `startEdit` (repointed to open the sheet)

- [ ] **Step 1: Swap imports and row type**

Replace lines 1–61 import/interface block additions:

```tsx
import { useToast } from "@/components/ui";
import { SellerProductGroup } from "@/components/seller/SellerProductGroup";
import { SellerStockSheet } from "@/components/seller/SellerStockSheet";
import type { SellerInventoryRow as InventoryRow } from "@/lib/seller-inventory";
import { groupSellerRows } from "@/lib/seller-inventory";
```

Delete the local `interface InventoryRow { ... }` block (lines 48–61). Everything else referencing `InventoryRow` keeps working via the import. Add inside the component next to the other `useState` calls:

```tsx
const { toast } = useToast();
const [sheetRow, setSheetRow] = React.useState<InventoryRow | null>(null);
```

- [ ] **Step 2: Replace save/error alerts with toasts**

In `saveStock`, replace `Alert.alert("Error", res.error);` with `toast.error(res.error);`. In `performBulkApply`, replace the success `Alert.alert("Done", ...)` with `toast.success(`${targets.length} SKU(s) updated to ${newStock}.`);` and the partial `Alert.alert("Partial", ..., [{ text: "OK", onPress: () => onRefresh() }])` with `toast.error(`${targets.length - failed.length} updated, ${failed.length} failed.`); onRefresh();`. In `exportCSV`, replace `Alert.alert("Nothing to export", ...)` with `toast.info("No rows match the current filters.");` and `Alert.alert("Error", ...)` in the catch with `toast.error(e?.message ?? "Could not share");`. Do NOT touch `confirmReservedStock` — its `Alert.alert` dialogs stay.

- [ ] **Step 3: Replace renderRow with grouped rendering**

Delete the entire `renderRow` function (lines 431–595) and the `Thumb` helper (lines 109–118). Replace the `FlatList` `data={filtered}` with grouped data and render:

```tsx
const groups = useMemo(() => groupSellerRows(filtered), [filtered]);
```

```tsx
<FlatList
  data={groups}
  keyExtractor={(item) => item.key}
  renderItem={({ item }) => (
    <SellerProductGroup
      group={item}
      savingId={savingId}
      selectMode={selectMode}
      selectedIds={selectedIds}
      onToggleSelect={toggleSelect}
      onLongPress={(id) => {
        if (!selectMode) {
          setSelectMode(true);
          setSelectedIds(new Set([id]));
        }
      }}
      onOpenProduct={(productId) => router.push(`/(seller)/products/${productId}` as any)}
      onStep={(row, next) => {
        if (savingId === row.variantId) return;
        if (next === (row.onHand ?? 0)) return;
        confirmReservedStock([row], next, () => void saveStock(row, next));
      }}
      onEdit={(row) => setSheetRow(row)}
      onQuickRestock={(row) => {
        const next = Math.max(10, (row.reserved || 0) + 5);
        confirmReservedStock([row], next, () => void saveStock(row, next));
      }}
    />
  )}
  ... // ListHeaderComponent, refreshControl, contentContainerStyle, ListEmptyComponent all unchanged
/>
```

Repoint `startEdit` callers to the sheet: change `const startEdit = (row) => { setEditing(row.variantId); setDraftStock(...); }` to open the sheet instead — delete `startEdit`, `editing`, `draftStock` states and mount the sheet before the closing `</View>` of the screen return:

```tsx
<SellerStockSheet
  visible={!!sheetRow}
  row={sheetRow}
  saving={saving}
  onClose={() => setSheetRow(null)}
  onSave={(n) => {
    if (!sheetRow) return;
    const target = sheetRow;
    confirmReservedStock([target], n, () => void saveStock(target, n));
  }}
/>
```

In `saveStock` success branch, replace `setEditing(null);` with `setSheetRow(null);`.

- [ ] **Step 4: Typecheck + unit tests**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "seller/inventory|SellerStock|seller-inventory" || echo CLEAN`
Expected: `CLEAN`

Run: `npx vitest run lib/__tests__/seller-inventory.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(seller)/inventory/index.tsx"
git commit -m "feat: restyle seller inventory with grouped status cards and edit sheet"
```

---

### Task 5: Verification and cleanup

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run full relevant test suites**

Run: `npx vitest run lib/__tests__/seller-inventory.test.ts lib/__tests__/brand-inventory.test.ts lib/__tests__/inventory.test.ts`
Expected: PASS (all suites green)

- [ ] **Step 2: Run typecheck and full test suite**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no output)

Run: `npm test 2>&1 | tail -6`
Expected: all test files pass

- [ ] **Step 3: Manual checklist (report results in PR)**

Verify on a phone-width emulator: search filters by name/SKU/size/colour; chip counts correct; urgency order (out first); stepper updates optimistically with success toast; sheet save below reserved shows inline warning then confirm dialog; error rolls back with error toast; quick restock on out rows; long-press enters select mode; bulk apply shows toast and refreshes on partial failure; CSV share works; pull-to-refresh; empty search shows "No SKUs match"; null-stock rows show "—" with no edit controls.

- [ ] **Step 4: Stop the brainstorm visual server**

Run: `scripts/stop-server.sh /Users/thufailahamed/Downloads/store-main/store-mobile/.superpowers/brainstorm/20995-1788727355/state`
Expected: server stopped
