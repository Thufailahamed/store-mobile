#!/usr/bin/env node
/**
 * One-time: mark all stores that exist today as fully compliant.
 * New stores created after this run still follow the normal onboarding flow.
 *
 * Usage (from store-mobile):
 *   node scripts/grandfather-existing-store-compliance.mjs
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from ../store/.env.local or .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DOC_TYPES = ["business_registration", "tax_certificate"];

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const now = new Date().toISOString();

function placeholderTaxId(store) {
  return `GF-${store.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

async function main() {
  const { data: stores, error } = await sb
    .from("stores")
    .select("id, name, legal_name, tax_id, status, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to list stores:", error.message);
    process.exit(1);
  }

  if (!stores?.length) {
    console.log("No stores found — nothing to grandfather.");
    return;
  }

  console.log(`Grandfathering ${stores.length} existing store(s)…\n`);

  for (const store of stores) {
    const legalName = (store.legal_name ?? "").trim() || store.name;
    const taxId = (store.tax_id ?? "").trim() || placeholderTaxId(store);

    const storePatch = {};
    if (!(store.legal_name ?? "").trim()) storePatch.legal_name = legalName;
    if (!(store.tax_id ?? "").trim()) storePatch.tax_id = taxId;

    if (Object.keys(storePatch).length > 0) {
      const { error: storeErr } = await sb
        .from("stores")
        .update(storePatch)
        .eq("id", store.id);
      if (storeErr) {
        console.error(`  [${store.name}] store update failed:`, storeErr.message);
        continue;
      }
    }

    const { error: payoutErr } = await sb.from("payout_settings").upsert(
      {
        store_id: store.id,
        method: "bank",
        schedule: "weekly",
        bank_name: "Grandfathered Bank",
        account_name: legalName,
        account_number_last4: "0000",
        tax_form_submitted: true,
        updated_at: now,
      },
      { onConflict: "store_id" },
    );
    if (payoutErr) {
      console.error(`  [${store.name}] payout_settings failed:`, payoutErr.message);
      continue;
    }

    let docsOk = true;
    for (const docType of DOC_TYPES) {
      const { error: docErr } = await sb.from("store_compliance_documents").upsert(
        {
          store_id: store.id,
          doc_type: docType,
          file_url: `${store.id}/grandfathered-${docType}.pdf`,
          file_name: "System verified (grandfathered)",
          status: "approved",
          uploaded_at: now,
          reviewed_at: now,
          review_notes: "Grandfathered for existing stores at platform launch.",
        },
        { onConflict: "store_id,doc_type" },
      );
      if (docErr) {
        console.error(`  [${store.name}] ${docType} failed:`, docErr.message);
        docsOk = false;
      }
    }

    console.log(
      docsOk
        ? `  ✓ ${store.name} (${store.status}) — compliance complete`
        : `  ~ ${store.name} — partial (see errors above)`,
    );
  }

  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.rpc("get_catalog_visible_store_ids");
    if (error) {
      console.log(
        "\n⚠ Checkout visibility RPC is not deployed yet.",
      );
      console.log(
        "  Run this SQL in the Supabase dashboard (SQL editor) once:",
      );
      console.log(
        "  store/supabase/migrations/0095_catalog_visible_store_ids_rpc.sql",
      );
    } else {
      console.log(`\nCheckout-ready stores (via RPC): ${data?.length ?? 0}`);
    }
  }

  console.log("\nDone. New stores must complete compliance through the normal flow.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
