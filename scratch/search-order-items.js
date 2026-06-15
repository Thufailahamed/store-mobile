const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGpqc2J6cnVncXZvYm53ZXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzA1NDYsImV4cCI6MjA5NjA0NjU0Nn0.mJOb_OmtsCbUKnZzQVQ_BqcaiWuKJsRkeFxqFZzwAdU";
const BASE_URL = "https://fipjjsbzrugqvobnwewm.supabase.co/rest/v1";

async function run() {
  const res = await fetch(`${BASE_URL}/order_items?select=*`, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    console.log("Total order items count:", data.length);
    const matched = data.filter(item => item.product_id === "2047bdd6-0341-497c-abeb-9a9a9d182580" || item.product_id === "a75ae995-00de-4002-a764-bb20c17786ff");
    console.log("Matched order items:", matched);
  }
}

run();
