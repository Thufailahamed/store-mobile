const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGpqc2J6cnVncXZvYm53ZXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzA1NDYsImV4cCI6MjA5NjA0NjU0Nn0.mJOb_OmtsCbUKnZzQVQ_BqcaiWuKJsRkeFxqFZzwAdU";
const BASE_URL = "https://fipjjsbzrugqvobnwewm.supabase.co/rest/v1";

async function run() {
  const res = await fetch(`${BASE_URL}/product_variants?select=*`, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    console.log("Total variants count:", data.length);
    const matched = data.filter(v => v.id.includes("a75ae") || v.id.includes("2a75ae") || v.product_id?.includes("2047bd") || v.id.includes("2047bd"));
    console.log("Matched variants:", matched);
  }
}

run();
