#!/usr/bin/env node
/**
 * Verify grandfathered store compliance + home catalog + checkout RPC.
 * Usage: node scripts/verify-store-compliance.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

for (const file of [
  resolve(ROOT, ".env.local"),
  resolve(ROOT, ".env"),
  resolve(ROOT, "../store/.env.local"),
]) {
  loadEnvFile(file);
}

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const anon = createClient(url, anonKey);
const svc = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failed = false;
function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, detail = "") {
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  failed = true;
}

console.log("Store compliance verification\n");

const { data: stores, error: storeErr } = await svc
  .from("stores")
  .select("id, name, legal_name, tax_id, status");
if (storeErr || !stores?.length) {
  fail("stores loaded", storeErr?.message ?? "none found");
  process.exit(1);
}
pass(`${stores.length} stores in database`);

const ids = stores.map((s) => s.id);
const [{ data: payouts }, { data: docs }] = await Promise.all([
  svc.from("payout_settings").select("store_id, tax_form_submitted").in("store_id", ids),
  svc
    .from("store_compliance_documents")
    .select("store_id, doc_type, status")
    .in("store_id", ids),
]);

if ((payouts?.length ?? 0) === stores.length) pass("payout_settings for every store");
else fail("payout_settings", `${payouts?.length ?? 0}/${stores.length}`);

if ((docs?.length ?? 0) === stores.length * 2) pass("compliance docs (2 per store)");
else fail("compliance docs", `${docs?.length ?? 0}/${stores.length * 2}`);

if (docs?.every((d) => d.status === "approved")) pass("all docs approved");
else fail("doc approval status");

if (payouts?.every((p) => p.tax_form_submitted)) pass("tax forms submitted");
else fail("tax forms");

const missingProfile = stores.filter((s) => !s.legal_name?.trim() || !s.tax_id?.trim());
if (!missingProfile.length) pass("legal_name + tax_id on all stores");
else fail("store profile fields", missingProfile.map((s) => s.name).join(", "));

console.log("\nHome catalog (customer view)\n");

const { data: browsable } = await anon.from("stores").select("id").in("status", ["approved"]);
const bIds = (browsable ?? []).map((s) => s.id);
if (bIds.length >= stores.length) pass(`${bIds.length} browsable stores`);
else fail("browsable stores", `${bIds.length}`);

for (const [label, col] of [
  ["On sale", "discount_pct"],
  ["New arrivals", "created_at"],
  ["Trending", "rating"],
]) {
  const { data } = await anon
    .from("products")
    .select("id")
    .eq("status", "active")
    .eq("is_active", true)
    .in("store_id", bIds)
    .order(col, { ascending: false })
    .limit(12);
  if ((data?.length ?? 0) > 0) pass(`${label}: ${data.length} products`);
  else fail(label, "0 products");
}

console.log("\nCheckout visibility\n");

const { data: rpcData, error: rpcErr } = await anon.rpc("get_catalog_visible_store_ids");
if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
  pass(`checkout RPC: ${rpcData.length} compliant stores`);
} else {
  fail(
    "checkout RPC not deployed",
    rpcErr?.message ?? "returns 0 stores",
  );
  console.log(
    "\n  → Apply store/supabase/migrations/0095_catalog_visible_store_ids_rpc.sql",
  );
  console.log("    in Supabase Dashboard → SQL Editor → Run\n");
}

console.log(failed ? "\nSome checks failed." : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
