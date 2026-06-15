const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGpqc2J6cnVncXZvYm53ZXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzA1NDYsImV4cCI6MjA5NjA0NjU0Nn0.mJOb_OmtsCbUKnZzQVQ_BqcaiWuKJsRkeFxqFZzwAdU";
const BASE_URL = "https://fipjjsbzrugqvobnwewm.supabase.co/rest/v1";

async function run() {
  const res = await fetch(`${BASE_URL}/product_variants?select=id,product_id`, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    console.log("All variants IDs:");
    data.forEach(v => {
      console.log(`Product: ${v.product_id} -> Variant: ${v.id}`);
    });
  }
}

run();
