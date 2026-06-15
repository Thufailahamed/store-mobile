const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGpqc2J6cnVncXZvYm53ZXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzA1NDYsImV4cCI6MjA5NjA0NjU0Nn0.mJOb_OmtsCbUKnZzQVQ_BqcaiWuKJsRkeFxqFZzwAdU";
const BASE_URL = "https://fipjjsbzrugqvobnwewm.supabase.co/rest/v1";

const id1 = "2047bdd6-0341-497c-abeb-9a9a9d182580";
const id2 = "2a75ae995-00de-4002-a764-bb20c17786ff";

async function checkTable(tableName) {
  const url = `${BASE_URL}/${tableName}?or=(id.eq.${id1},id.eq.${id2})`;
  const res = await fetch(url, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    if (data.length > 0) {
      console.log(`Found in table ${tableName}:`, data);
    }
  }
}

async function checkTableByFields(tableName, fields) {
  const queries = fields.map(field => `${field}.eq.${id1},${field}.eq.${id2}`).join(",");
  const url = `${BASE_URL}/${tableName}?or=(${queries})`;
  const res = await fetch(url, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    if (data.length > 0) {
      console.log(`Found in table ${tableName} (by fields ${fields.join(",")}):`, data);
    }
  }
}

async function run() {
  const tables = ["products", "product_variants", "product_images", "cart_items", "categories", "brands", "stores"];
  for (const t of tables) {
    await checkTable(t);
  }
  
  await checkTableByFields("product_variants", ["product_id"]);
  await checkTableByFields("cart_items", ["product_id", "variant_id"]);
}

run();
