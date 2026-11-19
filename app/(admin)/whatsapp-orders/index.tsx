/**
 * Admin — WhatsApp orders (foreign-sourced dresses). Mobile parity with web
 * /admin/whatsapp-orders: orders board with stage moves, new order form,
 * WhatsApp-order product toggles, and the order chat number.
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Switch } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { themedAlert } from "@/lib/themed-alert";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import {
  WA_STAGES,
  createWaOrder,
  getWaNumber,
  listWaOrders,
  listWaProducts,
  searchWaCustomers,
  setWaNumber,
  setWaOrderStage,
  setWaProductChannel,
  type WaCustomer,
  type WaOrder,
  type WaProduct,
} from "@/lib/api/admin-whatsapp";

type Tab = "orders" | "new" | "dresses" | "number";
const TABS: { key: Tab; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "new", label: "New order" },
  { key: "dresses", label: "Dresses" },
  { key: "number", label: "Number" },
];
const TERMINAL = new Set(["delivered", "cancelled", "refunded", "returned"]);
const PAYMENT_METHODS = [
  { key: "bank_transfer", label: "Bank transfer" },
  { key: "payhere", label: "PayHere" },
  { key: "paymentslk", label: "Payments.lk" },
  { key: "stripe", label: "Card" },
] as const;

const FG = colors.light.foreground;
const MUTED = colors.light.mutedForeground;
const BORDER = colors.light.border;
const WA_GREEN = "#25D366";

async function unwrap<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function primaryImage(p: WaProduct): string | undefined {
  const imgs = p.images ?? [];
  return (imgs.find((i) => i.is_primary) ?? imgs[0])?.url;
}

function stageIndex(o: WaOrder): number {
  const s = o.metadata?.sourcing_stage ?? o.status;
  const i = WA_STAGES.findIndex((x) => x.key === s);
  return i < 0 ? 0 : i;
}

export default function AdminWhatsappOrders() {
  const [tab, setTab] = useState<Tab>("orders");
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ADMIN · OPERATIONS</Text>
        <Text style={styles.title}>WhatsApp Orders</Text>
        <Text style={styles.subtitle}>
          Foreign-sourced dresses. Customers order on WhatsApp; create the order here and move it through each stage. No
          courier, no cash on delivery.
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.body}>
        {tab === "orders" && <OrdersBoard onNew={() => setTab("new")} />}
        {tab === "new" && <NewOrder onCreated={() => setTab("orders")} />}
        {tab === "dresses" && <Dresses />}
        {tab === "number" && <NumberSetting />}
      </View>
    </ScrollView>
  );
}

/* ── Orders ─────────────────────────────────────────────────────────────── */
function OrdersBoard({ onNew }: { onNew: () => void }) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const q = useQuery({
    queryKey: ["admin-wa-orders", filter],
    queryFn: () => unwrap(listWaOrders(filter)),
  });
  const orders = q.data?.orders ?? [];
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        {(["open", "all"] as const).map((f) => (
          <Chip key={f} label={f === "open" ? "In progress" : "All"} active={filter === f} onPress={() => setFilter(f)} />
        ))}
        <Text style={styles.muted}>{q.data?.total ?? 0} orders</Text>
        <Pressable onPress={onNew} style={[styles.btn, styles.btnDark, { marginLeft: "auto" }]}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.btnDarkText}>New</Text>
        </Pressable>
      </View>
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : orders.length === 0 ? (
        <View style={styles.card}>
          <Text style={[styles.muted, { textAlign: "center" }]}>No WhatsApp orders {filter === "open" ? "in progress" : "yet"}.</Text>
        </View>
      ) : (
        orders.map((o) => <OrderCard key={o.id} order={o} />)
      )}
      {q.isFetching && !q.isLoading ? <ActivityIndicator size="small" /> : null}
    </View>
  );
}

function OrderCard({ order }: { order: WaOrder }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const done = TERMINAL.has(order.status);
  const current = stageIndex(order);
  const next = WA_STAGES[current + 1];
  const paid = order.payment_status === "paid";
  const addr = order.shipping_address ?? {};

  const m = useMutation({
    mutationFn: (body: { stage?: string; payment_status?: "paid" | "pending"; note?: string }) =>
      unwrap(setWaOrderStage(order.id, body)),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-wa-orders"] });
      toast("Order updated", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const cancel = () =>
    themedAlert(`Cancel ${order.order_number}?`, "This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: () => m.mutate({ stage: "cancelled", note: note || undefined }) },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle}>{order.order_number}</Text>
          <Text style={styles.small} numberOfLines={1}>
            {order.user?.full_name ?? addr.full_name ?? "Customer"} · {addr.phone ?? order.user?.phone ?? "—"}
          </Text>
        </View>
        <Text style={styles.price}>{formatPrice(order.total, order.currency)}</Text>
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        <Pill label={paid ? "Paid" : "Payment pending"} tone={paid ? "good" : "muted"} />
        <Pill label={order.status.replace(/_/g, " ")} tone={order.status === "cancelled" ? "bad" : "muted"} />
      </View>
      <View style={{ marginTop: 10, gap: 2 }}>
        {order.items.map((it) => (
          <Text key={it.id} style={styles.body14} numberOfLines={2}>
            {it.quantity} × {it.product_name}
            {it.variant_label ? <Text style={styles.muted}> ({it.variant_label})</Text> : null}
          </Text>
        ))}
      </View>
      <Text style={[styles.small, { marginTop: 6 }]}>
        Deliver to: {[addr.line1, addr.line2, addr.city, addr.district].filter(Boolean).join(", ") || "—"}
      </Text>
      {order.notes ? <Text style={[styles.small, { fontStyle: "italic" }]}>Note: {order.notes}</Text> : null}

      <View style={styles.stageWrap}>
        {WA_STAGES.map((s, i) => {
          const reached = order.status !== "cancelled" && i <= current;
          return (
            <View key={s.key} style={[styles.stage, reached && styles.stageOn]}>
              {reached ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
              <Text style={[styles.stageText, reached && { color: "#fff" }]}>{s.label}</Text>
            </View>
          );
        })}
      </View>

      {!done && (
        <View style={{ gap: 8, marginTop: 10 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note for customer tracking"
            placeholderTextColor={MUTED}
            style={styles.input}
          />
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            {!paid && (
              <Pressable disabled={m.isPending} onPress={() => m.mutate({ payment_status: "paid" })} style={[styles.btn, styles.btnOutline]}>
                <Text style={styles.btnOutlineText}>Mark paid</Text>
              </Pressable>
            )}
            {next && (
              <Pressable
                disabled={m.isPending || (next.key === "delivered" && !paid)}
                onPress={() => m.mutate({ stage: next.key, note: note || undefined })}
                style={[styles.btn, styles.btnDark, (m.isPending || (next.key === "delivered" && !paid)) && { opacity: 0.4 }]}
                accessibilityLabel={`Mark ${next.label}`}
              >
                {m.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnDarkText}>Mark: {next.label}</Text>}
              </Pressable>
            )}
            <Pressable disabled={m.isPending} onPress={cancel} style={styles.btn}>
              <Text style={{ color: colors.light.destructive, fontFamily: fontFamilies.sans.semibold, fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
          {next?.key === "delivered" && !paid ? <Text style={styles.small}>Mark the order paid before delivering.</Text> : null}
        </View>
      )}
    </View>
  );
}

/* ── New order ──────────────────────────────────────────────────────────── */
type Line = { key: string; product: WaProduct; variant_id: string | null; quantity: number; unit_price: number };

function NewOrder({ onCreated }: { onCreated: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [custQ, setCustQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<WaCustomer | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [shipping, setShipping] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["key"]>("bank_transfer");
  const [paidNow, setPaidNow] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(custQ.trim()), 300);
    return () => clearTimeout(t);
  }, [custQ]);
  const custs = useQuery({
    queryKey: ["admin-wa-customers", debounced],
    queryFn: () => unwrap(searchWaCustomers(debounced)),
    enabled: debounced.length >= 2 && !picked,
  });
  const prods = useQuery({ queryKey: ["admin-wa-products", "whatsapp", ""], queryFn: () => unwrap(listWaProducts("whatsapp")) });
  const products = prods.data?.products ?? [];

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0), [lines]);
  const total = Math.max(0, subtotal - (Number(discount) || 0)) + (Number(shipping) || 0);

  const addLine = (p: WaProduct) => {
    const vs = (p.variants ?? []).filter((v) => v.is_active !== false);
    setLines((ls) => [
      ...ls,
      { key: `${p.id}-${Date.now()}`, product: p, variant_id: vs[0]?.id ?? null, quantity: 1, unit_price: Number(vs[0]?.price ?? p.price) || 0 },
    ]);
  };
  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        createWaOrder({
          customer: picked ? { user_id: picked.id } : { full_name: fullName.trim(), phone: phone.trim(), email: email.trim() || undefined },
          items: lines.map((l) => ({ product_id: l.product.id, variant_id: l.variant_id, quantity: l.quantity, unit_price: l.unit_price })),
          shipping_address: {
            full_name: (picked?.full_name || fullName).trim(),
            phone: (phone || picked?.phone || "").trim(),
            line1: line1.trim(),
            line2: line2.trim() || null,
            city: city.trim(),
            district: district.trim() || null,
            country: "Sri Lanka",
          },
          shipping_fee: Number(shipping) || 0,
          discount: Number(discount) || 0,
          payment_method: method,
          payment_status: paidNow ? "paid" : "pending",
          notes: notes.trim() || null,
        }),
      ),
    onSuccess: (res) => {
      toast(`Order ${res.order.order_number} created`, "success", {
        subtitle: res.created_customer ? "Customer account created for this phone" : undefined,
      });
      qc.invalidateQueries({ queryKey: ["admin-wa-orders"] });
      onCreated();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const customerOk = picked ? Boolean(phone || picked.phone) : fullName.trim().length > 0 && phone.trim().length >= 7;
  const canSubmit = customerOk && line1.trim() && city.trim() && lines.length > 0 && !create.isPending;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.card}>
        <Text style={styles.section}>Customer</Text>
        {picked ? (
          <View style={[styles.row, styles.pickedBox]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.body14}>{picked.full_name ?? "Unnamed"}</Text>
              <Text style={styles.small}>{[picked.phone, picked.email].filter(Boolean).join(" · ")}</Text>
            </View>
            <Pressable onPress={() => setPicked(null)} style={styles.btn}>
              <Text style={styles.btnOutlineText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput value={custQ} onChangeText={setCustQ} placeholder="Search existing customer" placeholderTextColor={MUTED} style={styles.input} />
            {(custs.data?.customers ?? []).map((cu) => (
              <Pressable
                key={cu.id}
                onPress={() => {
                  setPicked(cu);
                  if (cu.phone) setPhone(cu.phone);
                }}
                style={styles.listRow}
              >
                <Text style={styles.body14}>{cu.full_name ?? "Unnamed"}</Text>
                <Text style={styles.small}>{[cu.phone, cu.email].filter(Boolean).join(" · ")}</Text>
              </Pressable>
            ))}
            <Text style={styles.small}>Or enter details — linked to an existing account by phone/email, or a new one is created.</Text>
            <Field label="Full name" value={fullName} onChange={setFullName} />
            <Field label="WhatsApp / phone" value={phone} onChange={setPhone} placeholder="077 123 4567" keyboard="phone-pad" />
            <Field label="Email (optional)" value={email} onChange={setEmail} keyboard="email-address" />
          </>
        )}
        {picked ? <Field label="Contact phone for delivery" value={phone} onChange={setPhone} keyboard="phone-pad" /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Delivery address</Text>
        <Field label="Address line 1" value={line1} onChange={setLine1} />
        <Field label="Address line 2" value={line2} onChange={setLine2} />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="District" value={district} onChange={setDistrict} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Dresses</Text>
        {lines.map((l) => {
          const vs = (l.product.variants ?? []).filter((v) => v.is_active !== false);
          return (
            <View key={l.key} style={styles.lineBox}>
              <View style={styles.row}>
                <Text style={[styles.body14, { flex: 1 }]} numberOfLines={2}>
                  {l.product.name}
                </Text>
                <Pressable onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} accessibilityLabel="Remove line">
                  <Ionicons name="trash-outline" size={18} color={MUTED} />
                </Pressable>
              </View>
              {vs.length > 0 && (
                <View style={[styles.row, { flexWrap: "wrap", marginTop: 6 }]}>
                  {vs.map((v) => (
                    <Chip
                      key={v.id}
                      label={[v.size, v.color].filter(Boolean).join(" / ") || v.sku || "Default"}
                      active={l.variant_id === v.id}
                      onPress={() => update(l.key, { variant_id: v.id, unit_price: Number(v.price ?? l.unit_price) || l.unit_price })}
                    />
                  ))}
                </View>
              )}
              <View style={[styles.row, { marginTop: 8 }]}>
                <Text style={styles.small}>Qty</Text>
                <Pressable onPress={() => update(l.key, { quantity: Math.max(1, l.quantity - 1) })} style={styles.stepBtn}>
                  <Ionicons name="remove" size={16} color={FG} />
                </Pressable>
                <TextInput
                  value={String(l.quantity)}
                  onChangeText={(v) => update(l.key, { quantity: Math.max(1, Math.min(10000, parseInt(v || "1", 10) || 1)) })}
                  keyboardType="number-pad"
                  style={[styles.input, { width: 64, textAlign: "center", paddingVertical: 6 }]}
                  accessibilityLabel="Quantity"
                />
                <Pressable onPress={() => update(l.key, { quantity: Math.min(10000, l.quantity + 1) })} style={styles.stepBtn}>
                  <Ionicons name="add" size={16} color={FG} />
                </Pressable>
                <Text style={[styles.small, { marginLeft: 8 }]}>Price</Text>
                <TextInput
                  value={String(l.unit_price)}
                  onChangeText={(t) => update(l.key, { unit_price: Math.max(0, Number(t.replace(/[^\d.]/g, "")) || 0) })}
                  keyboardType="numeric"
                  style={[styles.input, { flex: 1, paddingVertical: 6 }]}
                  accessibilityLabel="Unit price"
                />
              </View>
            </View>
          );
        })}
        {prods.isLoading ? (
          <ActivityIndicator />
        ) : products.length === 0 ? (
          <Text style={styles.small}>No WhatsApp-order dresses yet. Mark some in the Dresses tab.</Text>
        ) : (
          <>
            <Text style={[styles.small, { marginTop: 4 }]}>Tap to add:</Text>
            {products.map((p) => (
              <Pressable key={p.id} onPress={() => addLine(p)} style={[styles.listRow, styles.row]}>
                {primaryImage(p) ? <Image source={{ uri: primaryImage(p) }} style={styles.thumb} contentFit="cover" /> : null}
                <Text style={[styles.body14, { flex: 1 }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.small}>{formatPrice(p.price, p.currency)}</Text>
                <Ionicons name="add-circle-outline" size={20} color={FG} />
              </Pressable>
            ))}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Payment & total</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Delivery fee" value={shipping} onChange={setShipping} keyboard="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Discount" value={discount} onChange={setDiscount} keyboard="numeric" />
          </View>
        </View>
        <Text style={styles.label}>PAYMENT METHOD (NO COD)</Text>
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          {PAYMENT_METHODS.map((pm) => (
            <Chip key={pm.key} label={pm.label} active={method === pm.key} onPress={() => setMethod(pm.key)} />
          ))}
        </View>
        <View style={[styles.row, { marginTop: 10 }]}>
          <Switch value={paidNow} onValueChange={setPaidNow} />
          <Text style={styles.body14}>Payment already received</Text>
        </View>
        <Field label="Internal note" value={notes} onChange={setNotes} />
        <View style={styles.totals}>
          <TotalRow label="Subtotal" value={subtotal} />
          <TotalRow label="Discount" value={-(Number(discount) || 0)} />
          <TotalRow label="Delivery" value={Number(shipping) || 0} />
          <TotalRow label="Total" value={total} bold />
        </View>
        <Pressable
          disabled={!canSubmit}
          onPress={() => create.mutate()}
          style={[styles.btn, styles.btnDark, styles.btnBlock, !canSubmit && { opacity: 0.4 }]}
          accessibilityLabel="Create order"
        >
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnDarkText}>Create order</Text>}
        </Pressable>
      </View>
    </View>
  );
}

/* ── Dresses (order_channel) ────────────────────────────────────────────── */
function Dresses() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const sourced = useQuery({ queryKey: ["admin-wa-products", "whatsapp", ""], queryFn: () => unwrap(listWaProducts("whatsapp")) });
  const wholesale = useQuery({
    queryKey: ["admin-wa-products", "wholesale", ""],
    queryFn: () => unwrap(listWaProducts("wholesale")),
  });
  const found = useQuery({
    queryKey: ["admin-wa-products", "all", debounced],
    queryFn: () => unwrap(listWaProducts("all", debounced)),
    enabled: debounced.length >= 2,
  });
  const toggle = useMutation({
    mutationFn: (p: WaProduct) => unwrap(setWaProductChannel(p.id, p.order_channel === "whatsapp" ? "checkout" : "whatsapp")),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-wa-products"] });
      toast("Product updated", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const row = (p: WaProduct) => {
    const wa = p.order_channel === "whatsapp";
    return (
      <View key={p.id} style={[styles.row, styles.listRow]}>
        {primaryImage(p) ? <Image source={{ uri: primaryImage(p) }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.body14} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.small}>
            {p.store?.name ?? "—"} · {formatPrice(p.price, p.currency)}
          </Text>
        </View>
        <Pressable
          disabled={toggle.isPending}
          onPress={() => toggle.mutate(p)}
          style={[styles.btn, wa ? styles.btnOutline : styles.btnDark]}
          accessibilityLabel={wa ? `Return ${p.name} to normal checkout` : `Make ${p.name} WhatsApp-order`}
        >
          <Text style={wa ? styles.btnOutlineText : styles.btnDarkText}>{wa ? "Undo" : "WhatsApp"}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Pressable
        onPress={() => router.push({ pathname: "/(admin)/products/new", params: { whatsapp: "1" } })}
        style={[styles.btn, styles.btnDark, styles.btnBlock, { marginTop: 0 }]}
        accessibilityLabel="Add sourced dress with AI"
      >
        <Ionicons name="sparkles" size={16} color="#fff" />
        <Text style={styles.btnDarkText}>Add sourced dress with AI</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: "/(admin)/products/new", params: { wholesale: "1" } })}
        style={[styles.btn, styles.btnOutline, styles.btnBlock, { marginTop: 0 }]}
        accessibilityLabel="Add wholesale product"
      >
        <Ionicons name="business-outline" size={16} color={colors.ink.DEFAULT} />
        <Text style={styles.btnOutlineText}>Add wholesale product</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.section}>Vestara Wholesale ({wholesale.data?.products.length ?? 0})</Text>
        <Text style={styles.small}>
          Admin-only B2B line at /wholesale on web and in the app. WhatsApp-only; hidden from retail.
        </Text>
        {(wholesale.data?.products ?? []).map((p) => (
          <View key={p.id} style={[styles.row, styles.listRow]}>
            {primaryImage(p) ? <Image source={{ uri: primaryImage(p) }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.body14} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.small}>
                {formatPrice(p.price, p.currency)} / pc · MOQ {p.wholesale_moq ?? 1} · Pack {p.wholesale_pack_size ?? 1}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: "/(admin)/products/edit/[id]", params: { id: p.id } })}
              style={[styles.btn, styles.btnOutline]}
              accessibilityLabel={`Edit ${p.name}`}
            >
              <Text style={styles.btnOutlineText}>Edit</Text>
            </Pressable>
          </View>
        ))}
        {wholesale.isLoading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>WhatsApp-order dresses ({sourced.data?.products.length ?? 0})</Text>
        <Text style={styles.small}>Shown with “Order via WhatsApp” instead of Add to bag. Never sent to the courier.</Text>
        {(sourced.data?.products ?? []).map(row)}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Add a product</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search products by name" placeholderTextColor={MUTED} style={styles.input} />
        {found.isFetching ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        {(found.data?.products ?? []).map(row)}
      </View>
    </View>
  );
}

/* ── Number ─────────────────────────────────────────────────────────────── */
function NumberSetting() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({ queryKey: ["admin-wa-number"], queryFn: () => unwrap(getWaNumber()) });
  const [value, setValue] = useState("");
  useEffect(() => {
    if (q.data) setValue(q.data.number ?? "");
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => unwrap(setWaNumber(value.trim() || null)),
    onSuccess: (r) => {
      setValue(r.number ?? "");
      qc.invalidateQueries({ queryKey: ["admin-wa-number"] });
      qc.invalidateQueries({ queryKey: ["checkout", "whatsapp"] });
      toast(r.number ? "WhatsApp number saved" : "WhatsApp ordering turned off", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="logo-whatsapp" size={20} color={WA_GREEN} />
        <Text style={styles.section}>Order chat number</Text>
      </View>
      <Text style={styles.small}>
        “Order via WhatsApp” opens a chat with this number, prefilled with the dress, size and quantity. Leave empty to hide ordering.
      </Text>
      <Field label="WhatsApp number (with country code)" value={value} onChange={setValue} placeholder="94771234567" keyboard="phone-pad" />
      <Pressable onPress={() => save.mutate()} disabled={save.isPending} style={[styles.btn, styles.btnDark, styles.btnBlock]}>
        {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnDarkText}>Save</Text>}
      </Pressable>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */
function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: "default" | "numeric" | "phone-pad" | "email-address";
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        keyboardType={keyboard ?? "default"}
        autoCapitalize={keyboard === "email-address" ? "none" : "sentences"}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, tone }: { label: string; tone: "good" | "bad" | "muted" }) {
  const bg = tone === "good" ? "#059669" : tone === "bad" ? colors.light.destructive : "transparent";
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: tone === "muted" ? BORDER : bg }]}>
      <Text style={[styles.pillText, tone !== "muted" && { color: "#fff" }]}>{label}</Text>
    </View>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <Text style={bold ? styles.cardTitle : styles.body14}>{label}</Text>
      <Text style={bold ? styles.cardTitle : styles.body14}>{formatPrice(value, "LKR")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 140 },
  hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 2 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 34, color: FG, letterSpacing: -1, marginTop: 8, lineHeight: 38 },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: MUTED, marginTop: 8 },
  tabs: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: BORDER },
  tabActive: { backgroundColor: FG, borderColor: FG },
  tabText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: FG },
  tabTextActive: { color: colors.light.background },
  body: { paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: { backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: BORDER, padding: 14 },
  cardTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: FG },
  section: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: FG, marginBottom: 4 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: FG },
  body14: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: FG },
  small: { fontFamily: fontFamilies.sans.regular, fontSize: 12, lineHeight: 17, color: MUTED },
  muted: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: MUTED },
  label: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 1, color: MUTED, marginBottom: 4, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: FG,
    backgroundColor: colors.light.background,
  },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.md, minHeight: 40 },
  btnBlock: { marginTop: 12, minHeight: 46 },
  btnDark: { backgroundColor: FG },
  btnDarkText: { color: "#fff", fontFamily: fontFamilies.sans.semibold, fontSize: 13 },
  btnOutline: { borderWidth: 1, borderColor: FG },
  btnOutlineText: { color: FG, fontFamily: fontFamilies.sans.semibold, fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: FG, borderColor: FG },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: FG },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  pillText: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: FG, textTransform: "capitalize" },
  stageWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  stage: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: BORDER },
  stageOn: { backgroundColor: FG, borderColor: FG },
  stageText: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: MUTED },
  listRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  pickedBox: { borderWidth: 1, borderColor: BORDER, borderRadius: radii.md, padding: 10 },
  lineBox: { borderWidth: 1, borderColor: BORDER, borderRadius: radii.md, padding: 10, marginBottom: 8 },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.light.muted },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  totals: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER, gap: 4 },
});
