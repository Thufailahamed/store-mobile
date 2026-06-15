const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGpqc2J6cnVncXZvYm53ZXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzA1NDYsImV4cCI6MjA5NjA0NjU0Nn0.mJOb_OmtsCbUKnZzQVQ_BqcaiWuKJsRkeFxqFZzwAdU";
const BASE_URL = "https://fipjjsbzrugqvobnwewm.supabase.co/rest/v1";

async function run() {
  const tables = [
    "products", "product_variants", "product_images", "inventory", 
    "brands", "categories", "stores", "cart", "cart_items", 
    "wishlists", "wishlist_items", "orders", "order_items", "users"
  ];
  
  for (const table of tables) {
    try {
      const res = await fetch(`${BASE_URL}/${table}?select=*`, {
        headers: {
          "apikey": ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const jsonStr = JSON.stringify(data);
        if (jsonStr.includes("2a75ae99") || jsonStr.includes("2a75ae")) {
          console.log(`FOUND IN TABLE ${table}!`);
          // Find the exact row
          const matchedRows = data.filter(row => JSON.stringify(row).includes("2a75ae"));
          console.log("Matched rows:", matchedRows);
        }
      }
    } catch (err) {
      // ignore table not found
    }
  }
}

run();
