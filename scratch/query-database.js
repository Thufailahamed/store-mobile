const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGpqc2J6cnVncXZvYm53ZXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzA1NDYsImV4cCI6MjA5NjA0NjU0Nn0.mJOb_OmtsCbUKnZzQVQ_BqcaiWuKJsRkeFxqFZzwAdU";
const BASE_URL = "https://fipjjsbzrugqvobnwewm.supabase.co/rest/v1";

async function run() {
  // Fetch cart_items
  const res = await fetch(`${BASE_URL}/cart_items?select=*`, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    console.log("Cart items:", data);
  }
}

run();
